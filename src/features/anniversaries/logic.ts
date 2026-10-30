export interface Anniversary { id: string; author_id: string; title: string; first_day: string; annual: boolean; monthly?: boolean; emoji: string; notify: boolean }
export type AnniversaryRepeat = 'yearly' | 'monthly' | 'once';
export function anniversaryRepeat(a: Pick<Anniversary, 'annual' | 'monthly'>): AnniversaryRepeat {
  return a.monthly ? 'monthly' : a.annual ? 'yearly' : 'once';
}
export function validAnniversaryDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function monthlyDay(first: string, year: number, month: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(Number(first.slice(8, 10)), last)).padStart(2, '0')}`;
}
export function anniversaryDay(first: string, year: number) {
  return monthlyDay(first, year, Number(first.slice(5, 7)));
}
export function isAnniversaryToday(a: Anniversary, today: string) {
  if (!validAnniversaryDate(a.first_day) || a.first_day > today) return false;
  if (a.monthly) return today > a.first_day && monthlyDay(a.first_day, Number(today.slice(0, 4)), Number(today.slice(5, 7))) === today;
  return a.annual ? anniversaryDay(a.first_day, Number(today.slice(0, 4))) === today : a.first_day === today;
}
export function nextAnniversary(a: Anniversary, today: string) {
  if (!validAnniversaryDate(a.first_day)) return null;
  if (a.monthly) {
    const start = today > a.first_day ? today : a.first_day;
    let year = Number(start.slice(0, 4)), month = Number(start.slice(5, 7));
    let next = monthlyDay(a.first_day, year, month);
    if (next < today || next <= a.first_day) {
      if (++month > 12) { month = 1; year++; }
      next = monthlyDay(a.first_day, year, month);
    }
    return next;
  }
  if (!a.annual) return a.first_day >= today ? a.first_day : null;
  let year = Math.max(Number(today.slice(0, 4)), Number(a.first_day.slice(0, 4)));
  let next = anniversaryDay(a.first_day, year); if (next < today) next = anniversaryDay(a.first_day, ++year); return next;
}
