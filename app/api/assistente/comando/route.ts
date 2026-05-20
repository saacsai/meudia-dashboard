import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await sb.auth.getUser(token)
  return user ?? null
}

function db() {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

const GEMINI_URL = () =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`

const TOOL_DECLARATIONS = [
  {
    name: 'buscar_contatos',
    description: 'Busca contatos pelo nome ou trecho do número. Use antes de outras ações para encontrar o ID correto.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Nome ou trecho do número' }
      },
      required: ['query']
    }
  },
  {
    name: 'definir_prioridade',
    description: 'Define a prioridade de um contato: priority (prioritário/urgente), normal ou muted (silenciado).',
    parameters: {
      type: 'OBJECT',
      properties: {
        contact_id: { type: 'STRING' },
        priority: { type: 'STRING', enum: ['priority', 'normal', 'muted'] },
        contact_name: { type: 'STRING', description: 'Nome do contato para confirmar na resposta' }
      },
      required: ['contact_id', 'priority']
    }
  },
  {
    name: 'consultar_fila',
    description: 'Retorna as mensagens pendentes na fila (não incluídas no digest ainda), ordenadas por recência.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'NUMBER', description: 'Quantidade máxima (padrão 8)' }
      }
    }
  },
  {
    name: 'criar_grupo',
    description: 'Cria um novo grupo de contatos para organizar por projeto ou contexto.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' },
        description: { type: 'STRING' },
        color: { type: 'STRING', description: 'Cor hex (ex: #3b82f6)' }
      },
      required: ['name']
    }
  },
  {
    name: 'adicionar_ao_grupo',
    description: 'Adiciona um contato a um grupo existente.',
    parameters: {
      type: 'OBJECT',
      properties: {
        contact_id: { type: 'STRING' },
        group_id: { type: 'STRING' },
        contact_name: { type: 'STRING' }
      },
      required: ['contact_id', 'group_id']
    }
  },
  {
    name: 'listar_grupos',
    description: 'Lista os grupos de contatos existentes.',
    parameters: { type: 'OBJECT', properties: {} }
  }
]

type ToolResult = Record<string, unknown>

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  instanceId: string
): Promise<ToolResult> {
  const supabase = db()

  if (name === 'buscar_contatos') {
    const q = String(args.query || '').toLowerCase()
    const { data } = await supabase
      .from('contacts')
      .select('id, name, remote_jid, priority')
      .eq('instance_id', instanceId)
      .ilike('name', `%${q}%`)
      .limit(5)
    if (!data?.length) return { encontrados: [], mensagem: 'Nenhum contato encontrado com esse nome.' }
    return {
      encontrados: data.map(c => ({
        id: c.id,
        nome: c.name,
        numero: c.remote_jid.replace('@s.whatsapp.net', ''),
        prioridade: c.priority
      }))
    }
  }

  if (name === 'definir_prioridade') {
    const { error } = await supabase
      .from('contacts')
      .update({ priority: args.priority, classified_manually: true })
      .eq('id', args.contact_id)
      .eq('instance_id', instanceId)
    if (error) return { sucesso: false, erro: error.message }
    return { sucesso: true, nome: args.contact_name || args.contact_id, prioridade: args.priority }
  }

  if (name === 'consultar_fila') {
    const limit = Number(args.limit) || 8
    const { data } = await supabase
      .from('message_queue')
      .select('contact_name, message_summary, priority, received_at')
      .eq('instance_id', instanceId)
      .eq('included_in_digest', false)
      .order('received_at', { ascending: false })
      .limit(limit)
    if (!data?.length) return { total: 0, mensagens: [], mensagem: 'Fila vazia — nenhuma mensagem pendente.' }
    return { total: data.length, mensagens: data }
  }

  if (name === 'criar_grupo') {
    const { data, error } = await supabase
      .from('contact_groups')
      .insert({
        instance_id: instanceId,
        name: String(args.name),
        description: args.description ? String(args.description) : null,
        color: args.color ? String(args.color) : '#6b7280'
      })
      .select('id, name')
      .single()
    if (error) {
      if (error.code === '23505') return { sucesso: false, erro: 'Já existe um grupo com esse nome.' }
      return { sucesso: false, erro: error.message }
    }
    return { sucesso: true, id: data.id, nome: data.name }
  }

  if (name === 'adicionar_ao_grupo') {
    const { error } = await supabase
      .from('contact_group_members')
      .insert({ group_id: String(args.group_id), contact_id: String(args.contact_id) })
    if (error) {
      if (error.code === '23505') return { sucesso: false, erro: 'Contato já está nesse grupo.' }
      return { sucesso: false, erro: error.message }
    }
    return { sucesso: true, nome: args.contact_name || args.contact_id }
  }

  if (name === 'listar_grupos') {
    const { data } = await supabase
      .from('contact_groups')
      .select('id, name, description, color')
      .eq('instance_id', instanceId)
      .order('name')
    return { grupos: data || [] }
  }

  return { erro: `Ferramenta desconhecida: ${name}` }
}

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: ToolResult } }

type GeminiContent = { role: string; parts: GeminiPart[] }

async function runGemini(
  contents: GeminiContent[],
  systemText: string,
  instanceId: string,
  depth = 0
): Promise<{ text: string; toolsUsed: Array<{ tool: string; args: Record<string, unknown>; result: ToolResult }> }> {
  const toolsUsed: Array<{ tool: string; args: Record<string, unknown>; result: ToolResult }> = []

  console.log('GEMINI_KEY prefix:', process.env.GEMINI_API_KEY?.slice(0, 10) ?? 'UNDEFINED')
  const res = await fetch(GEMINI_URL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      systemInstruction: { parts: [{ text: systemText }] },
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
    })
  })

  const json = await res.json()
  if (!res.ok) {
    console.error('Gemini error status:', res.status, JSON.stringify(json))
    return { text: 'Não consegui processar o pedido agora. Tente novamente em instantes.', toolsUsed }
  }

  const parts: GeminiPart[] = json.candidates?.[0]?.content?.parts ?? []
  const fnCall = parts.find((p): p is { functionCall: { name: string; args: Record<string, unknown> } } =>
    'functionCall' in p
  )

  if (fnCall && depth < 3) {
    const { name, args } = fnCall.functionCall
    const result = await executeTool(name, args, instanceId)
    toolsUsed.push({ tool: name, args, result })

    const newContents: GeminiContent[] = [
      ...contents,
      { role: 'model', parts: [{ functionCall: fnCall.functionCall }] },
      { role: 'user', parts: [{ functionResponse: { name, response: result } }] }
    ]

    const next = await runGemini(newContents, systemText, instanceId, depth + 1)
    return { text: next.text, toolsUsed: [...toolsUsed, ...next.toolsUsed] }
  }

  const textPart = parts.find((p): p is { text: string } => 'text' in p)
  return { text: textPart?.text || 'Feito.', toolsUsed }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { message } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

  const supabase = db()

  const { data: instances } = await supabase
    .from('instances')
    .select('id')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  const inst = instances?.[0] ?? null
  if (!inst) return NextResponse.json({ error: 'Nenhuma instância ativa' }, { status: 404 })

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const userName = profile?.full_name || user.email?.split('@')[0] || 'usuário'

  const { data: historyRows } = await supabase
    .from('assistant_messages')
    .select('role, content')
    .eq('instance_id', inst.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const history: GeminiContent[] = (historyRows || [])
    .reverse()
    .map(r => ({
      role: r.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: r.content }]
    }))

  const systemPrompt = `Você é a BIA, assistente pessoal de ${userName} no MeuDIA.

O MeuDIA gerencia o WhatsApp de ${userName} respondendo mensagens de contatos externos automaticamente enquanto ele está focado em outras coisas.

Use as ferramentas disponíveis para executar ações. Quando buscar um contato, use buscar_contatos primeiro para obter o ID.

COMPORTAMENTO:
- Respostas curtas e diretas (máximo 2 frases após executar uma ação)
- Confirme sempre o que foi feito
- Se não entender, liste brevemente o que pode fazer
- Data/hora atual: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`

  const contents: GeminiContent[] = [
    ...history,
    { role: 'user', parts: [{ text: message.trim() }] }
  ]

  const { text, toolsUsed } = await runGemini(contents, systemPrompt, inst.id)

  await supabase.from('assistant_messages').insert([
    { instance_id: inst.id, role: 'user', content: message.trim() },
    { instance_id: inst.id, role: 'assistant', content: text, tool_calls: toolsUsed.length ? toolsUsed : null }
  ])

  return NextResponse.json({ response: text, toolsUsed })
}
