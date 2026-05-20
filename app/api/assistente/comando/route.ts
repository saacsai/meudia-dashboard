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
  // Step 1 — auth
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ response: 'DIAG: auth falhou — sem usuário' })

  // Step 2 — parse body
  let message = ''
  try {
    const body = await req.json()
    message = body.message?.trim() ?? ''
  } catch {
    return NextResponse.json({ response: 'DIAG: erro ao parsear body' })
  }
  if (!message) return NextResponse.json({ response: 'DIAG: mensagem vazia' })

  // Step 3 — instance
  const supabase = db()
  const { data: instances, error: instErr } = await supabase
    .from('instances')
    .select('id')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)
  if (instErr) return NextResponse.json({ response: `DIAG: instância erro — ${instErr.message}` })
  const inst = instances?.[0] ?? null
  if (!inst) return NextResponse.json({ response: 'DIAG: nenhuma instância ativa' })

  // Step 4 — Gemini
  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ response: 'DIAG: GEMINI_API_KEY não definida' })

  let geminiText = ''
  try {
    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: 'Você é a BIA, assistente do usuário no MeuDIA. Responda de forma breve.' }] },
        contents: [{ role: 'user', parts: [{ text: message }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 512 }
      })
    })
    const json = await res.json()
    if (!res.ok) return NextResponse.json({ response: `DIAG: Gemini ${res.status} — ${json?.error?.message?.slice(0, 100)}` })
    geminiText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? 'sem resposta'
  } catch (e) {
    return NextResponse.json({ response: `DIAG: fetch Gemini falhou — ${String(e)}` })
  }

  // Step 5 — save history
  try {
    await supabase.from('assistant_messages').insert([
      { instance_id: inst.id, role: 'user', content: message },
      { instance_id: inst.id, role: 'assistant', content: geminiText }
    ])
  } catch {
    // não bloqueia mesmo se falhar
  }

  return NextResponse.json({ response: geminiText, toolsUsed: [] })
}
