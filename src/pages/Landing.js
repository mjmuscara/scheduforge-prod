import React from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

const FEATURES = [
  {
    icon: '📅',
    title: 'Build schedules in minutes',
    body: 'Assign shifts on a clean weekly grid and publish to your entire team with one click. No spreadsheets, no back-and-forth.',
  },
  {
    icon: '🔄',
    title: 'Seamless shift coverage',
    body: 'Employees post shifts they need covered. Coworkers claim them, managers approve — all in the app. No group texts required.',
  },
  {
    icon: '🔔',
    title: 'Real-time notifications',
    body: 'Managers and staff get instant alerts when schedules are published, requests are approved, or shifts become available.',
  },
];

const STEPS = [
  {
    n: '1',
    title: 'Create your account',
    body: 'Sign up as a manager and set up your organization in under a minute.',
  },
  {
    n: '2',
    title: 'Invite your team',
    body: 'Send invite links to employees. They join with a single click — no IT setup needed.',
  },
  {
    n: '3',
    title: 'Build and publish',
    body: 'Assign shifts on the weekly grid and publish when you\'re ready. Employees see their schedule instantly.',
  },
];

const PLANS = [
  {
    name: 'Trial',
    price: 'Free',
    period: null,
    limit: 'Up to 5 employees',
    features: ['5 employee limit', 'Full scheduling tools', 'Shift coverage flow', 'Real-time notifications'],
    cta: 'Start for free',
    href: '/signup',
    highlight: false,
  },
  {
    name: 'Starter',
    price: '$29',
    period: '/mo',
    limit: 'Up to 15 employees',
    features: ['15 employees', '2 managers', 'All core features', 'Email support'],
    cta: 'Get Starter',
    href: '/signup',
    highlight: false,
  },
  {
    name: 'Growth',
    price: '$79',
    period: '/mo',
    limit: 'Up to 75 employees',
    features: ['75 employees', 'Unlimited managers', 'Priority support', 'Analytics'],
    cta: 'Get Growth',
    href: '/signup',
    highlight: true,
    badge: 'Most popular',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: null,
    contact: 'Talk to us',
    limit: 'Unlimited employees',
    features: ['Unlimited employees', 'Custom integrations', 'Dedicated support', 'SLA guarantee'],
    cta: 'Contact sales',
    href: 'mailto:sales@scheduforge.com?subject=Enterprise inquiry',
    highlight: false,
    external: true,
  },
];

export default function Landing() {
  return (
    <div className="land">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="land-nav">
        <div className="land-logo">ScheduForge</div>
        <div className="land-nav-links">
          <a href="#features" className="land-nav-link">Features</a>
          <a href="#pricing" className="land-nav-link">Pricing</a>
        </div>
        <div className="land-nav-actions">
          <Link to="/login" className="land-nav-signin">Sign in</Link>
          <Link to="/signup" className="land-cta-btn">Get started free</Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="land-hero">
        <div className="land-badge">Free trial · No credit card required</div>
        <h1 className="land-h1">
          Scheduling your team<br />will actually use.
        </h1>
        <p className="land-sub">
          ScheduForge makes it easy to build weekly schedules, handle shift coverage, and keep your team in sync — all in one place.
        </p>
        <div className="land-ctas">
          <Link to="/signup" className="land-cta-btn land-cta-lg">Start for free →</Link>
          <Link to="/login" className="land-cta-ghost">Sign in</Link>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="land-features" id="features">
        <div className="land-section-label">Features</div>
        <h2 className="land-h2">Everything your team needs</h2>
        <p className="land-section-sub">
          From scheduling to shift coverage to notifications — ScheduForge handles it all so you can focus on running your business.
        </p>
        <div className="land-feat-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="land-feat-card">
              <div className="land-feat-icon">{f.icon}</div>
              <div className="land-feat-title">{f.title}</div>
              <div className="land-feat-body">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="land-steps">
        <div className="land-section-label">How it works</div>
        <h2 className="land-h2">Up and running in minutes</h2>
        <p className="land-section-sub">
          No training sessions, no onboarding calls. ScheduForge is built to be obvious from day one.
        </p>
        <div className="land-steps-grid">
          {STEPS.map(s => (
            <div key={s.n} className="land-step">
              <div className="land-step-num">{s.n}</div>
              <div className="land-step-title">{s.title}</div>
              <div className="land-step-body">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section className="land-pricing" id="pricing">
        <div className="land-section-label">Pricing</div>
        <h2 className="land-h2">Simple, transparent pricing</h2>
        <p className="land-section-sub">
          Start free, upgrade as your team grows. No hidden fees.
        </p>
        <div className="land-price-grid">
          {PLANS.map(p => (
            <div key={p.name} className={`land-price-card${p.highlight ? ' highlight' : ''}`}>
              {p.badge && <div className="land-price-badge">{p.badge}</div>}
              <div className="land-price-name">{p.name}</div>
              <div className="land-price-amount">
                <span className="land-price-num">{p.price}</span>
                {p.period && <span className="land-price-period">{p.period}</span>}
              </div>
              {p.contact && <div className="land-price-contact">{p.contact}</div>}
              <div className="land-price-limit">{p.limit}</div>
              <ul className="land-price-feats">
                {p.features.map(f => <li key={f}>✓ {f}</li>)}
              </ul>
              {p.external
                ? <a href={p.href} className={`land-price-cta${p.highlight ? ' primary' : ''}`}>{p.cta}</a>
                : <Link to={p.href} className={`land-price-cta${p.highlight ? ' primary' : ''}`}>{p.cta}</Link>
              }
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="land-footer">
        <div className="land-footer-logo">ScheduForge</div>
        <div className="land-footer-links">
          <Link to="/login">Sign in</Link>
          <Link to="/signup">Create account</Link>
          <a href="mailto:sales@scheduforge.com">Contact</a>
        </div>
        <div className="land-footer-copy">© {new Date().getFullYear()} ScheduForge. All rights reserved.</div>
      </footer>

    </div>
  );
}
