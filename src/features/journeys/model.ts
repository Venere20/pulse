import type { Visit } from '../../types/travel';

export const TRAVEL_MODES = ['Treno', 'Metro', 'Auto', 'Bus', 'Traghetto', 'Aliscafo', 'Cammino', 'Aereo'] as const;
export type TravelMode = typeof TRAVEL_MODES[number];
export interface JourneyLeg {
  id: string; from: string; to: string; mode: TravelMode | 'Misto' | 'Non specificato';
  participants: string[]; direction: 'out' | 'back'; distance_m: number;
  source: 'api' | 'reference' | 'manual';
}
export interface JourneyPlan {
  version: 1; counting: 'shared-once'; confirmed_at: string; legs: JourneyLeg[];
  meeting_point?: string | null;
}
export const SHARED_KM_LEVELS = [
  { threshold: 500, title: 'Stessa strada', tier: 1 },
  { threshold: 2000, title: 'Compagni di viaggio', tier: 2 },
  { threshold: 10000, title: 'Il mondo insieme', tier: 3 },
] as const;

/** Unknown historic distance is never treated as shared distance. */
export function journeyDistance(visit: Pick<Visit, 'journey_plan' | 'journey_totals' | 'travel_km' | 'meeting_point'>) {
  const plan = visit.journey_plan;
  const contextMatches = (value: { meeting_point?: string | null }) => value.meeting_point === undefined || value.meeting_point === (visit.meeting_point ?? null);
  if (plan?.version === 1 && contextMatches(plan) && plan.counting === 'shared-once' && Array.isArray(plan.legs) && plan.legs.length > 0) {
    const seen = new Set<string>(); let out = 0, back = 0, shared = 0;
    for (const leg of plan.legs) {
      if (!leg || typeof leg.id !== 'string' || seen.has(leg.id)) return { totalKm: null, sharedKm: null, verified: false };
      seen.add(leg.id);
      if (!Number.isSafeInteger(leg.distance_m) || leg.distance_m < 0 || !['out', 'back'].includes(leg.direction) || !Array.isArray(leg.participants) || ![1, 2].includes(leg.participants.length) || new Set(leg.participants).size !== leg.participants.length) return { totalKm: null, sharedKm: null, verified: false };
      if (leg.direction === 'out') out += leg.distance_m; else back += leg.distance_m;
      if (leg.participants.length === 2) shared += leg.distance_m;
    }
    return { totalKm: (out + back) / 1000, sharedKm: shared / 1000, outKm: out / 1000, backKm: back / 1000, verified: true };
  }
  const s = visit.journey_totals;
  if (s?.version === 1 && contextMatches(s) && [s.total_m,s.shared_m,s.out_m,s.back_m].every(n => Number.isSafeInteger(n) && n >= 0) && s.total_m === s.out_m + s.back_m && s.shared_m <= s.total_m)
    return { totalKm: s.total_m / 1000, sharedKm: s.shared_m / 1000, outKm: s.out_m / 1000, backKm: s.back_m / 1000, verified: true };
  const old = visit.travel_km == null ? NaN : Number(visit.travel_km);
  return { totalKm: Number.isFinite(old) && old >= 0 ? 2 * old : null, sharedKm: null, verified: false };
}

export type MidpointCriterion = 'time' | 'distance';
export interface MeetingCandidate {
  id: string; name: string; lat: number; lon: number;
  mine: { meters: number; minutes: number | null };
  partner: { meters: number; minutes: number | null };
  source: 'api' | 'reference' | 'demo';
}
/** Compare only reachable candidates; prevent long equal detours winning ties. */
export function rankMeetingCandidates(candidates: MeetingCandidate[], criterion: MidpointCriterion = 'time') {
  return candidates.filter(c => c && typeof c.id === 'string' && !!c.id && typeof c.name === 'string' && !!c.name && c.mine && c.partner && [c.lat, c.lon, c.mine.meters, c.partner.meters].every(Number.isFinite) && Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180 && c.mine.meters >= 0 && c.partner.meters >= 0 &&
    (criterion !== 'time' || (c.mine.minutes !== null && c.partner.minutes !== null && [c.mine.minutes, c.partner.minutes].every(v => Number.isFinite(v) && Number(v) >= 0))))
    .map(c => { const a = criterion === 'time' ? c.mine.minutes! : c.mine.meters / 1000, b = criterion === 'time' ? c.partner.minutes! : c.partner.meters / 1000;
      return { ...c, difference: Math.abs(a - b), score: Math.abs(a - b) + .15 * Math.max(a, b) }; })
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
}
