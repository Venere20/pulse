import { CONSTELLATIONS } from './logic';

export interface SkyState {
  schema: 2;
  order: number[];
  index: number;
  next: number;
  completed: number;
}
function shuffle(values: number[], random: () => number) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function newSky(completed = 0, random = Math.random): SkyState {
  return { schema: 2, order: shuffle(CONSTELLATIONS.map((_, i) => i), random), index: 0, next: 0, completed };
}
function validOrder(value: unknown): value is SkyState {
  const s = value as SkyState;
  return !!s && s.schema === 2 && Array.isArray(s.order) && s.order.length > 0 && s.order.length <= CONSTELLATIONS.length
    && s.order.every(id => Number.isInteger(id) && id >= 0 && id < CONSTELLATIONS.length)
    && new Set(s.order).size === s.order.length && Number.isInteger(s.index) && s.index >= 0 && s.index < s.order.length
    && Number.isInteger(s.next) && s.next >= 0 && s.next <= CONSTELLATIONS[s.order[s.index]].points.length
    && Number.isSafeInteger(s.completed) && s.completed >= s.index + (s.next === CONSTELLATIONS[s.order[s.index]].points.length ? 1 : 0);
}
export function validSky(value: unknown): value is SkyState {
  return validOrder(value) && value.order.length === CONSTELLATIONS.length;
}
export function migrateSky(value: unknown, random = Math.random): SkyState | null {
  if (validOrder(value)) {
    const missing = CONSTELLATIONS.map((_, i) => i).filter(id => !value.order.includes(id));
    return { ...value, order: [...value.order, ...shuffle(missing, random)] };
  }
  const old = value as { level: number; next: number; completed: number } | null;
  if (!old || 'schema' in old || !Number.isInteger(old.level) || old.level < 0 || old.level >= 6
    || !Number.isInteger(old.next) || old.next < 0 || old.next > CONSTELLATIONS[old.level].points.length
    || !Number.isSafeInteger(old.completed) || old.completed < 0) return null;
  const played = Array.from({ length: old.completed >= 6 ? 6 : old.level }, (_, i) => i).filter(id => id !== old.level);
  const remaining = CONSTELLATIONS.map((_, i) => i).filter(id => id !== old.level && !played.includes(id));
  const finished = old.next === CONSTELLATIONS[old.level].points.length;
  return { schema: 2, order: [...played, old.level, ...shuffle(remaining, random)], index: played.length,
    next: old.next, completed: Math.max(old.completed, played.length + (finished ? 1 : 0)) };
}
export function touchStar(s: SkyState, index: number): SkyState {
  const length = CONSTELLATIONS[s.order[s.index]].points.length;
  if (index !== s.next || s.next >= length) return s;
  return { ...s, next: s.next + 1, completed: s.completed + (s.next + 1 === length ? 1 : 0) };
}
export function nextSky(s: SkyState): SkyState {
  if (s.next !== CONSTELLATIONS[s.order[s.index]].points.length || s.index === s.order.length - 1) return s;
  return { ...s, index: s.index + 1, next: 0 };
}
export function retrySky(s: SkyState): SkyState {
  return s.next === CONSTELLATIONS[s.order[s.index]].points.length ? s : { ...s, next: 0 };
}
