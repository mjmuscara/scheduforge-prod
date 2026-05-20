import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

// ── Profile cache helpers ─────────────────────────────────────────────────────
// Stores profile+org in localStorage so returning users skip the network query.
const CACHE_KEY = 'sf_profile_cache';

function readProfileCache(userId) {
  try {
    const p = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (!p || p.userId !== userId) return null;
    if (Date.now() - p.cachedAt > 86_400_000) return null; // 24h TTL
    return p;
  } catch { return null; }
}
function writeProfileCache(userId, profile, org) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, profile, org, cachedAt: Date.now() })); } catch {}
}
function clearProfileCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

export function AuthProvider({ children }) {
  // Read profile cache synchronously so we can skip the loading screen on refresh
  const _boot = (() => {
    try {
      const p = JSON.parse(localStorage.getItem(CACHE_KEY));
      return (p && Date.now() - p.cachedAt < 86_400_000) ? p : null;
    } catch { return null; }
  })();

  const [session,  setSession]  = useState(undefined);
  const [profile,  setProfile]  = useState(_boot?.profile || null);
  const [org,      setOrg]      = useState(_boot?.org || null);
  // If we have a cached profile, skip the loading screen entirely
  const [loading,  setLoading]  = useState(!_boot);
  const loadingRef = useRef(false);

  // ── Load profile + org ────────────────────────────────────────────────────
  async function loadProfileAndOrg(userId) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      // Race the query against an 8-second timeout so a hanging Supabase
      // connection can never block the app indefinitely.
      let result;
      try {
        result = await Promise.race([
          supabase.from('profiles').select('*, organizations(*)').eq('id', userId).single(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ]);
      } catch {
        return; // Timed out or network failure — leave existing profile state as-is
      }
      const { data: prof, error } = result;
      if (error) {
        // PGRST116 = no rows found; expected during signup before profile exists
        if (error.code !== 'PGRST116') {
          setProfile(null);
          setOrg(null);
        }
        return;
      }
      if (!prof) {
        setProfile(null);
        setOrg(null);
      } else {
        setProfile(prof);
        setOrg(prof.organizations);
        writeProfileCache(userId, prof, prof.organizations);
      }
    } finally {
      loadingRef.current = false;
    }
  }

  // ── Bootstrap on mount ────────────────────────────────────────────────────
  useEffect(() => {
    // Safety net: force loading=false after 8s so a network stall never
    // leaves the app permanently stuck on the loading screen.
    const timeout = setTimeout(() => {
      loadingRef.current = false;
      setLoading(false);
    }, 8000);

    // Use onAuthStateChange exclusively — calling getSession() alongside it
    // causes both to compete for Supabase's internal storage lock, which can
    // double the wait time and produce the 9-second loading delay.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);

      if (event === 'INITIAL_SESSION') {
        if (!session?.user) {
          clearProfileCache();
          clearTimeout(timeout);
          setLoading(false);
          return;
        }
        const cached = readProfileCache(session.user.id);
        if (cached) {
          setProfile(cached.profile);
          setOrg(cached.org);
          clearTimeout(timeout);
          setLoading(false);
          loadProfileAndOrg(session.user.id); // background refresh
        } else {
          try {
            await loadProfileAndOrg(session.user.id);
          } finally {
            clearTimeout(timeout);
            setLoading(false);
          }
        }
        return;
      }

      if (session?.user) {
        await loadProfileAndOrg(session.user.id);
      } else {
        setProfile(null);
        setOrg(null);
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

    // Fetch profile directly after RPC creates it — bypasses loadingRef so we
    // don't race with the onAuthStateChange call that fired before the row existed.
    const { data: prof } = await supabase
      .from('profiles')
      .select('*, organizations(*)')
      .eq('id', userId)
      .single();
    if (prof) {
      setProfile(prof);
      setOrg(prof.organizations);
      writeProfileCache(userId, prof, prof.organizations);
    }
  }, []);

  // ── Sign in ───────────────────────────────────────────────────────────────
  const signIn = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data?.user) await loadProfileAndOrg(data.user.id);
  }, []);

  // ── Sign out ──────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    clearProfileCache();
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
      role:              invite.role || 'employee',
      position:          invite.position,
      department:        invite.department,
      avatar_color:      color,
      avatar_text_color: textColor,
      reports_to:        invite.invited_by,
    });
    if (profErr) throw profErr;

    await supabase.from('invites').update({ accepted: true }).eq('id', invite.id);
    await supabase.from('notifications').insert([
      {
        org_id:  invite.org_id,
        user_id: authData.user.id,
        text:    'Welcome to ScheduForge! Your manager will post your schedule soon.',
      },
      {
        org_id:  invite.org_id,
        user_id: invite.invited_by,
        text:    `${name || invite.name} accepted your invite and joined the team.`,
      },
    ]);

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
      writeProfileCache(authData.user.id, prof, prof.organizations);
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

  // session===undefined means getSession() hasn't resolved yet; treat a cached
  // profile as authenticated to avoid a redirect flash on refresh.
  const isAuthenticated = session === undefined ? !!profile : !!session && !!profile;
  const isOwner  = profile?.role === 'owner';
  const isManager = profile?.role === 'manager' || profile?.role === 'owner';

  return (
    <AuthContext.Provider value={{
      session, profile, org, loading,
      isAuthenticated, isManager, isOwner,
      signUp, signIn, signOut, acceptInvite,
      sendPasswordReset, updatePassword, refreshOrg,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
