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

// Called once on first login when no instance exists for the user.
// Creates users row + instances row with onboarding defaults.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = db()

  // Upsert users row
  await supabase.from('users').upsert({
    id: user.id,
    email: user.email ?? '',
    full_name: user.user_metadata?.full_name ?? '',
  }, { onConflict: 'id' })

  // Check if instance already exists (race condition guard)
  const { data: existing } = await supabase
    .from('instances')
    .select('id, onboarding_completed, onboarding_step')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(existing[0])
  }

  // Create new instance with onboarding defaults
  const { data: instance, error } = await supabase
    .from('instances')
    .insert({
      user_id: user.id,
      active: true,
      onboarding_completed: false,
      onboarding_step: 0,
    })
    .select('id, onboarding_completed, onboarding_step')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(instance)
}
