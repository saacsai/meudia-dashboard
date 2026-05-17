import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const PLAN_CREDITS: Record<string, number> = {
  starter: 500,
  pro: 2000,
  business: 10000,
}

function getPlanFromPriceId(priceId: string): string {
  if (priceId.includes('starter')) return 'starter'
  if (priceId.includes('pro')) return 'pro'
  return 'starter'
}

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe não configurado' }, { status: 500 })
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Sem assinatura' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = new Stripe(secretKey).webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.client_reference_id
    if (!userId || session.mode !== 'subscription') return NextResponse.json({ ok: true })

    const stripe = new Stripe(secretKey)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub: any = await stripe.subscriptions.retrieve(session.subscription as string)
    const priceId = sub.items.data[0].price.id
    const plan = getPlanFromPriceId(priceId)
    const credits = PLAN_CREDITS[plan] || 500

    await supabase.from('subscriptions').upsert({
      user_id: userId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: session.customer as string,
      plan,
      monthly_credits: credits,
      status: 'active',
      current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    }, { onConflict: 'user_id' })

    await supabase.from('credit_balance').upsert({
      user_id: userId,
      balance: credits,
      reset_at: new Date(sub.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  if (event.type === 'customer.subscription.updated') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = event.data.object as any
    const status = sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'canceled'
    await supabase.from('subscriptions')
      .update({ status, current_period_end: new Date(sub.current_period_end * 1000).toISOString() })
      .eq('stripe_subscription_id', sub.id)
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    await supabase.from('subscriptions')
      .update({ status: 'canceled' })
      .eq('stripe_subscription_id', sub.id)
  }

  return NextResponse.json({ ok: true })
}
