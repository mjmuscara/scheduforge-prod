import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEmployees, useShifts, useShiftRequests, useNotifications, useSchedule, useInvites, useToast } from '../hooks/useData';
import { Btn, Card, Badge, Avatar, StatCard, Modal, FormRow, Input, Select, EmptyState, PageHeader, Toast, Spinner, LoadingScreen } from '../components/UI';
import { fmtDate, fmtTime, getWeekStart, addDays, toISO, buildWeek, fmtWeekRange, colorFor } from '../utils/dates';
import { supabase } from '../lib/supabase';
import '../components/UI.css';

// ── Manager Dashboard ─────────────────────────────────────────────────────────
export function ManagerDashboard() {
  const { org, profile } = useAuth();
  const { toast, show } = useToast();
  const weekStart = toISO(getWeekStart(new Date()));
  const weekEnd   = toISO(addDays(getWeekStart(new Date()), 6));
  const { employees, loading: empLoading } = useEmployees();
  const { shifts } = useShifts(weekStart, weekEnd);
  const { requests, reload: reloadReq } = useShiftRequests();
  const { notifications } = useNotifications();

  const pending = requests.filter(r => r.status === 'pending');

  async function handleReview(requestId, decision) {
    const req = requests.find(r => r.id === requestId);
    const shift = req?.available_shift?.shift;
    await supabase.from('shift_requests').update({ status: decision, reviewed_by: profile.id, reviewed_at: new Date().toISOString() }).eq('id', requestId);
    if (decision === 'approved' && shift) {
      await supabase.from('shifts').update({ employee_id: req.requester_id }).eq('id', shift.id);
      await supabase.from('available_shifts').update({ is_open: false }).eq('id', req.available_shift_id);
    }
    await supabase.from('notifications').insert({ org_id: org.id, user_id: req.requester_id, text: `Your shift request for ${shift?.position} on ${shift?.shift_date} was ${decision}.` });
    show(`Request ${decision}!`, decision === 'approved' ? 'success' : 'error');
    reloadReq();
  }

  if (empLoading) return <LoadingScreen />;

  return (
    <div className="page">
      <Toast toast={toast} onClose={() => {}} />
      <PageHeader title="Manager overview" subtitle={new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })} />
      <div className="stats-grid">
        <StatCard label="Employees"        value={employees.length} sub="Active team members" />
        <StatCard label="Shifts this week" value={shifts.length}    sub="Scheduled" />
        <StatCard label="Pending requests" value={pending.length}   color={pending.length>0?'var(--amber)':undefined} sub="Need review" />
        <StatCard label="Unread alerts"    value={notifications.filter(n=>!n.read).length} color="var(--red)" sub="Notifications" />
      </div>
      <div className="grid-2">
        <Card>
          <div className="card-header"><div className="card-title">Pending requests</div><Badge status="pending" /></div>
          {pending.length === 0
            ? <EmptyState icon="✅" title="All clear" message="No pending requests." />
            : pending.map(r => {
              const shift = r.available_shift?.shift;
              return (
                <div key={r.id} className="list-item">
                  <Avatar name={r.requester?.name} color={r.requester?.avatar_color} textColor={r.requester?.avatar_text_color} size="sm" />
                  <div className="list-info">
                    <div className="list-title">{r.requester?.name} → {shift?.position}</div>
                    <div className="list-meta">{fmtDate(shift?.shift_date)} · {fmtTime(shift?.start_time)}–{fmtTime(shift?.end_time)}</div>
                  </div>
                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    <Btn size="sm" variant="success" onClick={() => handleReview(r.id,'approved')}>✓</Btn>
                    <Btn size="sm" variant="danger"  onClick={() => handleReview(r.id,'denied')}>✕</Btn>
                  </div>
                </div>
              );
            })
          }
        </Card>
        <Card>
          <div className="card-header"><div className="card-title">Your team</div></div>
          {employees.slice(0,6).map(e => (
            <div key={e.id} className="list-item">
              <Avatar name={e.name} color={e.avatar_color} textColor={e.avatar_text_color} size="sm" />
              <div className="list-info">
                <div className="list-title">{e.name}</div>
                <div className="list-meta">{e.position} · {e.department}</div>
              </div>
              <Badge status="approved" />
            </div>
          ))}
          {employees.length === 0 && <EmptyState icon="👥" title="No employees yet" message="Add employees from the Employees tab." />}
        </Card>
      </div>
    </div>
  );
}

// ── Schedule Builder ──────────────────────────────────────────────────────────
export function ScheduleBuilder() {
  const { org, profile } = useAuth();
  const { employees } = useEmployees();
  const { toast, show } = useToast();
  const [weekStart, setWeekStart]   = useState(() => getWeekStart(new Date()));
  const weekStartISO = toISO(weekStart);
  const weekEndISO   = toISO(addDays(weekStart, 6));
  const week = buildWeek(weekStart);
  const { shifts, reload: reloadShifts } = useShifts(weekStartISO, weekEndISO);
  const { schedule, ensureSchedule, publish } = useSchedule(weekStartISO);
  const [addModal, setAddModal]     = useState(false);
  const [prefillDate, setPrefill]   = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm] = useState({ employeeId:'', date:'', startTime:'', endTime:'', position:'', department:'' });

  function openAdd(date='') { setPrefill(date); setForm(f=>({...f,date,employeeId:'',startTime:'',endTime:'',position:'',department:''})); setAddModal(true); }

  async function handleAdd(e) {
    e.preventDefault(); setSaving(true);
    try {
      const sched = await ensureSchedule(profile.id);
      const emp = employees.find(em => em.id === form.employeeId);
      await supabase.from('shifts').insert({ org_id: org.id, schedule_id: sched.id, employee_id: form.employeeId, shift_date: form.date, start_time: form.startTime, end_time: form.endTime, position: form.position || emp?.position, department: form.department || emp?.department });
      await supabase.from('notifications').insert({ org_id: org.id, user_id: form.employeeId, text: `A new shift has been added: ${form.position} on ${form.date}.` });
      show('Shift added!');
      setAddModal(false);
      reloadShifts();
    } catch (err) { show(err.message, 'error'); }
    finally { setSaving(false); }
  }

  async function handleRemove() {
    if (!confirmDel) return;
    await supabase.from('shifts').delete().eq('id', confirmDel.id);
    show('Shift removed.');
    setConfirmDel(null);
    reloadShifts();
  }

  async function handlePublish() {
    await publish(employees.map(e => e.id));
    show('Schedule published! Employees notified.');
  }

  const shiftsByDate = {};
  shifts.forEach(s => { (shiftsByDate[s.shift_date] = shiftsByDate[s.shift_date] || []).push(s); });
  const todayISO = toISO(new Date());

  return (
    <div className="page">
      <Toast toast={toast} />
      <PageHeader title="Schedule builder"
        action={
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <Btn size="sm" onClick={() => openAdd()}>+ Add shift</Btn>
            <Btn size="sm" variant="primary" onClick={handlePublish}>{schedule?.published ? '✓ Published' : 'Publish schedule'}</Btn>
          </div>
        }
      />
      <div className="week-nav">
        <div className="week-nav-label">{fmtWeekRange(weekStart)}</div>
        <div className="week-nav-btns">
          <Btn size="sm" onClick={() => setWeekStart(d => addDays(d,-7))}>← Prev</Btn>
          <Btn size="sm" onClick={() => setWeekStart(getWeekStart(new Date()))}>Today</Btn>
          <Btn size="sm" onClick={() => setWeekStart(d => addDays(d,7))}>Next →</Btn>
        </div>
      </div>
      <Card style={{marginBottom:16,padding:'18px 16px'}}>
        <div className="schedule-scroll">
          <div className="week-grid">
            {week.map(({ key, date, num }) => {
              const dayShifts = shiftsByDate[date] || [];
              return (
                <div key={key} className="day-col" onClick={() => openAdd(date)}>
                  <div className="day-header">{key}</div>
                  <div className={`day-date ${date===todayISO?'today':''}`}>{num}</div>
                  {dayShifts.length === 0
                    ? <div className="day-off">No shifts</div>
                    : dayShifts.map(s => (
                      <div key={s.id} className={`shift-block ${colorFor(s.employee_id)}`} onClick={ev=>{ev.stopPropagation();setConfirmDel(s);}}>
                        <div className="sb-name">{s.employee?.name?.split(' ')[0]}</div>
                        <div className="sb-pos">{s.position}</div>
                        <div className="sb-time">{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</div>
                      </div>
                    ))
                  }
                  <div className="day-add-hint">+ Add shift</div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
      <Card style={{marginBottom:16}}>
        <div className="card-header"><div className="card-title">Shifts this week ({shifts.length})</div></div>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Employee</th><th>Position</th><th>Date</th><th>Start</th><th>End</th><th>Dept</th><th>Hrs</th><th></th></tr></thead>
            <tbody>
              {shifts.map(s => (
                <tr key={s.id}>
                  <td><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar name={s.employee?.name} color={s.employee?.avatar_color} textColor={s.employee?.avatar_text_color} size="sm" /><span style={{fontWeight:500}}>{s.employee?.name}</span></div></td>
                  <td>{s.position}</td><td>{fmtDate(s.shift_date)}</td>
                  <td>{fmtTime(s.start_time)}</td><td>{fmtTime(s.end_time)}</td>
                  <td>{s.department}</td><td>{s.duration_hours}h</td>
                  <td><Btn size="sm" variant="danger" onClick={() => setConfirmDel(s)}>Remove</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
          {shifts.length === 0 && <div className="table-empty">No shifts this week. Click a day or use "+ Add shift".</div>}
        </div>
      </Card>

      {/* Add modal */}
      <Modal isOpen={addModal} onClose={() => setAddModal(false)} title={prefillDate ? `Add shift — ${fmtDate(prefillDate)}` : 'Add shift'}>
        <form onSubmit={handleAdd}>
          <FormRow label="Employee">
            <Select value={form.employeeId} onChange={e => setForm(f=>({...f,employeeId:e.target.value}))} required>
              <option value="">Select employee…</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.position})</option>)}
            </Select>
          </FormRow>
          <FormRow label="Date"><Input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} required /></FormRow>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <FormRow label="Start time"><Input type="time" value={form.startTime} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))} required /></FormRow>
            <FormRow label="End time">  <Input type="time" value={form.endTime}   onChange={e=>setForm(f=>({...f,endTime:e.target.value}))}   required /></FormRow>
          </div>
          <FormRow label="Position"  ><Input value={form.position}   onChange={e=>setForm(f=>({...f,position:e.target.value}))}   placeholder="e.g. Cashier"    /></FormRow>
          <FormRow label="Department"><Input value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))} placeholder="e.g. Front End"  /></FormRow>
          <div className="modal-actions">
            <Btn onClick={() => setAddModal(false)}>Cancel</Btn>
            <Btn type="submit" variant="primary" disabled={saving}>{saving ? <Spinner/> : 'Add shift'}</Btn>
          </div>
        </form>
      </Modal>

      {/* Remove confirm */}
      <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} title="Remove shift?">
        {confirmDel && (
          <>
            <div className="modal-info-box"><strong>{confirmDel.position}</strong><div style={{color:'var(--muted)',fontSize:13,marginTop:4}}>{fmtDate(confirmDel.shift_date)} · {fmtTime(confirmDel.start_time)}–{fmtTime(confirmDel.end_time)}</div></div>
            <p style={{fontSize:13.5,color:'var(--muted)'}}>This will cancel any pending coverage requests for this shift.</p>
            <div className="modal-actions">
              <Btn onClick={() => setConfirmDel(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={handleRemove}>Remove shift</Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

// ── Shift Requests ────────────────────────────────────────────────────────────
export function ManagerRequests() {
  const { org, profile } = useAuth();
  const { requests, reload, loading } = useShiftRequests();
  const { toast, show } = useToast();

  async function handleReview(requestId, decision) {
    const req = requests.find(r => r.id === requestId);
    const shift = req?.available_shift?.shift;
    await supabase.from('shift_requests').update({ status: decision, reviewed_by: profile.id, reviewed_at: new Date().toISOString() }).eq('id', requestId);
    if (decision === 'approved' && shift) {
      await supabase.from('shifts').update({ employee_id: req.requester_id }).eq('id', shift.id);
      await supabase.from('available_shifts').update({ is_open: false }).eq('id', req.available_shift_id);
    }
    await supabase.from('notifications').insert({ org_id: org.id, user_id: req.requester_id, text: `Your shift request for ${shift?.position} on ${shift?.shift_date} was ${decision}.` });
    show(`Request ${decision}!`, decision === 'approved' ? 'success' : 'error');
    reload();
  }

  if (loading) return <LoadingScreen />;
  return (
    <div className="page">
      <Toast toast={toast} />
      <PageHeader title="Shift requests" subtitle="Approve or deny employee shift swap requests" />
      <Card>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Requester</th><th>Position</th><th>Date</th><th>Time</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {requests.map(r => {
                const shift = r.available_shift?.shift;
                return (
                  <tr key={r.id}>
                    <td><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar name={r.requester?.name} color={r.requester?.avatar_color} textColor={r.requester?.avatar_text_color} size="sm"/><span style={{fontWeight:500}}>{r.requester?.name}</span></div></td>
                    <td>{shift?.position}</td>
                    <td>{fmtDate(shift?.shift_date)}</td>
                    <td style={{whiteSpace:'nowrap'}}>{fmtTime(shift?.start_time)}–{fmtTime(shift?.end_time)}</td>
                    <td><Badge status={r.status} /></td>
                    <td>{r.status==='pending'
                      ? <div style={{display:'flex',gap:6}}><Btn size="sm" variant="success" onClick={()=>handleReview(r.id,'approved')}>Approve</Btn><Btn size="sm" variant="danger" onClick={()=>handleReview(r.id,'denied')}>Deny</Btn></div>
                      : <span style={{fontSize:12,color:'var(--muted)'}}>{r.status==='expired'?'⏰ Expired':'Reviewed'}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {requests.length===0 && <div className="table-empty">No requests yet.</div>}
        </div>
      </Card>
    </div>
  );
}

// ── Employees ─────────────────────────────────────────────────────────────────
export function ManagerEmployees() {
  const { org } = useAuth();
  const { employees, loading, reload } = useEmployees();
  const { invites, sendInvite, revokeInvite } = useInvites();
  const { toast, show } = useToast();
  const [inviteModal, setInviteModal] = useState(false);
  const [confirmDel, setConfirmDel]   = useState(null);
  const [sending, setSending]         = useState(false);
  const [inviteLink, setInviteLink]   = useState('');
  const [form, setForm] = useState({ name:'', email:'', position:'', department:'' });

  async function handleInvite(e) {
    e.preventDefault(); setSending(true);
    try {
      const invite = await sendInvite(form);
      const link = `${process.env.REACT_APP_URL}/invite?token=${invite.token}`;
      setInviteLink(link);
      show(`Invite created for ${form.name}!`);
      setForm({ name:'', email:'', position:'', department:'' });
    } catch (err) { show(err.message, 'error'); }
    finally { setSending(false); }
  }

  async function handleRemove() {
    if (!confirmDel) return;
    await supabase.from('profiles').update({ is_active: false }).eq('id', confirmDel.id);
    show(`${confirmDel.name} removed.`);
    setConfirmDel(null);
    reload();
  }

  // Current-week shift counts
  const weekStart = toISO(getWeekStart(new Date()));
  const weekEnd   = toISO(addDays(getWeekStart(new Date()),6));
  const { shifts } = useShifts(weekStart, weekEnd);
  const shiftCounts = {};
  shifts.forEach(s => { shiftCounts[s.employee_id] = (shiftCounts[s.employee_id]||0)+1; });

  if (loading) return <LoadingScreen />;

  return (
    <div className="page">
      <Toast toast={toast} />
      <PageHeader title="Employees" subtitle={`${employees.length} active team members`}
        action={<Btn variant="primary" size="sm" onClick={() => { setInviteModal(true); setInviteLink(''); }}>+ Invite employee</Btn>}
      />

      {/* Pending invites */}
      {invites.length > 0 && (
        <Card style={{marginBottom:16}}>
          <div className="card-header"><div className="card-title">Pending invites</div></div>
          {invites.map(inv => (
            <div key={inv.id} className="invite-pill">
              <div className="invite-pill-info">
                <div className="invite-pill-name">{inv.name}</div>
                <div className="invite-pill-email">{inv.email} · {inv.position}</div>
              </div>
              <Badge status="pending" />
              <Btn size="sm" variant="ghost" onClick={() => revokeInvite(inv.id)}>Revoke</Btn>
            </div>
          ))}
        </Card>
      )}

      <div className="employees-grid">
        {employees.map(e => {
          const count = shiftCounts[e.id] || 0;
          return (
            <div key={e.id} className="emp-card">
              <Avatar name={e.name} color={e.avatar_color} textColor={e.avatar_text_color} size="lg" />
              <div className="emp-info">
                <div className="emp-name">{e.name}</div>
                <div className="emp-sub">{e.position} · {e.department}</div>
                <div className="emp-email">{e.email}</div>
                <div style={{fontSize:12,color:count>0?'var(--green)':'var(--hint)',marginTop:4,fontWeight:500}}>
                  {count>0?`${count} shift${count>1?'s':''} this week`:'No shifts this week'}
                </div>
              </div>
              <button className="emp-remove-btn" onClick={() => setConfirmDel(e)} title="Remove">✕</button>
            </div>
          );
        })}
      </div>
      {employees.length===0 && <EmptyState icon="👥" title="No employees yet" message="Invite your first team member." action={<Btn variant="primary" onClick={()=>setInviteModal(true)}>+ Invite employee</Btn>} />}

      {/* Invite modal */}
      <Modal isOpen={inviteModal} onClose={() => setInviteModal(false)} title="Invite employee">
        {inviteLink
          ? <div>
              <p style={{fontSize:13.5,marginBottom:12}}>Share this invite link with <strong>{form.name || 'your employee'}</strong>. It expires in 7 days.</p>
              <div style={{background:'var(--bg)',borderRadius:'var(--radius-sm)',padding:'12px',fontFamily:'monospace',fontSize:12,wordBreak:'break-all',marginBottom:16}}>{inviteLink}</div>
              <Btn full onClick={() => {navigator.clipboard.writeText(inviteLink); show('Link copied!');}}>📋 Copy link</Btn>
              <div className="modal-actions"><Btn onClick={() => setInviteModal(false)}>Done</Btn></div>
            </div>
          : <form onSubmit={handleInvite}>
              <FormRow label="Full name"><Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Jane Smith" required /></FormRow>
              <FormRow label="Email" hint="They'll use this to log in"><Input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="jane@company.com" required /></FormRow>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <FormRow label="Position"><Input value={form.position} onChange={e=>setForm(f=>({...f,position:e.target.value}))} placeholder="Cashier" /></FormRow>
                <FormRow label="Department"><Input value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))} placeholder="Front End" /></FormRow>
              </div>
              <div className="modal-actions">
                <Btn onClick={() => setInviteModal(false)}>Cancel</Btn>
                <Btn type="submit" variant="primary" disabled={sending}>{sending ? <Spinner/> : 'Generate invite link'}</Btn>
              </div>
            </form>
        }
      </Modal>

      {/* Remove confirm */}
      <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} title="Remove employee?">
        {confirmDel && (
          <>
            <div style={{display:'flex',alignItems:'center',gap:12,background:'var(--bg)',borderRadius:'var(--radius-sm)',padding:14,marginBottom:16}}>
              <Avatar name={confirmDel.name} color={confirmDel.avatar_color} textColor={confirmDel.avatar_text_color} size="lg" />
              <div><div style={{fontWeight:600}}>{confirmDel.name}</div><div style={{fontSize:13,color:'var(--muted)'}}>{confirmDel.position} · {confirmDel.department}</div></div>
            </div>
            <p style={{fontSize:13.5,color:'var(--muted)'}}>This will remove <strong>{confirmDel.name}</strong> from your team. Their historical shifts will be preserved for records.</p>
            <div className="modal-actions">
              <Btn onClick={() => setConfirmDel(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={handleRemove}>Remove employee</Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────
export function ManagerNotifications() {
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
