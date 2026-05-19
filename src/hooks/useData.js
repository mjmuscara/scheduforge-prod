import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ── Toast hook ────────────────────────────────────────────────────────────────
export function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);
  return { toast, show };
}

// ── Module-level cache (persists across component mounts, clears on page refresh) ──
const _cache = new Map();
const CACHE_TTL = 90_000; // 90 seconds
function getCache(key) {
  if (!key) return undefined;
  const e = _cache.get(key);
  return (e && Date.now() - e.ts < CACHE_TTL) ? e.data : undefined;
}
function setCache(key, data) { if (key) _cache.set(key, { data, ts: Date.now() }); }

// ── Employees ─────────────────────────────────────────────────────────────────
export function useEmployees() {
  const { org } = useAuth();
  const cKey = org ? `emp_${org.id}` : null;
  const [employees, setEmployees] = useState(() => getCache(cKey) ?? []);
  const [loading, setLoading]     = useState(() => getCache(cKey) === undefined);

  const load = useCallback(async (skipCache = false) => {
    if (!org) { setLoading(false); return; }
    const key = `emp_${org.id}`;
    if (!skipCache) {
      const cached = getCache(key);
      if (cached !== undefined) { setEmployees(cached); setLoading(false); }
    }
    try {
      const { data } = await supabase
        .from('profiles').select('*')
        .eq('org_id', org.id).eq('role', 'employee').eq('is_active', true).order('name');
      const result = data || [];
      setCache(key, result); setEmployees(result);
    } finally { setLoading(false); }
  }, [org]);

  useEffect(() => { load(); }, [load]);
  return { employees, loading, reload: useCallback(() => load(true), [load]) };
}

// ── All team members (employees + managers, excluding owners) ─────────────────
export function useTeamMembers() {
  const { org } = useAuth();
  const cKey = org ? `team_${org.id}` : null;
  const [members, setMembers] = useState(() => getCache(cKey) ?? []);
  const [loading, setLoading] = useState(() => getCache(cKey) === undefined);

  const load = useCallback(async (skipCache = false) => {
    if (!org) { setLoading(false); return; }
    const key = `team_${org.id}`;
    if (!skipCache) {
      const cached = getCache(key);
      if (cached !== undefined) { setMembers(cached); setLoading(false); }
    }
    try {
      const { data } = await supabase
        .from('profiles').select('*')
        .eq('org_id', org.id).neq('role', 'owner').eq('is_active', true).order('name');
      const result = data || [];
      setCache(key, result); setMembers(result);
    } finally { setLoading(false); }
  }, [org]);

  useEffect(() => { load(); }, [load]);
  return { members, loading, reload: useCallback(() => load(true), [load]) };
}

// ── Direct reports (people whose reports_to = current user) ──────────────────
export function useDirectReports() {
  const { org, profile } = useAuth();
  const cKey = org && profile ? `dr_${org.id}_${profile.id}` : null;
  const [reports, setReports] = useState(() => getCache(cKey) ?? []);
  const [loading, setLoading] = useState(() => getCache(cKey) === undefined);

  const load = useCallback(async (skipCache = false) => {
    if (!org || !profile) { setLoading(false); return; }
    const key = `dr_${org.id}_${profile.id}`;
    if (!skipCache) {
      const cached = getCache(key);
      if (cached !== undefined) { setReports(cached); setLoading(false); }
    }
    try {
      const { data } = await supabase
        .from('profiles').select('*')
        .eq('org_id', org.id).eq('reports_to', profile.id).eq('is_active', true).order('name');
      const result = data || [];
      setCache(key, result); setReports(result);
    } finally { setLoading(false); }
  }, [org, profile]);

  useEffect(() => { load(); }, [load]);
  return { reports, loading, reload: useCallback(() => load(true), [load]) };
}

// ── Shifts for a given week ───────────────────────────────────────────────────
export function useShifts(weekStart, weekEnd) {
  const { org } = useAuth();
  const cKey = org && weekStart ? `shifts_${org.id}_${weekStart}_${weekEnd}` : null;
  const [shifts, setShifts]   = useState(() => getCache(cKey) ?? []);
  const [loading, setLoading] = useState(() => getCache(cKey) === undefined);

  const load = useCallback(async (skipCache = false) => {
    if (!org || !weekStart) { setLoading(false); return; }
    const key = `shifts_${org.id}_${weekStart}_${weekEnd}`;
    if (!skipCache) {
      const cached = getCache(key);
      if (cached !== undefined) { setShifts(cached); setLoading(false); }
    }
    try {
      const { data } = await supabase
        .from('shifts')
        .select('*, employee:profiles(id,name,avatar_color,avatar_text_color,position,department)')
        .eq('org_id', org.id)
        .gte('shift_date', weekStart).lte('shift_date', weekEnd)
        .order('shift_date').order('start_time');
      const result = data || [];
      setCache(key, result); setShifts(result);
    } finally { setLoading(false); }
  }, [org, weekStart, weekEnd]);

  useEffect(() => { load(); }, [load]);
  return { shifts, loading, reload: useCallback(() => load(true), [load]) };
}

// ── My shifts (employee) ──────────────────────────────────────────────────────
export function useMyShifts(weekStart, weekEnd) {
  const { profile } = useAuth();
  const cKey = profile ? `myShifts_${profile.id}_${weekStart}_${weekEnd}` : null;
  const [shifts, setShifts]   = useState(() => getCache(cKey) ?? []);
  const [loading, setLoading] = useState(() => getCache(cKey) === undefined);

  const load = useCallback(async (skipCache = false) => {
    if (!profile) { setLoading(false); return; }
    const key = `myShifts_${profile.id}_${weekStart}_${weekEnd}`;
    if (!skipCache) {
      const cached = getCache(key);
      if (cached !== undefined) { setShifts(cached); setLoading(false); }
    }
    try {
      let query = supabase.from('shifts').select('*').eq('employee_id', profile.id).order('shift_date');
      if (weekStart) query = query.gte('shift_date', weekStart);
      if (weekEnd)   query = query.lte('shift_date', weekEnd);
      const { data } = await query;
      const result = data || [];
      setCache(key, result); setShifts(result);
    } finally { setLoading(false); }
  }, [profile, weekStart, weekEnd]);

  useEffect(() => { load(); }, [load]);
  return { shifts, loading, reload: useCallback(() => load(true), [load]) };
}

// ── Available shifts ──────────────────────────────────────────────────────────
export function useAvailableShifts() {
  const { org, profile } = useAuth();
  const cKey = org ? `avail_${org.id}_${profile?.id}` : null;
  const [available, setAvailable] = useState(() => getCache(cKey) ?? []);
  const [loading, setLoading]     = useState(() => getCache(cKey) === undefined);

  const load = useCallback(async (skipCache = false) => {
    if (!org) { setLoading(false); return; }
    const key = `avail_${org.id}_${profile?.id}`;
    if (!skipCache) {
      const cached = getCache(key);
      if (cached !== undefined) { setAvailable(cached); setLoading(false); }
    }
    try {
      const { data } = await supabase
        .from('available_shifts')
        .select(`*, shift:shifts(*), posted_by_profile:profiles!available_shifts_posted_by_fkey(id,name,avatar_color,avatar_text_color)`)
        .eq('org_id', org.id).eq('is_open', true).neq('posted_by', profile?.id)
        .order('created_at', { ascending: false });
      const result = data || [];
      setCache(key, result); setAvailable(result);
    } finally { setLoading(false); }
  }, [org, profile]);

  useEffect(() => { load(); }, [load]);
  return { available, loading, reload: useCallback(() => load(true), [load]) };
}

// ── Shift requests ────────────────────────────────────────────────────────────
export function useShiftRequests() {
  const { org } = useAuth();
  const cKey = org ? `shiftReqs_${org.id}` : null;
  const [requests, setRequests] = useState(() => getCache(cKey) ?? []);
  const [loading, setLoading]   = useState(() => getCache(cKey) === undefined);

  const load = useCallback(async (skipCache = false) => {
    if (!org) { setLoading(false); return; }
    const key = `shiftReqs_${org.id}`;
    if (!skipCache) {
      const cached = getCache(key);
      if (cached !== undefined) { setRequests(cached); setLoading(false); }
    }
    try {
      const { data } = await supabase
        .from('shift_requests')
        .select(`*, requester:profiles!shift_requests_requester_id_fkey(id,name,avatar_color,avatar_text_color), available_shift:available_shifts(*, shift:shifts(*))`)
        .eq('org_id', org.id).order('created_at', { ascending: false });
      const result = data || [];
      setCache(key, result); setRequests(result);
    } finally { setLoading(false); }
  }, [org]);

  useEffect(() => { load(); }, [load]);
  return { requests, loading, reload: useCallback(() => load(true), [load]) };
}

// ── My requests (employee) ────────────────────────────────────────────────────
export function useMyRequests() {
  const { profile } = useAuth();
  const cKey = profile ? `myReqs_${profile.id}` : null;
  const [requests, setRequests] = useState(() => getCache(cKey) ?? []);
  const [loading, setLoading]   = useState(() => getCache(cKey) === undefined);

  const load = useCallback(async (skipCache = false) => {
    if (!profile) { setLoading(false); return; }
    const key = `myReqs_${profile.id}`;
    if (!skipCache) {
      const cached = getCache(key);
      if (cached !== undefined) { setRequests(cached); setLoading(false); }
    }
    try {
      const { data } = await supabase
        .from('shift_requests')
        .select(`*, available_shift:available_shifts(*, shift:shifts(*))`)
        .eq('requester_id', profile.id).order('created_at', { ascending: false });
      const result = data || [];
      setCache(key, result); setRequests(result);
    } finally { setLoading(false); }
  }, [profile]);

  useEffect(() => { load(); }, [load]);
  return { requests, loading, reload: useCallback(() => load(true), [load]) };
}

// ── Notifications (real-time) ─────────────────────────────────────────────────
export function useNotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const channelRef = useRef(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications').select('*')
      .eq('user_id', profile.id).order('created_at', { ascending: false }).limit(50);
    setNotifications(data || []);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    load();
    const channelName = `notif-${profile.id}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => { setNotifications(prev => [payload.new, ...prev]); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => { setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n)); });
    channel.subscribe();
    channelRef.current = channel;
    return () => { if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; } };
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const markAllRead = useCallback(async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, [profile]);

  const unreadCount = notifications.filter(n => !n.read).length;
  return { notifications, unreadCount, reload: load, markAllRead };
}

// ── Schedule ──────────────────────────────────────────────────────────────────
export function useSchedule(weekStartISO) {
  const { org } = useAuth();
  const cKey = org && weekStartISO ? `sched_${org.id}_${weekStartISO}` : null;
  const [schedule, setSchedule] = useState(() => {
    const c = getCache(cKey); return c !== undefined ? c : null;
  });

  const load = useCallback(async (skipCache = false) => {
    if (!org || !weekStartISO) return;
    const key = `sched_${org.id}_${weekStartISO}`;
    if (!skipCache) {
      const cached = getCache(key);
      if (cached !== undefined) { setSchedule(cached); }
    }
    const { data } = await supabase
      .from('schedules').select('*')
      .eq('org_id', org.id).eq('week_start', weekStartISO).maybeSingle();
    setCache(key, data ?? null); setSchedule(data ?? null);
  }, [org, weekStartISO]);

  useEffect(() => { load(); }, [load]);

  const ensureSchedule = useCallback(async (managerId) => {
    if (schedule) return schedule;
    const { data } = await supabase
      .from('schedules')
      .insert({ org_id: org.id, manager_id: managerId, week_start: weekStartISO, published: false })
      .select().single();
    const key = `sched_${org.id}_${weekStartISO}`;
    setCache(key, data); setSchedule(data);
    return data;
  }, [org, weekStartISO, schedule]);

  const publish = useCallback(async (employeeIds) => {
    if (!schedule) return;
    await supabase.from('schedules').update({ published: true, published_at: new Date().toISOString() }).eq('id', schedule.id);
    const notifs = employeeIds.map(uid => ({ org_id: org.id, user_id: uid, text: 'Your schedule has been published. Check your shifts!' }));
    if (notifs.length > 0) await supabase.from('notifications').insert(notifs);
    const updated = { ...schedule, published: true };
    const key = `sched_${org.id}_${weekStartISO}`;
    setCache(key, updated); setSchedule(updated);
  }, [schedule, org, weekStartISO]);

  return { schedule, reload: useCallback(() => load(true), [load]), ensureSchedule, publish };
}

// ── Invites ───────────────────────────────────────────────────────────────────
export function useInvites() {
  const { org, profile } = useAuth();
  const cKey = org ? `invites_${org.id}` : null;
  const [invites, setInvites] = useState(() => getCache(cKey) ?? []);

  const load = useCallback(async (skipCache = false) => {
    if (!org) return;
    const key = `invites_${org.id}`;
    if (!skipCache) {
      const cached = getCache(key);
      if (cached !== undefined) { setInvites(cached); }
    }
    const { data } = await supabase
      .from('invites').select('*')
      .eq('org_id', org.id).eq('accepted', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    const result = data || [];
    setCache(key, result); setInvites(result);
  }, [org]);

  useEffect(() => { load(); }, [load]);

  const sendInvite = useCallback(async ({ name, email, position, department, role = 'employee' }) => {
    const now = new Date().toISOString();

    if (role === 'employee') {
      const [{ count: active }, { count: pending }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .eq('org_id', org.id).eq('role', 'employee').eq('is_active', true),
        supabase.from('invites').select('*', { count: 'exact', head: true })
          .eq('org_id', org.id).eq('role', 'employee').eq('accepted', false).gt('expires_at', now),
      ]);
      const total = (active ?? 0) + (pending ?? 0);
      if (total >= org.max_employees) {
        const planName = org.plan.charAt(0).toUpperCase() + org.plan.slice(1);
        throw new Error(`Your ${planName} plan allows up to ${org.max_employees} employees. Upgrade to add more.`);
      }
    }

    if (role === 'manager') {
      const managerLimit = org.plan === 'trial' ? 1 : org.plan === 'starter' ? 2 : null;
      if (managerLimit !== null) {
        const [{ count: active }, { count: pending }] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true })
            .eq('org_id', org.id).in('role', ['manager', 'owner']).eq('is_active', true),
          supabase.from('invites').select('*', { count: 'exact', head: true })
            .eq('org_id', org.id).eq('role', 'manager').eq('accepted', false).gt('expires_at', now),
        ]);
        if ((active ?? 0) + (pending ?? 0) >= managerLimit) {
          const planName = org.plan.charAt(0).toUpperCase() + org.plan.slice(1);
          throw new Error(`Your ${planName} plan allows up to ${managerLimit} manager${managerLimit > 1 ? 's' : ''}. Upgrade to add more.`);
        }
      }
    }

    const { data, error } = await supabase
      .from('invites')
      .insert({ org_id: org.id, name, email, position, department, invited_by: profile.id, role })
      .select().single();
    if (error) throw error;
    await load(true);
    return data;
  }, [org, profile, load]);

  const revokeInvite = useCallback(async (inviteId) => {
    const { error } = await supabase.from('invites').delete().eq('id', inviteId);
    if (error) throw error;
    await load(true);
  }, [load]);

  return { invites, sendInvite, revokeInvite, reload: useCallback(() => load(true), [load]) };
}

// ── Employee availability ─────────────────────────────────────────────────────
export function useAvailability(employeeId) {
  const { org, profile } = useAuth();
  const targetId = employeeId || profile?.id;
  const cKey = targetId ? `avail_emp_${targetId}` : null;
  const [availability, setAvailability] = useState(() => getCache(cKey) ?? []);
  const [loading, setLoading]           = useState(() => getCache(cKey) === undefined);

  const load = useCallback(async (skipCache = false) => {
    if (!targetId) { setLoading(false); return; }
    const key = `avail_emp_${targetId}`;
    if (!skipCache) {
      const cached = getCache(key);
      if (cached !== undefined) { setAvailability(cached); setLoading(false); }
    }
    try {
      const { data } = await supabase.from('availability').select('*').eq('employee_id', targetId);
      const result = data || [];
      setCache(key, result); setAvailability(result);
    } finally { setLoading(false); }
  }, [targetId]);

  useEffect(() => { load(); }, [load]);

  const saveAvailability = useCallback(async (rows) => {
    if (!org) return;
    const upsertRows = rows.map(r => ({ ...r, org_id: org.id, employee_id: targetId, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from('availability').upsert(upsertRows, { onConflict: 'employee_id,day_of_week' });
    if (error) throw error;
    await load(true);
  }, [org, targetId, load]);

  return { availability, loading, saveAvailability };
}
