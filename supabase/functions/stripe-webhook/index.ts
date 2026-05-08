// supabase/functions/stripe-webhook/index.ts
// Deploy with: supabase functions deploy stripe-webhook
// Set webhook in Stripe Dashboard → Developers → Webhooks → Add endpoint
// Endpoint URL: https://your-project.supabase.co/functions/v1/stripe-webhook
// Events to listen: customer.subscription.created, updated, deleted

import Stripe from 'https://esm.sh/stripe@14.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const PLAN_MAP: Record<string, { plan: string; maxEmployees: number }> = {
  [Deno.env.get('STRIPE_STARTER_PRICE_ID') || '']: { plan: 'starter', maxEmployees: 15 },
  [Deno.env.get('STRIPE_GROWTH_PRICE_ID')  || '']: { plan: 'growth',  maxEmployees: 75 },
  [Deno.env.get('STRIPE_ENTERPRISE_PRICE_ID') || '']: { plan: 'enterprise', maxEmployees: 99999 },
};

Deno.serve(async (req) => {
  const body      = await req.text();
  const signature = req.headers.get('stripe-signature')!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!);
  } catch (err) {
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  const sub = event.data.object as Stripe.Subscription;
  const orgId    = sub.metadata?.orgId;
  const priceId  = sub.items?.data[0]?.price?.id;
  const planInfo = PLAN_MAP[priceId] || { plan: 'starter', maxEmployees: 15 };

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    await supabase.from('organizations').update({
      plan: planInfo.plan,
      max_employees: planInfo.maxEmployees,
      stripe_customer_id: sub.customer as string,
      stripe_subscription_id: sub.id,
      plan_expires_at: new Date(sub.current_period_end * 1000).toISOString(),
    }).eq('id', orgId);
  }

  if (event.type === 'customer.subscription.deleted') {
    await supabase.from('organizations').update({ plan: 'trial', max_employees: 5, stripe_subscription_id: null }).eq('id', orgId);
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
