import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const EVO_URL = 'https://evolution.saacs.com.br'
const EVO_KEY_GLOBAL = '28bad1a004a318d3f7ba983f466b7168'
const EVO_KEY_INSTANCE = '28bad1a004a318d3f7ba983f466b7168'

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

async function evo(method: string, path: string, body?: object, useGlobalKey = false) {
  const res = await fetch(`${EVO_URL}${path}`, {
    method,
    headers: { apikey: useGlobalKey ? EVO_KEY_GLOBAL : EVO_KEY_INSTANCE, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

// GET — status da instância + QR code
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: inst } = await supabase
    .from('instances')
    .select('instance_name, status, phone_number')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!inst) return NextResponse.json({ connected: false, instance: null })

  // Busca estado real da conexão na Evolution API
  const state = await evo('GET', `/instance/connectionState/${inst.instance_name}`)
  const connected = state?.instance?.state === 'open'

  if (connected) {
    return NextResponse.json({ connected: true, phone: inst.phone_number, instance: inst.instance_name })
  }

  // Busca QR code
  const qr = await evo('GET', `/instance/connect/${inst.instance_name}`)
  return NextResponse.json({
    connected: false,
    instance: inst.instance_name,
    qrcode: qr?.base64 || qr?.qrcode?.base64 || null,
    pairingCode: qr?.pairingCode || null,
  })
}

// POST — criar instância nova
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const instanceName = `meudia_${user.id.replace(/-/g, '').substring(0, 12)}`

  const created = await evo('POST', '/instance/create', {
    instanceName,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
  }, true)

  if (created?.error) return NextResponse.json({ error: created.error }, { status: 400 })

  // Salva instância no Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
  await supabase.from('instances').upsert({
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

  return NextResponse.json({
    instance: instanceName,
    qrcode: created?.qrcode?.base64 || created?.base64 || null,
  })
}

// DELETE — desconectar WhatsApp
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: inst } = await supabase
    .from('instances')
    .select('instance_name')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (inst) {
    await evo('DELETE', `/instance/logout/${inst.instance_name}`)
  }

  return NextResponse.json({ ok: true })
}
