import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callGemini, loadMemoryBlock } from '@/lib/assistant-tools'
import type { GeminiContent } from '@/lib/assistant-tools'

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

const toneMap: Record<string, string> = {
  formal:       'formal e preciso, usa linguagem corporativa',
  profissional: 'profissional e eficiente, direto ao ponto',
  descontraido: 'descontraído e próximo, comunicação leve',
  amigavel:     'amigável e caloroso, cria conexão',
}

const sizeMap: Record<string, string> = {
  curto:     'respostas curtas e objetivas',
  detalhado: 'respostas completas e detalhadas',
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { message } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

  const supabase = db()

  const { data: instances } = await supabase
    .from('instances')
    .select('id, persona_name, persona_tone, persona_response_size, persona_description')
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

  const fullName = profile?.full_name || user.email?.split('@')[0] || 'usuário'
  const userName = fullName.split(' ')[0]
  const assistantName = inst.persona_name || 'Assistente'
  const tone = toneMap[inst.persona_tone] || 'profissional e eficiente'
  const size = sizeMap[inst.persona_response_size] || 'respostas curtas'

  const [historyResult, memoryBlock] = await Promise.all([
    supabase
      .from('assistant_messages')
      .select('role, content')
      .eq('instance_id', inst.id)
      .eq('chat_source', 'olivia')
      .order('created_at', { ascending: false })
      .limit(10),
    loadMemoryBlock(inst.id, supabase)
  ])

  const history: GeminiContent[] = (historyResult.data ?? [])
    .reverse()
    .map(r => ({ role: r.role === 'assistant' ? 'model' : 'user', parts: [{ text: r.content }] }))

  const personaBase = inst.persona_description
    ? inst.persona_description
    : `Sou ${assistantName}, assistente pessoal de ${userName}.`

  const system = `Você é ${assistantName} — assistente pessoal de ${userName} no MeuDIA.

${personaBase}

Tom: ${tone}.
Formato: ${size}.
${memoryBlock}
O MeuDIA está gerenciando o WhatsApp de ${userName} enquanto ele foca no que importa.

COMO VOCÊ AGE:
- Use o nome ${userName} com naturalidade, não em toda frase.
- Confirme ações de forma natural — nunca mecanicamente.
- Nunca termine com "Posso ajudar em mais alguma coisa?" ou frases de atendente.
- Quando executar múltiplas ações, confirme todas de uma vez ao final.
REGRAS DE MEMÓRIA (crítico):
- Quando o usuário disser "lembra que...", "anota que...", "guarda que..." ou qualquer variação → chame salvar_memoria IMEDIATAMENTE, antes de responder.
- NUNCA diga que salvou algo sem ter chamado salvar_memoria e recebido { sucesso: true }.
- Se salvar_memoria retornar erro, diga ao usuário que não conseguiu salvar e o motivo.
- Uma mensagem pode ter múltiplas ações: execute todas as ferramentas necessárias antes de responder.

O QUE VOCÊ FAZ:
- Buscar, listar e cadastrar contatos
- Definir prioridade de contatos
- Consultar a fila de mensagens
- Criar e gerenciar grupos de contatos
- Salvar e apagar memórias

Data/hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`

  const contents: GeminiContent[] = [
    ...history,
    { role: 'user', parts: [{ text: message.trim() }] }
  ]

  const { text, toolsUsed } = await callGemini(contents, system, inst.id, supabase)

  await supabase.from('assistant_messages').insert([
    { instance_id: inst.id, role: 'user', content: message.trim(), chat_source: 'olivia' },
    { instance_id: inst.id, role: 'assistant', content: text, tool_calls: toolsUsed.length ? toolsUsed : null, chat_source: 'olivia' }
  ])

  return NextResponse.json({ response: text, toolsUsed })
}
