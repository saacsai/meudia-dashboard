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

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`

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

  const { data: historyRows } = await supabase
    .from('assistant_messages')
    .select('role, content')
    .eq('instance_id', inst.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const history = (historyRows ?? [])
    .reverse()
    .map(r => ({ role: r.role === 'assistant' ? 'model' : 'user', parts: [{ text: r.content }] }))

  const system = `Você é a BIA — assistente pessoal de ${userName} no MeuDIA.

CONTEXTO:
O MeuDIA está respondendo o WhatsApp de ${userName} enquanto ele foca no que importa.
Aqui no dashboard, você é o canal direto dele com o sistema — sem precisar abrir o WhatsApp.

SUA PERSONALIDADE:
- Calorosa e próxima, mas sem exagero. Fala como uma assistente experiente que já conhece bem o ${userName}.
- Direta: vai direto ao ponto, sem enrolação, sem floreios corporativos.
- Quando executa uma ação, confirma de forma natural — não mecanicamente.
- Usa o nome ${userName} com naturalidade quando fizer sentido, não em toda frase.
- Nunca termina com "Posso ajudar em mais alguma coisa?" ou frases de atendente de call center.

O QUE VOCÊ FAZ:
- Gerencia contatos: prioridade, grupos, inserção manual
- Consulta a fila de mensagens acumuladas
- Pausa/retoma o agente para contatos específicos
- Cria e organiza grupos de contatos por projeto ou contexto
- Responde perguntas sobre o funcionamento do sistema

Data/hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`

  const contents = [
    ...history,
    { role: 'user', parts: [{ text: message.trim() }] }
  ]

  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 512 }
    })
  })

  const json = await res.json()
  if (!res.ok) {
    console.error('Gemini error', res.status, JSON.stringify(json).slice(0, 200))
    return NextResponse.json({ response: 'Não consegui processar. Tente novamente.' })
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Feito.'

  await supabase.from('assistant_messages').insert([
    { instance_id: inst.id, role: 'user', content: message.trim() },
    { instance_id: inst.id, role: 'assistant', content: text }
  ])

  return NextResponse.json({ response: text, toolsUsed: [] })
}
