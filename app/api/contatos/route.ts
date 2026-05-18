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

// PATCH — atualiza prioridade de um contato
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id, priority } = await req.json()
  if (!id || !priority) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })

  // Verifica que o contato pertence a uma instância do usuário
  const { data: rows } = await supabaseAdmin()
    .from('instances')
    .select('id')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  const inst = rows?.[0] ?? null
  if (!inst) return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })

  const { data, error } = await supabaseAdmin()
    .from('contacts')
    .update({ priority, classified_manually: true })
    .eq('id', id)
    .eq('instance_id', inst.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
