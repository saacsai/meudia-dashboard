import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

// GET — lista contatos da instância ativa
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: rows } = await supabaseAdmin()
    .from('instances')
    .select('id')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  const inst = rows?.[0] ?? null
  if (!inst) return NextResponse.json([])

  const { data, error } = await supabaseAdmin()
    .from('contacts')
    .select('id, name, remote_jid, priority, auto_score, msg_count_30d, last_interaction, classified_manually')
    .eq('instance_id', inst.id)
    .order('auto_score', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// PATCH — atualiza um contato (id) ou vários em bulk (ids[])
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { id, ids, priority, name } = body

  const { data: rows } = await supabaseAdmin()
    .from('instances')
    .select('id')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  const inst = rows?.[0] ?? null
  if (!inst) return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })

  // Bulk update (ids[])
  if (ids && Array.isArray(ids) && priority) {
    const { error } = await supabaseAdmin()
      .from('contacts')
      .update({ priority, classified_manually: true })
      .in('id', ids)
      .eq('instance_id', inst.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, updated: ids.length })
  }

  // Single update
  if (!id || (!priority && name === undefined))
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (priority) { update.priority = priority; update.classified_manually = true }
  if (name !== undefined) { update.name = name; update.name_locked = true }

  const { data, error } = await supabaseAdmin()
    .from('contacts')
    .update(update)
    .eq('id', id)
    .eq('instance_id', inst.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
