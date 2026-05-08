import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session,  setSession]  = useState(undefined);
  const [profile,  setProfile]  = useState(null);
  const [org,      setOrg]      = useState(null);
  const [loading,  setLoading]  = useState(true);
  const loadingRef = useRef(false);

  // ── Load profile + org ────────────────────────────────────────────────────
  async function loadProfileAndOrg(userId) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const { data: prof, error } = await supabase
        .from('profiles')
        .select('*, organizations(*)')
        .eq('id', userId)
        .single();
      if (error || !prof) {
        setProfile(null);
        setOrg(null);
      } else {
        setProfile(prof);
        setOrg(prof.organizations);
      }
    } finally {
      loadingRef.current = false;
    }
  }

  // ── Bootstrap on mount ────────────────────────────────────────────────────
  useEffect(() => {
    // Safety net: force loading=false after 8s so a network stall never
    // leaves the app permanently stuck on the loading screen.
    const timeout = setTimeout(() => setLoading(false), 8000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        setSession(session);
        if (session?.user) await loadProfileAndOrg(session.user.id);
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        setSession(session);
        if (session?.user) {
          await loadProfileAndOrg(session.user.id);
        } else {
          setProfile(null);
          setOrg(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // ── Sign up ───────────────────────────────────────────────────────────────
  const signUp = useCallback(async ({ companyName, managerName, email, password }) => {
    const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
    if (authErr) throw authErr;
    const userId = authData.user.id;

    const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Date.now();
    const { error: fnErr } = await supabase.rpc('create_organization_and_profile', {
      org_name:      companyName,
      org_slug:      slug,
      manager_name:  managerName,
      manager_email: email,
      user_id:       userId,
    });
    if (fnErr) throw fnErr;

    await loadProfileAndOrg(userId);
  }, []);

  // ── Sign in ───────────────────────────────────────────────────────────────
  const signIn = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data?.user) await loadProfileAndOrg(data.user.id);
  }, []);

  // ── Sign out ──────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setOrg(null);
  }, []);

  // ── Accept invite (employee onboarding) ───────────────────────────────────
  const acceptInvite = useCallback(async ({ token, password, name }) => {
    const { data: invite, error: invErr } = await supabase
      .from('invites')
      .select('*')
      .eq('token', token)
      .eq('accepted', false)
      .gt('expires_at', new Date().toISOString())
      .single();
    if (invErr || !invite) throw new Error('Invalid or expired invite link.');

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: invite.email,
      password,
    });
    if (authErr) throw authErr;
    if (!authData.user) throw new Error('Failed to create account. Please try again.');

    const colors = [['#e8f0fc','#1a5fb4'],['#fef3e2','#a35c0a'],['#fdecea','#c0392b'],['#f0eeff','#5c3ab4']];
    const [color, textColor] = colors[Math.floor(Math.random() * colors.length)];
    const { error: profErr } = await supabase.from('profiles').insert({
      id:                authData.user.id,
      org_id:            invite.org_id,
      name:              name || invite.name,
      email:             invite.email,
      role:              'employee',
      position:          invite.position,
      department:        invite.department,
      avatar_color:      color,
      avatar_text_color: textColor,
    });
    if (profErr) throw profErr;

    await supabase.from('invites').update({ accepted: true }).eq('id', invite.id);
    await supabase.from('notifications').insert({
      org_id:  invite.org_id,
      user_id: authData.user.id,
      text:    'Welcome to ScheduForge! Your manager will post your schedule soon.',
    });

    // Fetch profile directly after creating it — bypasses loadingRef so we
    // don't race with the onAuthStateChange call that fires before the row exists.
    const { data: prof } = await supabase
      .from('profiles')
      .select('*, organizations(*)')
      .eq('id', authData.user.id)
      .single();
    if (prof) {
      setProfile(prof);
      setOrg(prof.organizations);
    }
  }, []);

  // ── Password reset ────────────────────────────────────────────────────────
  const sendPasswordReset = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.REACT_APP_URL}/reset-password`,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }, []);

  const refreshOrg = useCallback(async () => {
    if (session?.user) await loadProfileAndOrg(session.user.id);
  }, [session]);

  // Keep org state in sync when the Stripe webhook updates organizations.plan
  useEffect(() => {
    if (!org) return;
    const channel = supabase.channel(`org-billing-${org.id}`);
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'organizations', filter: `id=eq.${org.id}` },
      (payload) => { setOrg(payload.new); },
    );
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAuthenticated = !!session && !!profile;
  const isManager = profile?.role === 'manager';

  return (
    <AuthContext.Provider value={{
      session, profile, org, loading,
      isAuthenticated, isManager,
      signUp, signIn, signOut, acceptInvite,
      sendPasswordReset, updatePassword, refreshOrg,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
