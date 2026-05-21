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

  const fullName = profile?.full_name || user.email?.split('@')[0] || 'usuário'
  const userName = fullName.split(' ')[0]

  const [historyResult, memoryBlock] = await Promise.all([
    supabase
      .from('assistant_messages')
      .select('role, content')
      .eq('instance_id', inst.id)
      .eq('chat_source', 'bia')
      .order('created_at', { ascending: false })
      .limit(10),
    loadMemoryBlock(inst.id, supabase)
  ])

  const history: GeminiContent[] = (historyResult.data ?? [])
    .reverse()
    .map(r => ({ role: r.role === 'assistant' ? 'model' : 'user', parts: [{ text: r.content }] }))

  const system = `Você é a BIA — assistente do MeuDIA, o produto de gestão de WhatsApp de ${userName}.
${memoryBlock}
CONTEXTO:
O MeuDIA está respondendo o WhatsApp de ${userName} enquanto ele foca no que importa.
Aqui no dashboard, você é o canal direto dele com o sistema.

SUA PERSONALIDADE:
- Calorosa e próxima, mas sem exagero. Fala como uma assistente experiente.
- Direta: vai direto ao ponto, sem floreios corporativos.
- Quando executa uma ação, confirma de forma natural.
- Usa o nome ${userName} com naturalidade, não em toda frase.
- Nunca termina com "Posso ajudar em mais alguma coisa?" ou frases de call center.

O QUE VOCÊ FAZ:
- Buscar, listar e cadastrar contatos
- Definir prioridade de contatos
- Consultar a fila de mensagens
- Criar e gerenciar grupos de contatos
- Salvar memórias importantes (use salvar_memoria quando o usuário mencionar algo relevante para lembrar)
- Apagar memórias quando o usuário pedir para esquecer algo

Data/hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`

  const contents: GeminiContent[] = [
    ...history,
    { role: 'user', parts: [{ text: message.trim() }] }
  ]

  const { text, toolsUsed } = await callGemini(contents, system, inst.id, supabase)

  await supabase.from('assistant_messages').insert([
    { instance_id: inst.id, role: 'user', content: message.trim(), chat_source: 'bia' },
    { instance_id: inst.id, role: 'assistant', content: text, tool_calls: toolsUsed.length ? toolsUsed : null, chat_source: 'bia' }
  ])

  return NextResponse.json({ response: text, toolsUsed })
}
