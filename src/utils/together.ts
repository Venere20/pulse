import type { Visit } from '../types/travel';
export const VISIT_TIMEZONE = 'Europe/Rome';
export function romeDay(now: number): string {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: VISIT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const p = (k: string) => parts.find(x => x.type === k)?.value ?? '';
    return `${p('year')}-${p('month')}-${p('day')}`;
}
/** Translate a Rome wall clock to an instant, independently of device timezone. */
export function romeMoment(day: string, time = '00:00'): number {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time))return NaN;
    const [y, m, d] = day.slice(0, 10).split('-').map(Number);
    const [h, mi] = time.split(':').map(Number);
    const wall = Date.UTC(y, m - 1, d, h, mi);
    if(new Date(wall).toISOString().slice(0,10)!==day)return NaN;
    let instant = wall;
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: VISIT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    for (let i = 0; i < 3; i++) {
        const parts = fmt.formatToParts(instant);
        const p = (k: string) => Number(parts.find(x => x.type === k)?.value);
        const rendered = Date.UTC(p('year'), p('month') - 1, p('day'), p('hour'), p('minute'), p('second'));
        instant += wall - rendered;
    }
    const roundtrip=fmt.formatToParts(instant);
    const part=(key:string)=>Number(roundtrip.find(p=>p.type===key)?.value);
    return part('year')===y&&part('month')===m&&part('day')===d&&part('hour')===h&&part('minute')===mi?instant:NaN;
}
export function togetherState(visits: Visit[], manual: string | null, now: number) {
    const today = romeDay(now);
    const visit = visits.find(v => v.status !== 'concluded' && !v.ended_at && (v.timing_mode === 'manual'
      ? !!v.started_at
      : now >= romeMoment(v.start_date, v.arrival_time?.match(/^\d{1,2}:\d{2}$/) ? v.arrival_time : '00:00') && now < romeMoment(v.end_date, '23:59') + 60000)) ?? null;
    const start = visit ? visit.started_at ? Date.parse(visit.started_at) : romeMoment(visit.start_date, visit.arrival_time ?? '00:00') : null;
    const end = visit && visit.timing_mode !== 'manual' ? romeMoment(visit.end_date, '23:59') + 60000 : null;
    return { active: !!visit || manual === 'together', visit, dayIndex: visit ? Math.floor((Date.parse(today) - Date.parse(visit.started_at ? romeDay(Date.parse(visit.started_at)) : visit.start_date)) / 86400000) + 1 : null,
        dayCount: visit ? Math.floor((Date.parse(visit.end_date) - Date.parse(visit.start_date)) / 86400000) + 1 : null,
        elapsedMs: (visit?.started_at || visit?.arrival_time) && start !== null ? Math.max(0, now - start) : null, remainingMs: visit?.arrival_time && end !== null ? end - now : null };
}
