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

  const { data: rows, error: rowsError } = await supabaseAdmin()
    .from('instances')
    .select('instance_name, status, phone_number')
    .eq('user_id', user.id)
    .limit(1)

  const inst = rows?.[0] ?? null

  if (!inst) return NextResponse.json({ connected: false, instance: null, _debug: { reason: 'no_supabase_record', user_id: user.id, rows, error: rowsError?.message } })

  const state = await evo('GET', `/instance/connectionState/${inst.instance_name}`)

  // Instância não existe na Evolution API — mostra botão de criar
  if (state?.status === 404 || state?.response?.message?.[0]?.includes('does not exist')) {
    return NextResponse.json({ connected: false, instance: null, _debug: { reason: 'evo_404', raw: state } })
  }

  const stateValue = state?.instance?.state ?? state?.state ?? ''
  const connected = stateValue === 'open'

  if (connected) {
    const phone = state?.instance?.wuid?.replace('@s.whatsapp.net', '') || inst.phone_number || null
    if (phone && !inst.phone_number) {
      await supabaseAdmin().from('instances').update({ phone_number: phone }).eq('instance_name', inst.instance_name)
    }
    return NextResponse.json({ connected: true, phone, instance: inst.instance_name })
  }

  // Desconectado — busca QR
  const qr = await evo('GET', `/instance/connect/${inst.instance_name}`)
  const qrcode = qr?.qrcode?.base64 || qr?.base64 || null

  return NextResponse.json({ connected: false, instance: inst.instance_name, qrcode, _debug: { reason: 'not_open', stateValue, raw: state } })
}

// POST — criar instância
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const instanceName = `meudia_${user.id.replace(/-/g, '').substring(0, 12)}`

  // Tenta criar instância na Evolution API
  const created = await evo('POST', '/instance/create', {
    instanceName,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
  })
  console.log('[whatsapp POST] create response:', JSON.stringify(created).substring(0, 300))

  if (created?.status === 401 || created?.error === 'Unauthorized') {
    return NextResponse.json({ error: 'Evolution API: chave inválida' }, { status: 500 })
  }

  // QR pode vir direto na criação ou precisar de uma chamada separada
  let qrcode: string | null = created?.qrcode?.base64 || null

  if (!qrcode) {
    // Instância já existia ou QR não veio — busca via /connect
    await new Promise(r => setTimeout(r, 1500))
    const qr = await evo('GET', `/instance/connect/${instanceName}`)
    console.log('[whatsapp POST] connect response:', JSON.stringify(qr).substring(0, 300))
    qrcode = qr?.qrcode?.base64 || qr?.base64 || null
  }

  // Remove conflito de instance_name pertencente a outro user
  await supabaseAdmin().from('instances').delete().eq('instance_name', instanceName).neq('user_id', user.id)

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

  const { data: delRows } = await supabaseAdmin()
    .from('instances')
    .select('instance_name')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  const delInst = delRows?.[0] ?? null
  if (delInst) await evo('DELETE', `/instance/logout/${delInst.instance_name}`)

  return NextResponse.json({ ok: true })
}
