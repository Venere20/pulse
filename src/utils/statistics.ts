import type { Visit, Expense } from '../types/travel';
import { actualVisitDates, isVisitConcluded } from './visitLifecycle';
import { journeyDistance } from '../features/journeys/model';
export type StatsPeriod = 'all' | number | 'last12';
const epoch = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z');
const dayMs = 86400000;
export function mergeVisitDays(visits: Visit[]): {
    start: number;
    end: number;
}[] {
    const ranges = visits.map(v => ({ start: epoch(v.start_date), end: epoch(v.end_date) })).filter(v => Number.isFinite(v.start) && v.end >= v.start).sort((a, b) => a.start - b.start);
    const merged: {
        start: number;
        end: number;
    }[] = [];
    for (const r of ranges) {
        const last = merged[merged.length - 1];
        if (last && r.start <= last.end + dayMs)
            last.end = Math.max(last.end, r.end);
        else
            merged.push({ ...r });
    }
    return merged;
}
/** A visit belongs to the period by its start date. Unassigned expenses join once. */
export function computeStats(visits: Visit[], expenses: Expense[], today: string, period: StatsPeriod = 'all') {
    const current = epoch(today);
    const rolling = new Date(current);
    rolling.setUTCMonth(rolling.getUTCMonth() - 12);
    const selected = visits.filter(v => isVisitConcluded(v, today)).map(actualVisitDates).filter(v => period === 'all' || (period === 'last12' ? epoch(v.start_date) >= rolling.getTime() : Number(v.start_date.slice(0, 4)) === period));
    const ranges = mergeVisitDays(selected);
    // Exact time is available only when both actual confirmations are recorded.
    // Merge overlaps so two visits cannot count the same minute twice.
    const actualRanges = selected.map(v => ({ start: Date.parse(v.started_at ?? ''), end: Date.parse(v.ended_at ?? '') }))
        .filter(v => Number.isFinite(v.start) && Number.isFinite(v.end) && v.end >= v.start).sort((a, b) => a.start - b.start);
    const actualMerged: { start: number; end: number }[] = [];
    for (const range of actualRanges) {
        const last = actualMerged[actualMerged.length - 1];
        if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
        else actualMerged.push({ ...range });
    }
    const togetherMinutes = Math.floor(actualMerged.reduce((sum, range) => sum + range.end - range.start, 0) / 60000);
    const ids = new Set(selected.map(v => v.id));
    const waits = ranges.slice(1).map((r, i) => Math.max(0, (r.start - ranges[i].end) / dayMs - 1));
    const assigned = expenses.filter(e => e.visit_id ? ids.has(e.visit_id) : selected.some(v => e.date.slice(0, 10) >= v.start_date && e.date.slice(0, 10) <= v.end_date));
    const byCategory: Record<string, number> = {};
    const byPayer: Record<string, number> = {};
    for (const e of assigned) {
        const amount = Number(e.amount);
        if (!Number.isFinite(amount) || amount < 0)
            continue;
        byCategory[e.category ?? 'Altro'] = (byCategory[e.category ?? 'Altro'] ?? 0) + amount;
        byPayer[e.paid_by] = (byPayer[e.paid_by] ?? 0) + amount;
    }
    const months = Array.from({ length: 12 }, (_, i) => { const date = new Date(current); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - 11 + i); const key = date.toISOString().slice(0, 7); return { month: key, count: selected.filter(v => v.start_date.startsWith(key)).length }; });
    const distances = selected.map(journeyDistance);
    const km = distances.filter(v => v.totalKm !== null);
    return { visits: selected.length, days: ranges.reduce((sum, r) => sum + (r.end - r.start) / dayMs + 1, 0), togetherMinutes, timedVisits: actualRanges.length, averageWait: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0,
        longestWait: Math.max(0, ...waits), travelKm: km.reduce((sum, v) => sum + v.totalKm!, 0), missingKm: selected.length - km.length,
        sharedTravelKm: distances.reduce((sum, v) => sum + (v.sharedKm ?? 0), 0), unverifiedShared: distances.filter(v => v.sharedKm === null).length,
        spent: Object.values(byCategory).reduce((a, b) => a + b, 0), byCategory, byPayer, months, selected };
}
