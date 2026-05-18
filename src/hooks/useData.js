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

// ── Employees ─────────────────────────────────────────────────────────────────
export function useEmployees() {
  const { org } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!org) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('org_id', org.id)
        .eq('role', 'employee')
        .eq('is_active', true)
        .order('name');
      setEmployees(data || []);
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => { load(); }, [load]);
  return { employees, loading, reload: load };
}

// ── All team members (employees + managers, excluding owners) ─────────────────
export function useTeamMembers() {
  const { org } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!org) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('org_id', org.id)
        .neq('role', 'owner')
        .eq('is_active', true)
        .order('name');
      setMembers(data || []);
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => { load(); }, [load]);
  return { members, loading, reload: load };
}

// ── Direct reports (people whose reports_to = current user) ──────────────────
export function useDirectReports() {
  const { org, profile } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!org || !profile) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('org_id', org.id)
        .eq('reports_to', profile.id)
        .eq('is_active', true)
        .order('name');
      setReports(data || []);
    } finally {
      setLoading(false);
    }
  }, [org, profile]);

  useEffect(() => { load(); }, [load]);
  return { reports, loading, reload: load };
}

// ── Shifts for a given week ───────────────────────────────────────────────────
export function useShifts(weekStart, weekEnd) {
  const { org } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!org || !weekStart) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('shifts')
        .select('*, employee:profiles(id,name,avatar_color,avatar_text_color,position,department)')
        .eq('org_id', org.id)
        .gte('shift_date', weekStart)
        .lte('shift_date', weekEnd)
        .order('shift_date')
        .order('start_time');
      setShifts(data || []);
    } finally {
      setLoading(false);
    }
  }, [org, weekStart, weekEnd]);

  useEffect(() => { load(); }, [load]);
  return { shifts, loading, reload: load };
}

// ── My shifts (employee) ──────────────────────────────────────────────────────
export function useMyShifts(weekStart, weekEnd) {
  const { profile } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) { setLoading(false); return; }
    setLoading(true);
    try {
      let query = supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', profile.id)
        .order('shift_date');
      if (weekStart) query = query.gte('shift_date', weekStart);
      if (weekEnd)   query = query.lte('shift_date', weekEnd);
      const { data } = await query;
      setShifts(data || []);
    } finally {
      setLoading(false);
    }
  }, [profile, weekStart, weekEnd]);

  useEffect(() => { load(); }, [load]);
  return { shifts, loading, reload: load };
}

// ── Available shifts ──────────────────────────────────────────────────────────
export function useAvailableShifts() {
  const { org, profile } = useAuth();
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!org) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('available_shifts')
        .select(`
          *,
          shift:shifts(*),
          posted_by_profile:profiles!available_shifts_posted_by_fkey(id,name,avatar_color,avatar_text_color)
        `)
        .eq('org_id', org.id)
        .eq('is_open', true)
        .neq('posted_by', profile?.id)
        .order('created_at', { ascending: false });
      setAvailable(data || []);
    } finally {
      setLoading(false);
    }
  }, [org, profile]);

  useEffect(() => { load(); }, [load]);
  return { available, loading, reload: load };
}

// ── Shift requests ────────────────────────────────────────────────────────────
export function useShiftRequests() {
  const { org } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!org) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('shift_requests')
        .select(`
          *,
          requester:profiles!shift_requests_requester_id_fkey(id,name,avatar_color,avatar_text_color),
          available_shift:available_shifts(*, shift:shifts(*))
        `)
        .eq('org_id', org.id)
        .order('created_at', { ascending: false });
      setRequests(data || []);
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => { load(); }, [load]);
  return { requests, loading, reload: load };
}

// ── My requests (employee) ────────────────────────────────────────────────────
export function useMyRequests() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('shift_requests')
        .select(`*, available_shift:available_shifts(*, shift:shifts(*))`)
        .eq('requester_id', profile.id)
        .order('created_at', { ascending: false });
      setRequests(data || []);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);
  return { requests, loading, reload: load };
}

// ── Notifications (real-time) ─────────────────────────────────────────────────
export function useNotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const channelRef = useRef(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications(data || []);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    load();

    const channelName = `notif-${profile.id}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);

    channel
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => { setNotifications(prev => [payload.new, ...prev]); })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => { setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n)); });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const markAllRead = useCallback(async () => {
    if (!profile) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', profile.id)
      .eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, [profile]);

  const unreadCount = notifications.filter(n => !n.read).length;
  return { notifications, unreadCount, reload: load, markAllRead };
}

// ── Schedule ──────────────────────────────────────────────────────────────────
export function useSchedule(weekStartISO) {
  const { org } = useAuth();
  const [schedule, setSchedule] = useState(null);

  const load = useCallback(async () => {
    if (!org || !weekStartISO) return;
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('org_id', org.id)
      .eq('week_start', weekStartISO)
      .maybeSingle();
    setSchedule(data);
  }, [org, weekStartISO]);

  useEffect(() => { load(); }, [load]);

  const ensureSchedule = useCallback(async (managerId) => {
    if (schedule) return schedule;
    const weekEnd = new Date(weekStartISO);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const { data } = await supabase
      .from('schedules')
      .insert({ org_id: org.id, manager_id: managerId, week_start: weekStartISO, published: false })
      .select()
      .single();
    setSchedule(data);
    return data;
  }, [org, weekStartISO, schedule]);

  const publish = useCallback(async (employeeIds) => {
    if (!schedule) return;
    await supabase.from('schedules').update({ published: true, published_at: new Date().toISOString() }).eq('id', schedule.id);
    // Notify all employees
    const notifs = employeeIds.map(uid => ({
      org_id: org.id, user_id: uid,
      text: 'Your schedule has been published. Check your shifts!',
    }));
    if (notifs.length > 0) await supabase.from('notifications').insert(notifs);
    setSchedule(s => ({ ...s, published: true }));
  }, [schedule, org]);

  return { schedule, reload: load, ensureSchedule, publish };
}

// ── Invites ───────────────────────────────────────────────────────────────────
export function useInvites() {
  const { org, profile } = useAuth();
  const [invites, setInvites] = useState([]);

  const load = useCallback(async () => {
    if (!org) return;
    const { data } = await supabase
      .from('invites')
      .select('*')
      .eq('org_id', org.id)
      .eq('accepted', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    setInvites(data || []);
  }, [org]);

  useEffect(() => { load(); }, [load]);

  const sendInvite = useCallback(async ({ name, email, position, department, role = 'employee' }) => {
    const { data, error } = await supabase
      .from('invites')
      .insert({ org_id: org.id, name, email, position, department, invited_by: profile.id, role })
      .select()
      .single();
    if (error) throw error;
    await load();
    return data;
  }, [org, profile, load]);

  const revokeInvite = useCallback(async (inviteId) => {
    await supabase.from('invites').delete().eq('id', inviteId);
    await load();
  }, [load]);

  return { invites, sendInvite, revokeInvite, reload: load };
}

// ── Employee availability ─────────────────────────────────────────────────────
export function useAvailability(employeeId) {
  const { org, profile } = useAuth();
  const targetId = employeeId || profile?.id;
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!targetId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('availability')
        .select('*')
        .eq('employee_id', targetId);
      setAvailability(data || []);
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => { load(); }, [load]);

  const saveAvailability = useCallback(async (rows) => {
    if (!org) return;
    const upsertRows = rows.map(r => ({
      ...r,
      org_id: org.id,
      employee_id: targetId,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('availability')
      .upsert(upsertRows, { onConflict: 'employee_id,day_of_week' });
    if (error) throw error;
    await load();
  }, [org, targetId, load]);

  return { availability, loading, saveAvailability };
}
