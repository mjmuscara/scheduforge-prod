import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Btn, FormRow, Input, Spinner } from '../components/UI';
import './Auth.css';

// ── Shared left-panel + card shell ───────────────────────────────────────────
function AuthShell({ title, subtitle, children }) {
  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-logo">Schedu<span>Forge</span></div>
          <p className="auth-tagline">Modern shift scheduling for teams of all sizes.</p>
        </div>
        <div className="auth-features">
          {[
            { icon: '📅', title: 'Smart scheduling',  desc: 'Build weekly schedules in minutes with an intuitive calendar' },
            { icon: '🔄', title: 'Shift trading',      desc: 'Employees post and claim shifts with manager approval' },
            { icon: '🔔', title: 'Real-time alerts',   desc: 'Instant notifications for every schedule change' },
            { icon: '🤖', title: 'AI scheduling',      desc: 'Auto-optimize your schedule with one click' },
          ].map(f => (
            <div key={f.title} className="auth-feature">
              <span className="auth-feature-icon">{f.icon}</span>
              <div>
                <div className="auth-feature-title">{f.title}</div>
                <div className="auth-feature-desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-card">
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-sub">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Sign Up ───────────────────────────────────────────────────────────────────
export function SignUp() {
  const { signUp, isAuthenticated, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]   = useState({ companyName:'', managerName:'', email:'', password:'', confirm:'' });
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);

  // Redirect once auth state is ready
  useEffect(() => {
    if (!loading && isAuthenticated && profile) {
      navigate(profile.role === 'manager' ? '/manager/dashboard' : '/dashboard', { replace: true });
    }
  }, [loading, isAuthenticated, profile, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    if (form.password.length < 8)       return setError('Password must be at least 8 characters.');
    setBusy(true);
    try {
      await signUp({
        companyName:  form.companyName,
        managerName:  form.managerName,
        email:        form.email,
        password:     form.password,
      });
      // navigate happens via useEffect above once profile loads
    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const f = (field) => ({
    value:    form[field],
    onChange: e => setForm(p => ({ ...p, [field]: e.target.value })),
  });

  return (
    <AuthShell title="Create your account" subtitle="Start your 14-day free trial. No credit card required.">
      <form onSubmit={handleSubmit}>
        <FormRow label="Company name">
          <Input {...f('companyName')} placeholder="Acme Corp" required />
        </FormRow>
        <FormRow label="Your name">
          <Input {...f('managerName')} placeholder="Jane Smith" required />
        </FormRow>
        <FormRow label="Work email">
          <Input type="email" {...f('email')} placeholder="jane@acmecorp.com" required />
        </FormRow>
        <FormRow label="Password" hint="At least 8 characters">
          <Input type="password" {...f('password')} placeholder="••••••••" required />
        </FormRow>
        <FormRow label="Confirm password">
          <Input type="password" {...f('confirm')} placeholder="••••••••" required />
        </FormRow>
        {error && <div className="auth-error">{error}</div>}
        <Btn type="submit" variant="primary" full disabled={busy}>
          {busy ? <Spinner /> : 'Create account & start trial'}
        </Btn>
      </form>
      <p className="auth-footer">
        Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
      </p>
    </AuthShell>
  );
}

// ── Sign In ───────────────────────────────────────────────────────────────────
export function SignIn() {
  const { signIn, isAuthenticated, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]   = useState({ email:'', password:'' });
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);

  // Redirect once profile is loaded after sign-in
  useEffect(() => {
    if (!loading && isAuthenticated && profile) {
      navigate(profile.role === 'manager' ? '/manager/dashboard' : '/dashboard', { replace: true });
    }
  }, [loading, isAuthenticated, profile, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn({ email: form.email, password: form.password });
      // navigate happens via useEffect once profile loads
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const f = (field) => ({
    value:    form[field],
    onChange: e => setForm(p => ({ ...p, [field]: e.target.value })),
  });

  return (
    <AuthShell title="Sign in" subtitle="Welcome back to ScheduForge">
      <form onSubmit={handleSubmit}>
        <FormRow label="Email">
          <Input type="email" {...f('email')} placeholder="you@company.com" required />
        </FormRow>
        <FormRow label="Password">
          <Input type="password" {...f('password')} placeholder="••••••••" required />
        </FormRow>
        {error && <div className="auth-error">{error}</div>}
        <div style={{ textAlign:'right', marginBottom:12 }}>
          <Link to="/forgot-password" className="auth-link" style={{ fontSize:13 }}>Forgot password?</Link>
        </div>
        <Btn type="submit" variant="primary" full disabled={busy}>
          {busy ? <Spinner /> : 'Sign in'}
        </Btn>
      </form>
      <p className="auth-footer">
        Don't have an account? <Link to="/signup" className="auth-link">Start free trial</Link>
      </p>
    </AuthShell>
  );
}

// ── Forgot Password ───────────────────────────────────────────────────────────
export function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Reset your password" subtitle="We'll send a reset link to your email">
      {sent
        ? <div className="auth-success">✅ Check your inbox! A reset link has been sent to <strong>{email}</strong>.</div>
        : <form onSubmit={handleSubmit}>
            <FormRow label="Email address">
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
            </FormRow>
            {error && <div className="auth-error">{error}</div>}
            <Btn type="submit" variant="primary" full disabled={busy}>
              {busy ? <Spinner /> : 'Send reset link'}
            </Btn>
          </form>
      }
      <p className="auth-footer">
        <Link to="/login" className="auth-link">← Back to sign in</Link>
      </p>
    </AuthShell>
  );
}

// ── Reset Password ────────────────────────────────────────────────────────────
export function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]   = useState({ password:'', confirm:'' });
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await updatePassword(form.password);
      navigate('/login');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <AuthShell title="Set new password">
      <form onSubmit={handleSubmit}>
        <FormRow label="New password">
          <Input type="password" value={form.password} onChange={e => setForm(p=>({...p,password:e.target.value}))} placeholder="••••••••" required />
        </FormRow>
        <FormRow label="Confirm password">
          <Input type="password" value={form.confirm} onChange={e => setForm(p=>({...p,confirm:e.target.value}))} placeholder="••••••••" required />
        </FormRow>
        {error && <div className="auth-error">{error}</div>}
        <Btn type="submit" variant="primary" full disabled={busy}>
          {busy ? <Spinner /> : 'Set new password'}
        </Btn>
      </form>
    </AuthShell>
  );
}

// ── Accept Invite (employee onboarding) ───────────────────────────────────────
export function AcceptInvite() {
  const { acceptInvite, isAuthenticated, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [form, setForm]   = useState({ name:'', password:'', confirm:'' });
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);

  // Redirect after invite accepted and profile loaded
  useEffect(() => {
    if (!loading && isAuthenticated && profile) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, isAuthenticated, profile, navigate]);

  if (!token) return (
    <AuthShell title="Invalid invite">
      <div className="auth-error">
        This invite link is missing or invalid. Please ask your manager for a new invite.
      </div>
      <p className="auth-footer">
        <Link to="/login" className="auth-link">← Go to sign in</Link>
      </p>
    </AuthShell>
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    if (form.password.length < 8)       return setError('Password must be at least 8 characters.');
    setBusy(true);
    try {
      await acceptInvite({ token, name: form.name, password: form.password });
      // navigate happens via useEffect
    } catch (err) {
      setError(err.message || 'Failed to accept invite. The link may have expired.');
    } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Accept your invite" subtitle="You've been invited to join ScheduForge. Create your account below.">
      <form onSubmit={handleSubmit}>
        <FormRow label="Your full name">
          <Input value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="Jane Smith" required />
        </FormRow>
        <FormRow label="Password" hint="At least 8 characters">
          <Input type="password" value={form.password} onChange={e => setForm(p=>({...p,password:e.target.value}))} placeholder="••••••••" required />
        </FormRow>
        <FormRow label="Confirm password">
          <Input type="password" value={form.confirm} onChange={e => setForm(p=>({...p,confirm:e.target.value}))} placeholder="••••••••" required />
        </FormRow>
        {error && <div className="auth-error">{error}</div>}
        <Btn type="submit" variant="primary" full disabled={busy}>
          {busy ? <Spinner /> : 'Create my account'}
        </Btn>
      </form>
    </AuthShell>
  );
}
