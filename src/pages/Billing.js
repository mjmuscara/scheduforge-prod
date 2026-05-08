import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Card, Badge, Btn, Spinner, Toast } from '../components/UI';
import { useToast } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import '../components/UI.css';

const PLANS = [
  { id: 'starter',    name: 'Starter',    price: '$29/mo', employees: '15',        priceId: process.env.REACT_APP_STRIPE_STARTER_PRICE_ID,    features: ['Up to 15 employees', '2 managers', 'All core features', 'Email support'] },
  { id: 'growth',     name: 'Growth',     price: '$79/mo', employees: '75',        priceId: process.env.REACT_APP_STRIPE_GROWTH_PRICE_ID,      features: ['Up to 75 employees', 'Unlimited managers', 'Priority support', 'Analytics'] },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', employees: 'Unlimited', priceId: null,                                              features: ['Unlimited employees', 'Custom integrations', 'Dedicated support', 'SLA'] },
];

const FUNCTIONS_URL = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1`;

async function authedPost(path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${FUNCTIONS_URL}/${path}`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function Billing() {
  const { org, profile, refreshOrg } = useAuth();
  const { toast, show } = useToast();
  const currentPlan = org?.plan || 'trial';
  const hasPaidPlan = ['starter', 'growth', 'enterprise'].includes(currentPlan);

  const [upgrading, setUpgrading] = useState(null); // plan id currently redirecting
  const [portalLoading, setPortalLoading] = useState(false);

  // Handle return from Stripe checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      show('Payment successful! Your plan has been upgraded.', 'success');
      refreshOrg();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('canceled') === 'true') {
      show('Checkout canceled — no changes were made.', 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpgrade(plan) {
    if (!plan.priceId) return;
    setUpgrading(plan.id);
    try {
      const base = `${window.location.origin}/billing`;
      const { url } = await authedPost('create-checkout-session', {
        priceId:    plan.priceId,
        orgId:      org.id,
        email:      profile.email,
        successUrl: `${base}?success=true`,
        cancelUrl:  `${base}?canceled=true`,
      });
      window.location.href = url;
    } catch (err) {
      show(err.message || 'Something went wrong. Please try again.', 'error');
      setUpgrading(null);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const { url } = await authedPost('customer-portal', {
        orgId:     org.id,
        returnUrl: `${window.location.origin}/billing`,
      });
      window.location.href = url;
    } catch (err) {
      show(err.message || 'Could not open billing portal.', 'error');
      setPortalLoading(false);
    }
  }

  return (
    <div className="page">
      <Toast toast={toast} />
      <PageHeader
        title="Billing & plan"
        subtitle={`${org?.name || 'Your organization'} · Current plan: ${currentPlan}`}
        action={hasPaidPlan && (
          <Btn size="sm" onClick={handleManageBilling} disabled={portalLoading}>
            {portalLoading ? <><Spinner /> Opening…</> : 'Manage billing'}
          </Btn>
        )}
      />

      {currentPlan === 'trial' && (
        <div style={{ background:'var(--amber-light)', color:'var(--amber)', border:'1px solid var(--amber)', borderRadius:'var(--radius)', padding:'12px 16px', marginBottom:20, fontSize:13.5, fontWeight:500 }}>
          ⏰ You're on a free trial (up to 5 employees). Upgrade below to add more team members.
        </div>
      )}

      <div className="billing-grid">
        {PLANS.map(plan => {
          const isCurrent  = currentPlan === plan.id;
          const isUpgrading = upgrading === plan.id;
          return (
            <Card key={plan.id} style={isCurrent ? { borderColor:'var(--accent)', boxShadow:'0 0 0 1px var(--accent)' } : {}}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div style={{ fontSize:16, fontWeight:700 }}>{plan.name}</div>
                {isCurrent && <Badge status={plan.id} />}
                {plan.id === 'growth' && !isCurrent && <span style={{ background:'var(--accent)', color:'#fff', fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:20 }}>Popular</span>}
              </div>
              <div style={{ marginBottom:14 }}>
                <span style={{ fontSize:28, fontWeight:700, letterSpacing:-1 }}>{plan.price.replace('/mo','')}</span>
                {plan.price.includes('/mo') && <span style={{ fontSize:13, color:'var(--muted)' }}>/mo</span>}
              </div>
              <ul style={{ listStyle:'none', marginBottom:18, display:'flex', flexDirection:'column', gap:7 }}>
                {plan.features.map(f => <li key={f} style={{ fontSize:13.5, color:'var(--muted)' }}>✓ {f}</li>)}
              </ul>
              {isCurrent
                ? <button className="btn btn-full" disabled>Current plan</button>
                : plan.id === 'enterprise'
                  ? <a href="mailto:sales@scheduforge.com?subject=Enterprise inquiry" className="btn btn-full" style={{ textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center' }}>Contact sales</a>
                  : <button
                      className="btn btn-primary btn-full"
                      onClick={() => handleUpgrade(plan)}
                      disabled={!!upgrading || portalLoading}
                    >
                      {isUpgrading ? <><Spinner /> Redirecting…</> : `Upgrade to ${plan.name}`}
                    </button>
              }
            </Card>
          );
        })}
      </div>

      <Card style={{ marginTop:20 }}>
        <div className="card-header"><div className="card-title">Current usage</div></div>
        <div style={{ display:'flex', gap:32, flexWrap:'wrap', fontSize:13.5 }}>
          <div><div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Plan</div><Badge status={currentPlan} /></div>
          <div><div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Employee limit</div><strong>{org?.max_employees ?? 5}</strong></div>
        </div>
      </Card>

      <style>{`.billing-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; } @media(max-width:768px){.billing-grid{grid-template-columns:1fr;}}`}</style>
    </div>
  );
}
