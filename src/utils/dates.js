export function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function toISO(date) {
  return date.toISOString().slice(0, 10);
}

export function buildWeek(weekStart) {
  return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((key, i) => {
    const d = addDays(weekStart, i);
    return { key, date: toISO(d), num: d.getDate(), month: d.getMonth() };
  });
}

export function fmtWeekRange(weekStart) {
  const end = addDays(weekStart, 6);
  const s = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

export function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function initials(name = '') {
  return name.trim().split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
}

const COLORS = ['blue', 'green', 'amber', 'red', 'purple'];
export function colorFor(id) {
  // deterministic color from uuid
  const n = id ? parseInt(id.replace(/-/g, '').slice(0, 8), 16) : 0;
  return COLORS[n % COLORS.length];
}
