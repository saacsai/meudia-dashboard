import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const EVO_URL = 'https://evolution.saacs.com.br'
const EVO_KEY = '28bad1a004a318d3f7ba983f466b7168'

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

function calcScore(lastMsgTimestamp: number | null, unreadCount: number, msgCount30d: number): number {
  const now = Math.floor(Date.now() / 1000)
  const daysSince = lastMsgTimestamp ? (now - lastMsgTimestamp) / 86400 : 9999

  let recency: number
  if (daysSince < 1) recency = 50
  else if (daysSince < 7) recency = 40
  else if (daysSince < 30) recency = 25
  else if (daysSince < 90) recency = 10
  else recency = 0

  const freq = Math.min(msgCount30d / 20, 1) * 30
  const unread = Math.min(unreadCount / 5, 1) * 20

  return Math.round(recency + freq + unread)
}

function calcPriority(score: number): string {
  if (score >= 55) return 'priority'
  if (score >= 20) return 'normal'
  return 'muted'
}

// POST — sincroniza contatos do Evolution API → Supabase
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Busca instância ativa
  const { data: rows } = await supabaseAdmin()
    .from('instances')
    .select('id, instance_name')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  const inst = rows?.[0] ?? null
  if (!inst) return NextResponse.json({ error: 'Nenhuma instância ativa' }, { status: 404 })

  // Busca todos os chats da Evolution API
  const res = await fetch(`${EVO_URL}/chat/findChats/${inst.instance_name}`, {
    headers: { apikey: EVO_KEY },
  })

  if (!res.ok) {
    return NextResponse.json({ error: `Evolution API: ${res.status}` }, { status: 500 })
  }

  const raw = await res.json()

  // Evolution API pode retornar array direto, { chats: [] } ou outro wrapper
  const chats: Record<string, unknown>[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.chats)
      ? raw.chats
      : Array.isArray(raw?.data)
        ? raw.data
        : []

  if (chats.length === 0) {
    return NextResponse.json({
      error: 'Evolution API não retornou chats',
      debug: { type: typeof raw, keys: raw && typeof raw === 'object' ? Object.keys(raw) : null, sample: JSON.stringify(raw).slice(0, 300) },
    }, { status: 500 })
  }

  // Campo de ID: pode ser "id" ou "remoteJid"
  const getId = (c: Record<string, unknown>): string =>
    (c.remoteJid as string) || (c.id as string) || ''

  // Filtra apenas contatos individuais (ignora grupos @g.us e status)
  const individual = chats.filter(c => {
    const jid = getId(c)
    return jid.endsWith('@s.whatsapp.net')
  })

  // Busca contatos já classificados manualmente para não sobrescrever
  const { data: existingManual } = await supabaseAdmin()
    .from('contacts')
    .select('remote_jid')
    .eq('instance_id', inst.id)
    .eq('classified_manually', true)

  const manualJids = new Set((existingManual || []).map((c: { remote_jid: string }) => c.remote_jid as string))

  // Monta os upserts
  const upserts = individual.map((chat) => {
    const jid = getId(chat)
    const name = (chat.name || chat.pushName || chat.verifiedName || null) as string | null
    const lastMsg = chat.lastMessage as { messageTimestamp?: number } | null
    const lastTs = lastMsg?.messageTimestamp ?? null
    const unread = (chat.unreadCount as number) ?? 0
    const score = calcScore(lastTs, unread, 0)
    const isManual = manualJids.has(jid)

    return {
      instance_id: inst.id,
      remote_jid: jid,
      name,
      auto_score: score,
      msg_count_30d: 0,
      last_interaction: lastTs ? new Date(lastTs * 1000).toISOString() : null,
      ...(isManual ? {} : { priority: calcPriority(score) }),
    }
  })

  // Upsert em lotes de 200 para não sobrecarregar
  const BATCH = 200
  let inserted = 0
  for (let i = 0; i < upserts.length; i += BATCH) {
    const batch = upserts.slice(i, i + BATCH)
    await supabaseAdmin()
      .from('contacts')
      .upsert(batch, { onConflict: 'instance_id,remote_jid', ignoreDuplicates: false })
    inserted += batch.length
  }

  // Contagem por prioridade
  const counts = upserts.reduce((acc, c) => {
    const p = (c as { priority?: string }).priority || 'manual'
    acc[p] = (acc[p] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return NextResponse.json({
    ok: true,
    total: inserted,
    priority: counts.priority || 0,
    normal: counts.normal || 0,
    muted: counts.muted || 0,
    manual_preserved: manualJids.size,
  })
}
