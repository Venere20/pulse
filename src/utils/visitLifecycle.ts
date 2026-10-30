import type { Visit } from '../types/travel';

export function isVisitConcluded(visit: Visit, today: string): boolean {
  return visit.status === 'concluded' || !!visit.ended_at || (visit.timing_mode !== 'manual' && visit.end_date < today);
}

/** Use actual dates in summaries without changing the original travel plan. */
export function actualVisitDates(visit: Visit): Visit {
  const day = (value: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  return { ...visit, start_date: visit.started_at ? day(visit.started_at) : visit.start_date, end_date: visit.ended_at ? day(visit.ended_at) : visit.end_date };
}
