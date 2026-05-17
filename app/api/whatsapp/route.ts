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

  const { data: rows } = await supabaseAdmin()
    .from('instances')
    .select('instance_name, status, phone_number')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  const inst = rows?.[0] ?? null
  if (!inst) return NextResponse.json({ connected: false, instance: null })

  const state = await evo('GET', `/instance/connectionState/${inst.instance_name}`)

  if (state?.status === 404 || state?.response?.message?.[0]?.includes('does not exist')) {
    return NextResponse.json({ connected: false, instance: null })
  }

  const stateValue = (state?.instance?.state ?? state?.state ?? '').toLowerCase()
  const connected = stateValue === 'open' || stateValue === 'authenticated' || stateValue === 'connected'

  if (connected) {
    let phone = (state?.instance?.wuid || state?.instance?.ownerJid || '')
      .replace('@s.whatsapp.net', '') || inst.phone_number || null

    if (!phone) {
      // Tenta buscar o número via fetchInstances
      const info = await evo('GET', `/instance/fetchInstances`)
      const found = Array.isArray(info)
        ? info.find((i: { instance?: { instanceName?: string } }) => i.instance?.instanceName === inst.instance_name)
        : null
      phone = found?.instance?.ownerJid?.replace('@s.whatsapp.net', '') ||
              found?.instance?.wuid?.replace('@s.whatsapp.net', '') || null
    }

    if (phone && !inst.phone_number) {
      await supabaseAdmin().from('instances').update({ phone_number: phone }).eq('instance_name', inst.instance_name)
    }
    return NextResponse.json({ connected: true, phone, instance: inst.instance_name })
  }

  const qr = await evo('GET', `/instance/connect/${inst.instance_name}`)
  const qrcode = qr?.qrcode?.base64 || qr?.base64 || null

  return NextResponse.json({ connected: false, instance: inst.instance_name, qrcode })
}

// POST — criar instância
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const instanceName = `meudia_${user.id.replace(/-/g, '').substring(0, 16)}`

  const created = await evo('POST', '/instance/create', {
    instanceName,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
  })

  if (created?.status === 401 || created?.error === 'Unauthorized') {
    return NextResponse.json({ error: 'Evolution API: chave inválida' }, { status: 500 })
  }

  // Verifica se já está conectada
  const state = await evo('GET', `/instance/connectionState/${instanceName}`)
  const stateValue = (state?.instance?.state ?? state?.state ?? '').toLowerCase()
  const alreadyConnected = stateValue === 'open' || stateValue === 'authenticated' || stateValue === 'connected'

  let qrcode: string | null = created?.qrcode?.base64 || null

  if (!alreadyConnected && !qrcode) {
    await new Promise(r => setTimeout(r, 1500))
    const qr = await evo('GET', `/instance/connect/${instanceName}`)
    qrcode = qr?.qrcode?.base64 || qr?.base64 || null
  }

  // Limpa qualquer linha existente para este user e insere nova
  await supabaseAdmin().from('instances').delete().eq('user_id', user.id)
  const { error: insertError } = await supabaseAdmin().from('instances').insert({
    user_id: user.id,
    instance_name: instanceName,
    status: alreadyConnected ? 'connected' : 'disconnected',
    active: true,
    paused: false,
    persona_name: 'MAIA',
  })

  if (insertError) console.log('[whatsapp POST] insert error:', insertError.message)

  if (alreadyConnected) {
    const phone = (state?.instance?.wuid || state?.instance?.ownerJid || '')
      .replace('@s.whatsapp.net', '') || null
    if (phone) {
      await supabaseAdmin().from('instances').update({ phone_number: phone }).eq('instance_name', instanceName)
    }
    return NextResponse.json({ instance: instanceName, connected: true, phone })
  }

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
