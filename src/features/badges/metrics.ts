import type { Visit, Settlement, DailyAnswer } from '../../types/travel';
import { mergeVisitDays } from '../../utils/statistics';
import { actualVisitDates, isVisitConcluded } from '../../utils/visitLifecycle';
import { journeyDistance } from '../journeys/model';
import { pulseStreak } from './pulseStreak';
export interface BadgeDef {
    id: string;
    family: string;
    tier: number;
    title: string;
    description: string;
    emoji: string;
    metric: string | null;
    threshold: number | null;
    hidden: boolean;
    sort: number;
}
export interface BadgeAward {
    badge_id: string;
    earned_on: string;
    awarded_at: string;
}
interface TimedValue {
    day: string;
    value: number;
}
export function badgeMetrics(visits: Visit[], settlements: Settlement[], answers: DailyAnswer[], bucket: {
    is_completed: boolean;
    created_at?: string;
}[], pulses: {
    day: string;
    count: number;
    sender_ids?: string[];
}[], today: string, pulseServerDay: string = today) {
    const dailyPulseStreak = pulseStreak(pulses, pulseServerDay);
    const past = visits.filter(v => isVisitConcluded(v, today)).map(actualVisitDates).sort((a, b) => a.end_date.localeCompare(b.end_date));
    const metrics: Record<string, TimedValue[]> = { visits: past.map(v => ({ day: v.end_date, value: 1 })), km: past.flatMap(v => { const km = journeyDistance(v).totalKm; return km === null ? [] : [{ day: v.end_date, value: km }]; }),
        shared_km: past.flatMap(v => { const km = journeyDistance(v).sharedKm; return km === null ? [] : [{ day: v.end_date, value: km }]; }),
        settlements: settlements.map(s => ({ day: s.created_at?.slice(0, 10) ?? today, value: 1 })), pulses: pulses.map(p => ({ day: p.day, value: p.count })),
        // Legacy bucket items don't preserve completed_at. Use today's observation,
        // rather than falsely claiming that completion happened on created_at.
        bucket: bucket.filter(b => b.is_completed).map(() => ({ day: today, value: 1 })), days: [], wait: [], streak: [], pulse_streak: dailyPulseStreak.events };
    const ranges = mergeVisitDays(past);
    for (let i = 0; i < ranges.length; i++) {
        const r = ranges[i];
        for (let time = r.start; time <= r.end; time += 86400000)
            metrics.days.push({ day: new Date(time).toISOString().slice(0, 10), value: 1 });
        if (i) {
            const days = Math.max(0, (r.start - ranges[i - 1].end) / 86400000 - 1);
            metrics.wait.push({ day: new Date(r.start).toISOString().slice(0, 10), value: days });
        }
    }
    const answered = new Map<string, Set<string>>();
    for (const a of answers) {
        const day = a.day.slice(0, 10);
        if (!answered.has(day))
            answered.set(day, new Set());
        answered.get(day)!.add(a.user_id);
    }
    const paired = [...answered].filter(([, users]) => users.size === 2).map(([day]) => day).sort();
    let streak = 0;
    let previous = '';
    for (const day of paired) {
        streak = Date.parse(day) - Date.parse(previous) === 86400000 ? streak + 1 : 1;
        metrics.streak.push({ day, value: streak });
        previous = day;
    }
    for (const values of Object.values(metrics))
        values.sort((a, b) => a.day.localeCompare(b.day));
    const totals: Record<string, number> = {};
    for (const [key, values] of Object.entries(metrics))
        totals[key] = ['wait', 'streak', 'pulse_streak'].includes(key) ? Math.max(0, ...values.map(v => v.value)) : values.reduce((sum, v) => sum + v.value, 0);
    const earned = (metric: string, threshold: number) => { let sum = 0; for (const v of metrics[metric] ?? []) {
        sum = ['wait', 'streak', 'pulse_streak'].includes(metric) ? v.value : sum + v.value;
        if (sum >= threshold)
            return v.day;
    } return null; };
    const secrets: {
        badge_id: string;
        earned_on: string;
    }[] = [];
    for (const [id, mmdd] of [['secret_newyear', '01-01'], ['secret_valentine', '02-14']]) {
        const dates = past.flatMap(v => { const result: string[] = []; for (let y = Number(v.start_date.slice(0, 4)); y <= Number(v.end_date.slice(0, 4)); y++) {
            const day = `${y}-${mmdd}`;
            if (day >= v.start_date && day <= v.end_date)
                result.push(day);
        } return result; }).sort();
        if (dates[0])
            secrets.push({ badge_id: id, earned_on: dates[0] });
    }
    return { totals, earned, secrets, pulseStreak: dailyPulseStreak };
}
