// supabase/functions/create-checkout-session/index.ts
// Deploy with: supabase functions deploy create-checkout-session
// Required secret: supabase secrets set APP_ORIGIN=https://yourapp.netlify.app

import Stripe from 'https://esm.sh/stripe@14.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });

const ALLOWED_ORIGIN = Deno.env.get('APP_ORIGIN') ?? '*';
const corsHeaders = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  // Verify the JWT and resolve the caller's org by forwarding their token.
  // createClient with the user's JWT respects RLS, so .single() only returns
  // their own profile — no spoofing possible.
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: profile, error } = await userClient
    .from('profiles')
    .select('org_id, role')
    .single();

  if (error || !profile) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  if (profile.role !== 'manager') {
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  const { priceId, orgId, email, successUrl, cancelUrl } = await req.json();

  // Confirm the orgId in the request body matches the authenticated caller's org.
  if (profile.org_id !== orgId) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: cancelUrl,
    metadata: { orgId },
    subscription_data: { metadata: { orgId } },
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
