import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMyShifts, useAvailableShifts, useMyRequests, useNotifications, useAvailability, useToast } from '../hooks/useData';
import { Btn, Card, Badge, Avatar, StatCard, Modal, FormRow, Input, EmptyState, PageHeader, Toast, Spinner, LoadingScreen } from '../components/UI';
import { fmtDate, fmtTime, getWeekStart, addDays, toISO, buildWeek, colorFor } from '../utils/dates';
import { supabase } from '../lib/supabase';
import '../components/UI.css';

// ── Employee Dashboard ────────────────────────────────────────────────────────
export function EmployeeDashboard() {
  const { profile, org } = useAuth();
  const navigate = useNavigate();
  const { toast, show } = useToast();
  const weekStart = toISO(getWeekStart(new Date()));
  const weekEnd   = toISO(addDays(getWeekStart(new Date()),6));
  const { shifts: myShifts, loading } = useMyShifts(weekStart, weekEnd);
  const { available } = useAvailableShifts();
  const { requests } = useMyRequests();
  const { unreadCount } = useNotifications();
  const [postModal, setPostModal] = useState(null);
  const [reason, setReason] = useState('');
  const [postedIds, setPostedIds] = useState(new Set());

  useEffect(() => {
    if (!profile) return;
    supabase.from('available_shifts').select('shift_id').eq('posted_by', profile.id).eq('is_open', true)
      .then(({ data }) => setPostedIds(new Set((data || []).map(r => r.shift_id))));
  }, [profile]);

  const pending = requests.filter(r => r.status === 'pending').length;
  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? 'Good morning' : greetHour < 17 ? 'Good afternoon' : 'Good evening';

  async function handlePost(e) {
    e.preventDefault();
    if (!reason.trim()) return;
    await supabase.from('available_shifts').insert({ org_id: org.id, shift_id: postModal.id, posted_by: profile.id, reason }).select().single();
    const { data: others } = await supabase.from('profiles').select('id').eq('org_id', org.id).eq('role','employee').neq('id', profile.id);
    if (others?.length) await supabase.from('notifications').insert(others.map(u => ({ org_id: org.id, user_id: u.id, text: `New shift available: ${postModal.position} on ${postModal.shift_date}. Tap to claim.` })));
    setPostedIds(prev => new Set([...prev, postModal.id]));
    show('Shift posted for coverage!');
    setPostModal(null); setReason('');
  }

  async function handleClaim(availId) {
    const existing = requests.find(r => r.available_shift_id === availId && r.status === 'pending');
    if (existing) return show('You already requested this shift.', 'error');
    await supabase.from('shift_requests').insert({ org_id: org.id, available_shift_id: availId, requester_id: profile.id, status: 'pending' });
    const avail = available.find(a => a.id === availId);
    const { data: mgrs } = await supabase.from('profiles').select('id').eq('org_id', org.id).in('role',['manager','owner']);
    if (mgrs?.length) await supabase.from('notifications').insert(mgrs.map(m => ({ org_id: org.id, user_id: m.id, text: `${profile.name} requested to cover ${avail?.shift?.position} on ${avail?.shift?.shift_date}.` })));
    show('Request submitted!');
  }

  if (loading) return <LoadingScreen />;

  return (
    <div className="page">
      <Toast toast={toast} />
      <PageHeader title={`${greeting}, ${profile?.name?.split(' ')[0]} 👋`} subtitle={new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })} />
      <div className="stats-grid">
        <StatCard label="This week's shifts" value={myShifts.length} sub={`${myShifts.reduce((a,s)=>a+(+s.duration_hours),0)} hours`} />
        <StatCard label="Pending requests" value={pending} color={pending>0?'var(--amber)':undefined} sub="Awaiting approval" />
        <StatCard label="Open shifts" value={available.length} color="var(--accent)" sub="Available to claim" />
        <StatCard label="Unread alerts" value={unreadCount} color={unreadCount>0?'var(--red)':undefined} sub="Notifications" />
      </div>
      <div className="grid-2">
        <Card>
          <div className="card-header"><div className="card-title">Upcoming shifts</div><Btn size="sm" onClick={()=>navigate('/schedule')}>View all</Btn></div>
          {myShifts.length===0
            ? <EmptyState icon="📅" title="No shifts yet" message="Your schedule hasn't been published yet. Check back soon." />
            : myShifts.slice(0,4).map(s => (
              <div key={s.id} className="list-item">
                <div className="list-dot blue"></div>
                <div className="list-info">
                  <div className="list-title">{fmtDate(s.shift_date)}</div>
                  <div className="list-meta">{fmtTime(s.start_time)} – {fmtTime(s.end_time)} · {s.position}</div>
                </div>
                {postedIds.has(s.id) ? <Btn size="sm" disabled>Posted</Btn> : <Btn size="sm" onClick={() => setPostModal(s)}>Post</Btn>}
              </div>
            ))
          }
        </Card>
        <Card>
          <div className="card-header"><div className="card-title">Open shifts to claim</div><Btn size="sm" onClick={()=>navigate('/available')}>View all</Btn></div>
          {available.length===0
            ? <EmptyState icon="🔓" title="No open shifts" message="Check back later." />
            : available.slice(0,3).map(a => (
              <div key={a.id} className="list-item">
                <div className="list-dot green"></div>
                <div className="list-info">
                  <div className="list-title">{a.shift?.position} · {fmtDate(a.shift?.shift_date)}</div>
                  <div className="list-meta">"{a.reason}" · {a.posted_by_profile?.name}</div>
                </div>
                <Btn size="sm" variant="primary" onClick={() => handleClaim(a.id)}>Claim</Btn>
              </div>
            ))
          }
        </Card>
      </div>

      <Modal isOpen={!!postModal} onClose={() => { setPostModal(null); setReason(''); }} title="Post shift for coverage">
        {postModal && (
          <form onSubmit={handlePost}>
            <div className="modal-info-box"><strong>{postModal.position}</strong><div style={{color:'var(--muted)',fontSize:13,marginTop:4}}>{fmtDate(postModal.shift_date)} · {fmtTime(postModal.start_time)} – {fmtTime(postModal.end_time)}</div></div>
            <FormRow label="Reason"><Input value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. medical appointment…" required /></FormRow>
            <div className="modal-actions"><Btn onClick={()=>setPostModal(null)}>Cancel</Btn><Btn type="submit" variant="primary">Post shift</Btn></div>
          </form>
        )}
      </Modal>
    </div>
  );
}

// ── My Schedule ───────────────────────────────────────────────────────────────
export function EmployeeSchedule() {
  const { profile, org } = useAuth();
  const { toast, show } = useToast();
  const weekStart = toISO(getWeekStart(new Date()));
  const weekEnd   = toISO(addDays(getWeekStart(new Date()),6));
  const { shifts, loading, reload } = useMyShifts(weekStart, weekEnd);
  const [postModal, setPostModal] = useState(null);
  const [reason, setReason] = useState('');
  const [postedIds, setPostedIds] = useState(new Set());

  useEffect(() => {
    if (!profile) return;
    supabase.from('available_shifts').select('shift_id').eq('posted_by', profile.id).eq('is_open', true)
      .then(({ data }) => setPostedIds(new Set((data || []).map(r => r.shift_id))));
  }, [profile]);
  const week = buildWeek(getWeekStart(new Date()));
  const byDate = {};
  shifts.forEach(s => { byDate[s.shift_date] = s; });
  const todayISO = toISO(new Date());

  async function handlePost(e) {
    e.preventDefault();
    if (!reason.trim()) return;
    await supabase.from('available_shifts').insert({ org_id: org.id, shift_id: postModal.id, posted_by: profile.id, reason });
    const { data: others } = await supabase.from('profiles').select('id').eq('org_id',org.id).eq('role','employee').neq('id',profile.id);
    if (others?.length) await supabase.from('notifications').insert(others.map(u=>({ org_id:org.id, user_id:u.id, text:`New shift available: ${postModal.position} on ${postModal.shift_date}.` })));
    setPostedIds(prev => new Set([...prev, postModal.id]));
    show('Shift posted!'); setPostModal(null); setReason(''); reload();
  }

  if (loading) return <LoadingScreen />;
  return (
    <div className="page">
      <Toast toast={toast} />
      <PageHeader title="My schedule" subtitle={`Week of ${weekStart}`} />
      <Card style={{marginBottom:16,padding:'18px 16px'}}>
        <div className="schedule-scroll">
          <div className="week-grid">
            {week.map(({key,date,num}) => {
              const shift = byDate[date];
              return (
                <div key={key} className="day-col" style={{cursor:'default'}}>
                  <div className="day-header">{key}</div>
                  <div className={`day-date ${date===todayISO?'today':''}`}>{num}</div>
                  {shift
                    ? <div className={`shift-block ${colorFor(profile?.id)}`} onClick={()=>{ if (!postedIds.has(shift.id)) setPostModal(shift); }}>
                        <div className="sb-pos">{shift.position}</div>
                        <div className="sb-time">{fmtTime(shift.start_time)}</div>
                        <div className="sb-time">{fmtTime(shift.end_time)}</div>
                      </div>
                    : <div className="day-off">Off</div>
                  }
                </div>
              );
            })}
          </div>
        </div>
      </Card>
      <Card>
        <div className="card-header"><div className="card-title">Shift details</div></div>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Date</th><th>Position</th><th>Start</th><th>End</th><th>Hours</th><th>Dept</th><th>Action</th></tr></thead>
            <tbody>{shifts.map(s => (
              <tr key={s.id}><td>{fmtDate(s.shift_date)}</td><td><strong>{s.position}</strong></td><td>{fmtTime(s.start_time)}</td><td>{fmtTime(s.end_time)}</td><td>{s.duration_hours}h</td><td>{s.department}</td><td>{postedIds.has(s.id) ? <Btn size="sm" disabled>Posted</Btn> : <Btn size="sm" onClick={()=>setPostModal(s)}>Post for coverage</Btn>}</td></tr>
            ))}</tbody>
          </table>
          {shifts.length===0 && <div className="table-empty">Your schedule hasn't been published yet. Check back soon.</div>}
        </div>
      </Card>
      <Modal isOpen={!!postModal} onClose={()=>{setPostModal(null);setReason('');}} title="Post shift for coverage">
        {postModal && <form onSubmit={handlePost}>
          <div className="modal-info-box"><strong>{postModal.position}</strong><div style={{color:'var(--muted)',fontSize:13,marginTop:4}}>{fmtDate(postModal.shift_date)} · {fmtTime(postModal.start_time)}–{fmtTime(postModal.end_time)}</div></div>
          <FormRow label="Reason"><Input value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. medical appointment…" required /></FormRow>
          <div className="modal-actions"><Btn onClick={()=>setPostModal(null)}>Cancel</Btn><Btn type="submit" variant="primary">Post shift</Btn></div>
        </form>}
      </Modal>
    </div>
  );
}

// ── Available Shifts ──────────────────────────────────────────────────────────
export function AvailableShifts() {
  const { profile, org } = useAuth();
  const { available, loading, reload } = useAvailableShifts();
  const { requests } = useMyRequests();
  const { toast, show } = useToast();

  async function handleClaim(a) {
    const already = requests.find(r => r.available_shift_id === a.id && r.status==='pending');
    if (already) return show('You already requested this shift.','error');
    await supabase.from('shift_requests').insert({ org_id: org.id, available_shift_id: a.id, requester_id: profile.id, status:'pending' });
    const { data: mgrs } = await supabase.from('profiles').select('id').eq('org_id',org.id).in('role',['manager','owner']);
    if (mgrs?.length) await supabase.from('notifications').insert(mgrs.map(m=>({ org_id:org.id, user_id:m.id, text:`${profile.name} requested to cover ${a.shift?.position} on ${a.shift?.shift_date}.` })));
    show('Request submitted!'); reload();
  }

  if (loading) return <LoadingScreen />;
  return (
    <div className="page">
      <Toast toast={toast} />
      <PageHeader title="Available shifts" subtitle="Open shifts you can request to cover" />
      {available.length===0
        ? <EmptyState icon="🔓" title="No open shifts" message="All shifts are currently covered. Check back later!" />
        : available.map(a => {
          const already = requests.find(r => r.available_shift_id===a.id && r.status==='pending');
          return (
            <div key={a.id} className="avail-card">
              <Avatar name={a.posted_by_profile?.name} color={a.posted_by_profile?.avatar_color} textColor={a.posted_by_profile?.avatar_text_color} size="lg" />
              <div className="avail-info">
                <div className="avail-title">{a.shift?.position} · {fmtDate(a.shift?.shift_date)}</div>
                <div className="avail-meta">{fmtTime(a.shift?.start_time)} – {fmtTime(a.shift?.end_time)} · {a.shift?.department} · Posted by {a.posted_by_profile?.name}</div>
                <div className="avail-reason">"{a.reason}"</div>
              </div>
              <div className="avail-actions">
                <Badge status="open" />
                {already ? <Btn size="sm" disabled>Requested</Btn> : <Btn size="sm" variant="primary" onClick={()=>handleClaim(a)}>Request to cover</Btn>}
              </div>
            </div>
          );
        })
      }
    </div>
  );
}

// ── My Requests ───────────────────────────────────────────────────────────────
export function MyRequests() {
  const { requests, loading } = useMyRequests();
  if (loading) return <LoadingScreen />;
  return (
    <div className="page">
      <PageHeader title="My requests" subtitle="Track your shift coverage requests" />
      <Card>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Position</th><th>Date</th><th>Time</th><th>Dept</th><th>Submitted</th><th>Status</th></tr></thead>
            <tbody>{requests.map(r => {
              const shift = r.available_shift?.shift;
              return (
                <tr key={r.id}><td><strong>{shift?.position}</strong></td><td>{fmtDate(shift?.shift_date)}</td><td>{fmtTime(shift?.start_time)}–{fmtTime(shift?.end_time)}</td><td>{shift?.department}</td><td style={{color:'var(--muted)',fontSize:12}}>{new Date(r.created_at).toLocaleDateString()}</td><td><Badge status={r.status} /></td></tr>
              );
            })}</tbody>
          </table>
          {requests.length===0 && <div className="table-empty">No requests yet. Claim an available shift to get started.</div>}
        </div>
      </Card>
    </div>
  );
}

// ── My Availability ───────────────────────────────────────────────────────────
const AVAIL_DAYS = [
  { label: 'Monday',    dow: 1 },
  { label: 'Tuesday',   dow: 2 },
  { label: 'Wednesday', dow: 3 },
  { label: 'Thursday',  dow: 4 },
  { label: 'Friday',    dow: 5 },
  { label: 'Saturday',  dow: 6 },
  { label: 'Sunday',    dow: 0 },
];

export function EmployeeAvailability() {
  const { toast, show } = useToast();
  const { availability, loading, saveAvailability } = useAvailability();
  const [rows, setRows] = useState(
    AVAIL_DAYS.map(d => ({ day_of_week: d.dow, is_available: false, start_time: '09:00', end_time: '17:00' }))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    const map = {};
    availability.forEach(a => { map[a.day_of_week] = a; });
    setRows(AVAIL_DAYS.map(({ dow }) => ({
      day_of_week:  dow,
      is_available: map[dow]?.is_available ?? false,
      start_time:   (map[dow]?.start_time || '09:00:00').slice(0, 5),
      end_time:     (map[dow]?.end_time   || '17:00:00').slice(0, 5),
    })));
  }, [availability, loading]);

  function update(dow, field, value) {
    setRows(prev => prev.map(r => r.day_of_week === dow ? { ...r, [field]: value } : r));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveAvailability(rows);
      show('Availability saved!');
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingScreen />;

  return (
    <div className="page">
      <Toast toast={toast} />
      <PageHeader title="My availability" subtitle="Set which days and times you're available to work" />
      <Card>
        <form onSubmit={handleSave}>
          <div style={{ display:'flex', flexDirection:'column' }}>
            {AVAIL_DAYS.map(({ label, dow }) => {
              const row = rows.find(r => r.day_of_week === dow) || { is_available: false, start_time: '09:00', end_time: '17:00' };
              return (
                <div key={dow} style={{ display:'flex', alignItems:'center', gap:16, padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, width:130, cursor:'pointer', flexShrink:0 }}>
                    <input
                      type="checkbox"
                      checked={row.is_available}
                      onChange={e => update(dow, 'is_available', e.target.checked)}
                      style={{ width:16, height:16, accentColor:'var(--accent)', cursor:'pointer' }}
                    />
                    <span style={{ fontSize:14, fontWeight: row.is_available ? 600 : 400, color: row.is_available ? 'var(--text)' : 'var(--muted)' }}>
                      {label}
                    </span>
                  </label>
                  {row.is_available ? (
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <Input type="time" value={row.start_time} onChange={e => update(dow, 'start_time', e.target.value)} style={{ width:120 }} />
                      <span style={{ color:'var(--muted)', fontSize:14 }}>–</span>
                      <Input type="time" value={row.end_time}   onChange={e => update(dow, 'end_time',   e.target.value)} style={{ width:120 }} />
                    </div>
                  ) : (
                    <span style={{ fontSize:13, color:'var(--muted)' }}>Not available</span>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop:20, display:'flex', justifyContent:'flex-end' }}>
            <Btn type="submit" variant="primary" disabled={saving}>{saving ? <Spinner /> : 'Save availability'}</Btn>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────
export function EmpNotifications() {
  const { notifications, unreadCount, markAllRead } = useNotifications();
  return (
    <div className="page">
      <PageHeader title="Notifications" subtitle={`${unreadCount} unread`}
        action={unreadCount>0 && <Btn size="sm" onClick={markAllRead}>Mark all read</Btn>}
      />
      <Card>
        {notifications.length===0
          ? <EmptyState icon="🔔" title="All caught up" message="No notifications yet." />
          : notifications.map(n => (
            <div key={n.id} className="notif-item">
              <div className={`notif-dot ${n.read?'read':''}`}></div>
              <div style={{flex:1}}>
                <div className={`notif-text ${!n.read?'unread':''}`}>{n.text}</div>
                <div className="notif-time">{new Date(n.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))
        }
      </Card>
    </div>
  );
}
