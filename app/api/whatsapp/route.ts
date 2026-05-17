import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const EVO_URL = 'https://evolution.saacs.com.br'
const EVO_KEY = '28bad1a004a318d3f7ba983f466b7168'

async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

async function evo(method: string, path: string, body?: object) {
  const res = await fetch(`${EVO_URL}${path}`, {
    method,
    headers: { apikey: EVO_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

// GET — status + QR code
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: inst } = await supabaseAnon()
    .from('instances')
    .select('instance_name, status, phone_number')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!inst) return NextResponse.json({ connected: false, instance: null })

  const state = await evo('GET', `/instance/connectionState/${inst.instance_name}`)

  // Instância não existe na Evolution API — mostra botão de criar
  if (state?.status === 404 || state?.response?.message?.[0]?.includes('does not exist')) {
    return NextResponse.json({ connected: false, instance: null })
  }

  const connected = state?.instance?.state === 'open'

  if (connected) {
    return NextResponse.json({ connected: true, phone: inst.phone_number, instance: inst.instance_name })
  }

  // Desconectado — busca QR
  const qr = await evo('GET', `/instance/connect/${inst.instance_name}`)
  const qrcode = qr?.qrcode?.base64 || qr?.base64 || null

  return NextResponse.json({ connected: false, instance: inst.instance_name, qrcode })
}

// POST — criar instância
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const instanceName = `meudia_${user.id.replace(/-/g, '').substring(0, 12)}`

  // Cria instância na Evolution API
  const created = await evo('POST', '/instance/create', {
    instanceName,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
  })

  if (created?.status === 401 || created?.error === 'Unauthorized') {
    return NextResponse.json({ error: 'Evolution API: chave inválida' }, { status: 500 })
  }

  // QR já vem na resposta do create em qrcode.base64 (inclui prefixo data:image/...)
  const qrcode = created?.qrcode?.base64 || null

  // Salva no Supabase
  await supabaseAdmin().from('instances').upsert({
    user_id: user.id,
    instance_name: instanceName,
    status: 'disconnected',
    active: true,
    paused: false,
    persona_name: 'MAIA',
    persona_tone: 'profissional',
    persona_response_size: 'curto',
    persona_description: 'Sou MAIA, assistente profissional. Estou gerenciando as mensagens e garantindo que as prioridades sejam atendidas.',
    response_hint: 'Retorno em breve. Mensagens urgentes têm prioridade.',
  }, { onConflict: 'user_id' })

  return NextResponse.json({ instance: instanceName, qrcode })
}

// DELETE — desconectar
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: inst } = await supabaseAnon()
    .from('instances')
    .select('instance_name')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (inst) await evo('DELETE', `/instance/logout/${inst.instance_name}`)

  return NextResponse.json({ ok: true })
}
