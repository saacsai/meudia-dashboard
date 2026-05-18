import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55') && digits.length >= 12) return digits
  return '55' + digits
}

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

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data } = await supabaseAdmin()
    .from('users')
    .select('email, full_name, whatsapp')
    .eq('id', user.id)
    .single()

  return NextResponse.json(data ?? { email: user.email ?? '', full_name: '', whatsapp: '' })
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { full_name, whatsapp } = await req.json()

  const { error } = await supabaseAdmin()
    .from('users')
    .upsert({
      id: user.id,
      email: user.email ?? '',
      full_name,
      whatsapp: normalizePhone(whatsapp || ''),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
