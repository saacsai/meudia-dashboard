import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// ⚠️ Substituir pelos Price IDs reais após criar os produtos no Stripe
const PRICES: Record<string, string> = {
  starter_mensal:      'price_STARTER_MENSAL',
  starter_trimestral:  'price_STARTER_TRIMESTRAL',
  starter_anual:       'price_STARTER_ANUAL',
  pro_mensal:          'price_PRO_MENSAL',
  pro_trimestral:      'price_PRO_TRIMESTRAL',
  pro_anual:           'price_PRO_ANUAL',
}

async function getUserInfo(req: NextRequest): Promise<{ userId: string; email: string } | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  return { userId: user.id, email: user.email || '' }
}

export async function POST(req: NextRequest) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) return NextResponse.json({ error: 'STRIPE_SECRET_KEY não configurada' }, { status: 500 })

    const { plano } = await req.json()
    const priceId = PRICES[plano]
    if (!priceId || priceId.startsWith('price_STARTER') || priceId.startsWith('price_PRO')) {
      return NextResponse.json({ error: 'Stripe ainda não configurado. Aguarde.' }, { status: 503 })
    }

    const info = await getUserInfo(req)
    if (!info) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const origin = req.headers.get('origin') || 'https://meudia.com.br'
    const stripe = new Stripe(secretKey)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: info.email,
      client_reference_id: info.userId,
      success_url: `${origin}/dashboard?upgrade=success`,
      cancel_url: `${origin}/dashboard?upgrade=cancelled`,
      locale: 'pt-BR',
      payment_method_types: ['card'],
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
