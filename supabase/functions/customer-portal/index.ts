// supabase/functions/customer-portal/index.ts
// Deploy with: supabase functions deploy customer-portal
// Required secret: supabase secrets set APP_ORIGIN=https://yourapp.netlify.app

import Stripe from 'https://esm.sh/stripe@14.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe   = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

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
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: profile, error } = await userClient
    .from('profiles')
    .select('org_id, role')
    .single();

  if (error || !profile || profile.role !== 'manager') {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const { orgId, returnUrl } = await req.json();

  // Confirm the orgId in the request body matches the authenticated caller's org.
  if (profile.org_id !== orgId) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', orgId)
    .single();

  if (!org?.stripe_customer_id) {
    return new Response('No billing account found', { status: 404, headers: corsHeaders });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer:   org.stripe_customer_id,
    return_url: returnUrl,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
