import type { Visit, Expense, VisitBucketLink } from '../../types/travel';
import type { BucketItem } from '../../types/bucket';
import { romeDay } from '../../utils/together';
import { actualVisitDates, isVisitConcluded } from '../../utils/visitLifecycle';
export function shiftMonth(month: string, by: number) {
  const date = new Date(`${month}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + by); return date.toISOString().slice(0, 7);
}
export function monthlyRecap(month: string, today: string, visits: Visit[], expenses: Expense[], bucket: BucketItem[], links: VisitBucketLink[] = []) {
  const start = `${month}-01`; const end = shiftMonth(month, 1) + '-01';
  const meetings = visits.filter(v => v.timing_mode !== 'manual' || !!v.started_at || !!v.ended_at).map(actualVisitDates)
    .map(v => v.timing_mode === 'manual' && v.started_at && !v.ended_at ? { ...v, end_date: today } : v)
    .filter(v => v.start_date < end && v.end_date >= start && v.start_date <= today);
  const days = new Set<string>();
  for (const v of meetings) {
    const first = v.start_date > start ? v.start_date : start;
    const last = v.end_date < today ? v.end_date : today;
    for (let stamp = Date.parse(first); stamp <= Date.parse(last) && stamp < Date.parse(end); stamp += 86400000) days.add(new Date(stamp).toISOString().slice(0, 10));
  }
  const visitIds = new Set(visits.map(v => v.id));
  const spent = expenses.filter(e => e.visit_id && visitIds.has(e.visit_id) && e.date >= start && e.date < end && e.date <= today).reduce((sum, e) => sum + Number(e.amount), 0);
  // Recording an old outing today must not move its fulfilled wishes to today.
  // Use the first concluded outing; keep completed_at as the independent fallback.
  const concluded = new Map(visits.filter(v => isVisitConcluded(v, today)).map(v => [v.id, actualVisitDates(v).end_date]));
  const fulfilledDays = new Map<string, string>();
  for (const link of links) {
    const day = concluded.get(link.visit_id);
    if (!day || day > today) continue;
    const previous = fulfilledDays.get(link.bucket_item_id);
    if (!previous || day < previous) fulfilledDays.set(link.bucket_item_id, day);
  }
  const wishes = bucket.filter(b => {
    if (!b.is_completed) return false;
    const stamp = b.completed_at ? Date.parse(b.completed_at) : NaN;
    const day = fulfilledDays.get(b.id) ?? (Number.isFinite(stamp) ? romeDay(stamp) : null);
    return day !== null && day >= start && day < end && day <= today;
  });
  return { meetings, days: days.size, spent, wishes };
}
