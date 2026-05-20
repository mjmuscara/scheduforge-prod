import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDirectReports, useShifts, useShiftRequests, useNotifications, useSchedule, useInvites, useAvailability, useToast } from '../hooks/useData';
import { Btn, Card, Badge, Avatar, StatCard, Modal, FormRow, Input, Select, EmptyState, PageHeader, Toast, Spinner, LoadingScreen } from '../components/UI';
import { fmtDate, fmtTime, getWeekStart, addDays, toISO, buildWeek, fmtWeekRange, colorFor } from '../utils/dates';
import { supabase } from '../lib/supabase';
import '../components/UI.css';

const AVAIL_DAYS = [
  { label: 'Monday',    dow: 1 },
  { label: 'Tuesday',   dow: 2 },
  { label: 'Wednesday', dow: 3 },
  { label: 'Thursday',  dow: 4 },
  { label: 'Friday',    dow: 5 },
  { label: 'Saturday',  dow: 6 },
  { label: 'Sunday',    dow: 0 },
];

// Read-only availability grid shown in a manager's modal
function EmployeeAvailabilityView({ employeeId }) {
  const { availability, loading } = useAvailability(employeeId);
  if (loading) return <Spinner />;
  const map = {};
  availability.forEach(a => { map[a.day_of_week] = a; });
  return (
    <div>
      {AVAIL_DAYS.map(({ label, dow }) => {
        const a = map[dow];
        return (
          <div key={dow} style={{ display:'flex', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
            <span style={{ width:110, fontSize:14, fontWeight:500 }}>{label}</span>
            {a?.is_available
              ? <span style={{ fontSize:13, color:'var(--green)', fontWeight:500 }}>{fmtTime(a.start_time || '09:00:00')} – {fmtTime(a.end_time || '17:00:00')}</span>
              : <span style={{ fontSize:13, color:'var(--muted)' }}>Unavailable</span>
            }
          </div>
        );
      })}
      {availability.length === 0 && <p style={{ fontSize:13, color:'var(--muted)', paddingTop:8 }}>No availability set yet.</p>}
    </div>
  );
}
// ── Manager Dashboard ─────────────────────────────────────────────────────────
export function ManagerDashboard() {
  const { org, profile } = useAuth();
  const { toast, show } = useToast();
  const weekStart = toISO(getWeekStart(new Date()));
  const weekEnd   = toISO(addDays(getWeekStart(new Date()), 6));
  const { reports: members, loading: empLoading } = useDirectReports();
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
        <StatCard label="Team members"      value={members.length}   sub="Managers + employees" />
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
          {members.slice(0,6).map(e => (
            <div key={e.id} className="list-item">
              <Avatar name={e.name} color={e.avatar_color} textColor={e.avatar_text_color} size="sm" />
              <div className="list-info">
                <div className="list-title">{e.name}</div>
                <div className="list-meta">{e.role === 'manager' ? 'Manager' : e.position} · {e.department}</div>
              </div>
              <Badge status="approved" />
            </div>
          ))}
          {members.length === 0 && <EmptyState icon="👥" title="No team members yet" message="Add team members from the Employees tab." />}
        </Card>
      </div>
    </div>
  );
}

// ── Schedule Builder ──────────────────────────────────────────────────────────
export function ScheduleBuilder() {
  const { org, profile, isOwner } = useAuth();
  const { reports: ownDirectReports } = useDirectReports();
  const { toast, show } = useToast();
  const [weekStart, setWeekStart]         = useState(() => getWeekStart(new Date()));
  const weekStartISO = toISO(weekStart);
  const weekEndISO   = toISO(addDays(weekStart, 6));
  const week = buildWeek(weekStart);
  const { shifts, reload: reloadShifts } = useShifts(weekStartISO, weekEndISO);
  const { schedule, ensureSchedule, publish } = useSchedule(weekStartISO);
  const [addModal, setAddModal]           = useState(false);
  const [prefillDate, setPrefill]         = useState('');
  const [confirmDel, setConfirmDel]       = useState(null);
  const [saving, setSaving]               = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [generating, setGenerating]       = useState(false);
  const [viewingManagerId, setViewingManagerId] = useState(null);
  const [viewingTeam, setViewingTeam]     = useState([]);
  const [tSlots, setTSlots]               = useState([]);
  const [tDays, setTDays]                 = useState([1,2,3,4,5]);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [form, setForm] = useState({ employeeId:'', date:'', startTime:'', endTime:'', position:'', department:'' });
  const [availWarn, setAvailWarn] = useState('');
  const [copying, setCopying] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    if (!viewingManagerId) { setViewingTeam([]); return; }
    supabase.from('profiles').select('*')
      .eq('org_id', org.id).eq('reports_to', viewingManagerId)
      .eq('is_active', true).order('name')
      .then(({ data }) => setViewingTeam(data || []));
  }, [viewingManagerId, org]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!org || !profile || templateLoaded) return;
    supabase.from('schedule_templates').select('*')
      .eq('org_id', org.id).eq('manager_id', profile.id).maybeSingle()
      .then(({ data }) => {
        if (data) { setTSlots(data.slots); setTDays(data.days); }
        else { setTSlots([{ position: '', count: 1, startTime: '09:00', endTime: '17:00' }]); }
        setTemplateLoaded(true);
      });
  }, [org, profile, templateLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const employees = viewingManagerId ? viewingTeam : ownDirectReports;
  const knownPositions = [...new Set(employees.map(e => e.position).filter(Boolean))];

  function snapTo15(t) {
    if (!t) return t;
    const [h, m] = t.split(':').map(Number);
    const snapped = Math.round(m / 15) * 15;
    return `${String(h + (snapped === 60 ? 1 : 0)).padStart(2,'0')}:${String(snapped % 60).padStart(2,'0')}`;
  }

  // Warn if selected employee is unavailable for the chosen day/time
  useEffect(() => {
    if (!form.employeeId || !form.date) { setAvailWarn(''); return; }
    const dow = new Date(form.date + 'T12:00:00').getDay();
    supabase.from('availability').select('*')
      .eq('employee_id', form.employeeId).eq('day_of_week', dow).maybeSingle()
      .then(({ data: a }) => {
        const emp = employees.find(e => e.id === form.employeeId);
        const name = emp?.name?.split(' ')[0] || 'This employee';
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        if (!a) { setAvailWarn(''); return; }
        if (!a.is_available) { setAvailWarn(`${name} is marked unavailable on ${days[dow]}s.`); return; }
        if (form.startTime && a.start_time && form.endTime && a.end_time) {
          if (form.startTime < a.start_time.slice(0,5) || form.endTime > a.end_time.slice(0,5)) {
            setAvailWarn(`${name}'s availability on ${days[dow]}s is ${fmtTime(a.start_time)} – ${fmtTime(a.end_time)}.`);
            return;
          }
        }
        setAvailWarn('');
      });
  }, [form.employeeId, form.date, form.startTime, form.endTime]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCopyLastWeek() {
    setCopying(true);
    try {
      const prevStart = toISO(addDays(weekStart, -7));
      const prevEnd   = toISO(addDays(weekStart, -1));
      const { data: prevShifts } = await supabase.from('shifts').select('*')
        .eq('org_id', org.id).gte('shift_date', prevStart).lte('shift_date', prevEnd);
      if (!prevShifts?.length) { show('No shifts found from last week.', 'error'); return; }
      const existingKeys = new Set(shifts.map(s => `${s.employee_id}_${s.shift_date}`));
      const sched = await ensureSchedule(profile.id);
      const newShifts = prevShifts
        .map(s => {
          const newDate = toISO(addDays(new Date(s.shift_date + 'T12:00:00'), 7));
          return { org_id: org.id, schedule_id: sched.id, employee_id: s.employee_id, shift_date: newDate, start_time: s.start_time, end_time: s.end_time, position: s.position, department: s.department };
        })
        .filter(s => !existingKeys.has(`${s.employee_id}_${s.shift_date}`));
      if (!newShifts.length) { show('All last week\'s shifts already exist this week.', 'error'); return; }
      await supabase.from('shifts').insert(newShifts);
      show(`Copied ${newShifts.length} shift${newShifts.length > 1 ? 's' : ''} from last week!`);
      reloadShifts();
    } catch (err) { show(err.message, 'error'); }
    finally { setCopying(false); }
  }

  function handleClearAll() {
    const todayStr = toISO(new Date());
    const removable = shifts.filter(s => s.shift_date >= todayStr);
    if (!removable.length) return show('No upcoming shifts to clear this week.', 'error');
    setClearConfirm(true);
  }

  async function handleClearConfirmed() {
    const todayStr = toISO(new Date());
    const removable = shifts.filter(s => s.shift_date >= todayStr);
    setClearConfirm(false);
    setClearing(true);
    try {
      await supabase.from('shifts').delete().eq('org_id', org.id).in('id', removable.map(s => s.id));
      show(`Cleared ${removable.length} shift${removable.length > 1 ? 's' : ''}.`);
      reloadShifts();
    } catch (err) { show(err.message, 'error'); }
    finally { setClearing(false); }
  }

  function openAdd(date='') { setPrefill(date); setAvailWarn(''); setForm(f=>({...f,date,employeeId:'',startTime:'',endTime:'',position:'',department:''})); setAddModal(true); }

  async function handleAdd(e) {
    e.preventDefault(); setSaving(true);
    try {
      const sched = await ensureSchedule(profile.id);
      const emp = employees.find(em => em.id === form.employeeId);
      const startTime = snapTo15(form.startTime);
      const endTime   = snapTo15(form.endTime);
      await supabase.from('shifts').insert({ org_id: org.id, schedule_id: sched.id, employee_id: form.employeeId, shift_date: form.date, start_time: startTime, end_time: endTime, position: form.position || emp?.position, department: form.department || emp?.department });
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
    show('Schedule published! Team notified.');
  }

  // week indices 0-6 map to dow: Mon=1, Tue=2, ..., Sun=0
  const DOW_FROM_IDX = [1,2,3,4,5,6,0];

  async function handleAutoGenerate() {
    setGenerating(true);
    try {
      await supabase.from('schedule_templates').upsert({
        org_id: org.id, manager_id: profile.id,
        slots: tSlots, days: tDays, updated_at: new Date().toISOString(),
      }, { onConflict: 'org_id,manager_id' });

      const { data: allAvail } = await supabase
        .from('availability')
        .select('*')
        .in('employee_id', employees.map(e => e.id))
        .eq('is_available', true);

      const availMap = {};
      (allAvail || []).forEach(a => { availMap[`${a.employee_id}_${a.day_of_week}`] = a; });

      const existingKeys = new Set(shifts.map(s => `${s.employee_id}_${s.shift_date}`));
      const sched = await ensureSchedule(profile.id);
      const newShifts = [];
      let shortfalls = 0;

      week.forEach(({ date }, idx) => {
        const dow = DOW_FROM_IDX[idx];
        if (!tDays.includes(dow)) return;
        tSlots.forEach(slot => {
          if (!slot.position || slot.count < 1) return;
          const eligible = employees.filter(emp =>
            emp.position?.toLowerCase() === slot.position.toLowerCase() &&
            availMap[`${emp.id}_${dow}`] &&
            !existingKeys.has(`${emp.id}_${date}`)
          );
          const toAssign = eligible.slice(0, slot.count);
          shortfalls += Math.max(0, slot.count - toAssign.length);
          toAssign.forEach(emp => {
            newShifts.push({
              org_id: org.id, schedule_id: sched.id,
              employee_id: emp.id, shift_date: date,
              start_time: slot.startTime, end_time: slot.endTime,
              position: slot.position, department: emp.department || 'General',
            });
            existingKeys.add(`${emp.id}_${date}`);
          });
        });
      });

      if (newShifts.length === 0) {
        show('No shifts generated. Check that employees have matching positions and availability set.', 'error');
        return;
      }

      await supabase.from('shifts').insert(newShifts);
      const byEmp = {};
      newShifts.forEach(s => { (byEmp[s.employee_id] = byEmp[s.employee_id] || []).push(s); });
      const notifs = Object.entries(byEmp).map(([uid, ss]) => ({
        org_id: org.id, user_id: uid,
        text: `${ss.length} shift${ss.length > 1 ? 's have' : ' has'} been auto-scheduled for you this week.`,
      }));
      if (notifs.length > 0) await supabase.from('notifications').insert(notifs);

      const warn = shortfalls > 0 ? ` (${shortfalls} slot${shortfalls > 1 ? 's' : ''} couldn't be filled — not enough available employees with matching positions)` : '';
      show(`Generated ${newShifts.length} shifts!${warn}`);
      setTemplateModal(false);
      reloadShifts();
    } catch (err) { show(err.message, 'error'); }
    finally { setGenerating(false); }
  }

  const teamIds = new Set(employees.map(e => e.id));
  const displayedShifts = isOwner ? shifts.filter(s => teamIds.has(s.employee_id)) : shifts;
  const shiftsByDate = {};
  displayedShifts.forEach(s => { (shiftsByDate[s.shift_date] = shiftsByDate[s.shift_date] || []).push(s); });
  const todayISO = toISO(new Date());

  return (
    <div className="page">
      <Toast toast={toast} />
      <PageHeader title="Schedule builder"
        action={
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <Btn size="sm" onClick={() => openAdd()}>+ Add shift</Btn>
            <Btn size="sm" onClick={handleCopyLastWeek} disabled={copying}>{copying ? <Spinner /> : 'Copy last week'}</Btn>
            <Btn size="sm" onClick={handleClearAll} disabled={clearing} style={{ color:'#e03131', borderColor:'#e03131', background:'transparent' }}>{clearing ? <Spinner /> : 'Clear all'}</Btn>
            <Btn size="sm" onClick={() => setTemplateModal(true)}>Auto-generate</Btn>
            <Btn size="sm" variant="primary" onClick={handlePublish}>{schedule?.published ? '✓ Published' : 'Publish schedule'}</Btn>
          </div>
        }
      />
      {isOwner && ownDirectReports.length > 0 && (
        <div style={{marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:13,color:'var(--muted)',fontWeight:500}}>Viewing:</span>
          <Select value={viewingManagerId || ''} onChange={e => setViewingManagerId(e.target.value || null)}
            style={{width:'auto',minWidth:200}}>
            <option value="">My direct reports</option>
            {ownDirectReports.map(m => <option key={m.id} value={m.id}>{m.name}'s team</option>)}
          </Select>
        </div>
      )}
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
        <div className="card-header"><div className="card-title">Shifts this week ({displayedShifts.length})</div></div>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Employee</th><th>Position</th><th>Date</th><th>Start</th><th>End</th><th>Dept</th><th>Hrs</th><th></th></tr></thead>
            <tbody>
              {displayedShifts.map(s => (
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
          {displayedShifts.length === 0 && <div className="table-empty">No shifts this week. Click a day or use "+ Add shift".</div>}
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
            <FormRow label="Start time"><Input type="time" step="900" value={form.startTime} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))} required /></FormRow>
            <FormRow label="End time">  <Input type="time" step="900" value={form.endTime}   onChange={e=>setForm(f=>({...f,endTime:e.target.value}))}   required /></FormRow>
          </div>
          {availWarn && <div style={{background:'#fef9c3',border:'1px solid #fde047',borderRadius:'var(--radius-sm)',padding:'8px 12px',fontSize:13,color:'#854d0e',marginBottom:12}}>⚠ {availWarn}</div>}
          <FormRow label="Position"  ><Input value={form.position}   onChange={e=>setForm(f=>({...f,position:e.target.value}))}   placeholder="e.g. Cashier"    /></FormRow>
          <FormRow label="Department"><Input value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))} placeholder="e.g. Front End"  /></FormRow>
          <div className="modal-actions">
            <Btn onClick={() => setAddModal(false)}>Cancel</Btn>
            <Btn type="submit" variant="primary" disabled={saving}>{saving ? <Spinner/> : 'Add shift'}</Btn>
          </div>
        </form>
      </Modal>

      {/* Remove confirm */}
      <Modal isOpen={clearConfirm} onClose={() => setClearConfirm(false)} title="Clear all shifts?">
        <p style={{fontSize:14,color:'var(--muted)',marginBottom:8}}>This will remove all upcoming shifts for this week. Shifts that have already happened will not be affected.</p>
        <p style={{fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:20}}>This cannot be undone.</p>
        <div className="modal-actions">
          <Btn onClick={() => setClearConfirm(false)}>Cancel</Btn>
          <Btn onClick={handleClearConfirmed} style={{ background:'#e03131', color:'#fff', borderColor:'#e03131' }}>Clear all</Btn>
        </div>
      </Modal>

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

      {/* Auto-generate template */}
      <Modal isOpen={templateModal} onClose={() => setTemplateModal(false)} title="Auto-generate schedule">
        <p style={{fontSize:13,color:'var(--muted)',marginBottom:16}}>Define position slots and days to fill. Employees are matched by their position field.</p>
        <div style={{marginBottom:12}}>
          {tSlots.map((slot, i) => (
            <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 80px 90px 90px auto',gap:8,marginBottom:8,alignItems:'center'}}>
              <div>
                <input
                  list={`pos-list-${i}`}
                  value={slot.position}
                  onChange={e => setTSlots(prev => prev.map((s,j) => j===i ? {...s,position:e.target.value} : s))}
                  placeholder="Position"
                  style={{width:'100%',padding:'6px 10px',border:'1px solid var(--border)',borderRadius:'var(--radius)',fontSize:13,background:'var(--bg)',color:'var(--text)'}}
                />
                <datalist id={`pos-list-${i}`}>{knownPositions.map(p => <option key={p} value={p}/>)}</datalist>
              </div>
              <Input type="number" min={1} max={20} value={slot.count}
                onChange={e => setTSlots(prev => prev.map((s,j) => j===i ? {...s,count:+e.target.value} : s))} />
              <Input type="time" step="900" value={slot.startTime}
                onChange={e => setTSlots(prev => prev.map((s,j) => j===i ? {...s,startTime:e.target.value} : s))} />
              <Input type="time" step="900" value={slot.endTime}
                onChange={e => setTSlots(prev => prev.map((s,j) => j===i ? {...s,endTime:e.target.value} : s))} />
              <Btn size="sm" variant="danger" onClick={() => setTSlots(prev => prev.filter((_,j) => j!==i))}>✕</Btn>
            </div>
          ))}
          <Btn size="sm" onClick={() => setTSlots(prev => [...prev, {position:'',count:1,startTime:'09:00',endTime:'17:00'}])}>+ Add position</Btn>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:'var(--muted)',fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:0.5}}>Days</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[{label:'Mon',dow:1},{label:'Tue',dow:2},{label:'Wed',dow:3},{label:'Thu',dow:4},{label:'Fri',dow:5},{label:'Sat',dow:6},{label:'Sun',dow:0}].map(({label,dow}) => (
              <label key={dow} style={{display:'flex',alignItems:'center',gap:4,fontSize:13,cursor:'pointer'}}>
                <input type="checkbox" checked={tDays.includes(dow)}
                  onChange={e => setTDays(prev => e.target.checked ? [...prev,dow] : prev.filter(d=>d!==dow))} />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <Btn onClick={() => setTemplateModal(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={handleAutoGenerate} disabled={generating}>{generating ? <Spinner /> : 'Generate shifts'}</Btn>
        </div>
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
  const { reports, loading, reload } = useDirectReports();
  const directManagers = reports.filter(r => r.role === 'manager');
  const employees      = reports.filter(r => r.role === 'employee');
  const { invites, sendInvite, revokeInvite } = useInvites();
  const { toast, show } = useToast();
  const [inviteModal, setInviteModal] = useState(false);
  const [confirmDel, setConfirmDel]   = useState(null);
  const [availEmp, setAvailEmp]       = useState(null);
  const [sending, setSending]         = useState(false);
  const [inviteLink, setInviteLink]   = useState('');
  const [form, setForm] = useState({ name:'', email:'', position:'', department:'', role:'employee' });

  async function handleInvite(e) {
    e.preventDefault(); setSending(true);
    try {
      const invite = await sendInvite(form);
      const link = `${process.env.REACT_APP_URL}/invite?token=${invite.token}`;
      setInviteLink(link);
      show(`Invite created for ${form.name}!`);
      setForm({ name:'', email:'', position:'', department:'', role:'employee' });
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
      <PageHeader title="Employees" subtitle={`${reports.length} direct report${reports.length !== 1 ? 's' : ''}`}
        action={<Btn variant="primary" size="sm" onClick={() => { setInviteModal(true); setInviteLink(''); }}>+ Invite</Btn>}
      />

      {/* Sub-managers section */}
      {directManagers.length > 0 && (
        <Card style={{marginBottom:16}}>
          <div className="card-header"><div className="card-title">Managers</div></div>
          <div className="employees-grid">
            {directManagers.map(m => (
              <div key={m.id} className="emp-card">
                <Avatar name={m.name} color={m.avatar_color} textColor={m.avatar_text_color} size="lg" />
                <div className="emp-info">
                  <div className="emp-name">{m.name}</div>
                  <div className="emp-sub">{m.position} · {m.department}</div>
                  <div className="emp-email">{m.email}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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
              <Btn size="sm" variant="ghost" onClick={async () => {
                try { await revokeInvite(inv.id); show('Invite revoked.'); }
                catch (err) { show(err.message || 'Failed to revoke invite.', 'error'); }
              }}>Revoke</Btn>
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
                <Btn size="sm" variant="ghost" style={{marginTop:6,padding:'2px 8px',fontSize:11}} onClick={() => setAvailEmp(e)}>View availability</Btn>
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
              <FormRow label="Role">
                <Select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                </Select>
              </FormRow>
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
              <Btn variant="danger" onClick={handleRemove}>Remove member</Btn>
            </div>
          </>
        )}
      </Modal>

      {/* Employee availability */}
      <Modal isOpen={!!availEmp} onClose={() => setAvailEmp(null)} title={availEmp ? `${availEmp.name}'s availability` : 'Availability'}>
        {availEmp && <EmployeeAvailabilityView employeeId={availEmp.id} />}
      </Modal>
    </div>
  );
}

// ── Org Hierarchy (owner only) ────────────────────────────────────────────────
function TreeNode({ profile, childrenOf, depth }) {
  const children = childrenOf[profile.id] || [];
  return (
    <div style={{ marginLeft: depth * 28 }}>
      <div className="tree-node">
        <Avatar name={profile.name} color={profile.avatar_color} textColor={profile.avatar_text_color} size="md" />
        <div className="tree-node-info">
          <div className="tree-node-name">{profile.name}</div>
          <div className="tree-node-meta">
            {[profile.role, profile.position, profile.department].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
      {children.map(c => <TreeNode key={c.id} profile={c} childrenOf={childrenOf} depth={depth + 1} />)}
    </div>
  );
}

export function OrgHierarchy() {
  const { isOwner, org } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOwner) navigate('/manager/dashboard', { replace: true });
  }, [isOwner, navigate]);

  useEffect(() => {
    if (!org || !isOwner) return;
    supabase
      .from('profiles')
      .select('id,name,role,position,department,avatar_color,avatar_text_color,reports_to')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { setProfiles(data || []); setLoading(false); });
  }, [org, isOwner]);

  if (!isOwner) return null;
  if (loading) return <LoadingScreen />;

  const childrenOf = {};
  profiles.forEach(p => {
    const key = p.reports_to || '__root__';
    (childrenOf[key] = childrenOf[key] || []).push(p);
  });

  const owner = profiles.find(p => p.role === 'owner');
  const unassigned = (childrenOf['__root__'] || []).filter(p => p.role !== 'owner');

  return (
    <div className="page">
      <PageHeader title="Org hierarchy" subtitle={`${profiles.length} active members`} />
      <Card>
        {owner
          ? <TreeNode profile={owner} childrenOf={childrenOf} depth={0} />
          : <EmptyState icon="🏢" title="No data yet" message="Members appear here as they join." />
        }
      </Card>
      {unassigned.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <div className="card-header"><div className="card-title">Unassigned</div></div>
          <p style={{ fontSize:13, color:'var(--muted)', marginBottom:12 }}>These members have no manager assigned yet.</p>
          {unassigned.map(p => (
            <div key={p.id} className="list-item">
              <Avatar name={p.name} color={p.avatar_color} textColor={p.avatar_text_color} size="sm" />
              <div className="list-info">
                <div className="list-title">{p.name}</div>
                <div className="list-meta">{p.role} · {p.position}</div>
              </div>
            </div>
          ))}
        </Card>
      )}
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
