import { integer, isDifficulty, randomSeed, SoloDifficulty } from './campaign';
export const CLOUD_WAVES = 100;
export const CLOUD_WAVE_MS = 30000;
export interface CloudItem { id: number; lane: number; born: number; duration: number; kind: 'cloud' | 'star' | 'heart' }
export interface CloudsState { v: 1; difficulty: SoloDifficulty; rng: number; elapsed: number; lane: number; lives: number; score: number; dodged: number; stars: number; nextSpawn: number; serial: number; shieldUntil: number; items: CloudItem[]; phase: 'ready' | 'running' | 'paused' | 'over' | 'won' }
export function newClouds(difficulty: SoloDifficulty = 'normal', seed = randomSeed()): CloudsState {
  return { v: 1, difficulty, rng: seed, elapsed: 0, lane: 1, lives: 5, score: 0, dodged: 0, stars: 0, nextSpawn: 900, serial: 0, shieldUntil: 0, items: [], phase: 'ready' };
}
export function cloudWave(s: CloudsState) { return Math.min(CLOUD_WAVES, Math.floor(s.elapsed / CLOUD_WAVE_MS) + 1); }
export function cloudsStep(s: CloudsState, delta: number): CloudsState {
  if (s.phase !== 'running' || !Number.isFinite(delta) || delta <= 0) return s;
  const elapsed = Math.min(CLOUD_WAVES * CLOUD_WAVE_MS, s.elapsed + Math.min(100, delta));
  let { lives, score, dodged, stars, shieldUntil, rng, nextSpawn, serial } = s;
  score += Math.floor(elapsed / 1000) - Math.floor(s.elapsed / 1000);
  const wave = Math.floor(elapsed / CLOUD_WAVE_MS);
  if (wave > Math.floor(s.elapsed / CLOUD_WAVE_MS) && wave % 5 === 0) lives = Math.min(5, lives + 1);
  const items: CloudItem[] = [];
  for (const item of s.items) {
    const before = (s.elapsed - item.born) / item.duration, after = (elapsed - item.born) / item.duration;
    if (item.lane === s.lane && before <= 0.94 && after >= 0.78) {
      if (item.kind === 'star') { stars++; score += 25; }
      else if (item.kind === 'heart') lives = Math.min(5, lives + 1);
      else if (elapsed >= shieldUntil) { lives--; shieldUntil = elapsed + 1600; }
    } else if (after >= 1) { if (item.kind === 'cloud') { dodged++; score += 2; } }
    else items.push(item);
  }
  const random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };
  while (elapsed >= nextSpawn) {
    const lane = Math.floor(random() * 3), roll = random();
    items.push({ id: serial++, lane, kind: roll < 0.78 ? 'cloud' : roll < 0.95 ? 'star' : 'heart', born: nextSpawn, duration: Math.max(1800, 4400 - wave * 24 + (s.difficulty === 'easy' ? 500 : s.difficulty === 'hard' ? -550 : 0)) });
    nextSpawn += Math.max(650, (s.difficulty === 'easy' ? 1400 : s.difficulty === 'hard' ? 950 : 1200) - wave * 6);
  }
  return { ...s, elapsed, lives: Math.max(0, lives), score, dodged, stars, shieldUntil, rng, nextSpawn, serial, items,
    phase: lives <= 0 ? 'over' : elapsed === CLOUD_WAVES * CLOUD_WAVE_MS ? 'won' : 'running' };
}
export function cloudLane(s: CloudsState, lane: number): CloudsState { return s.phase !== 'running' || !integer(lane, 0, 2) ? s : { ...s, lane }; }
export function validClouds(value: unknown): value is CloudsState {
  const s = value as CloudsState;
  if (!s || s.v !== 1 || !isDifficulty(s.difficulty) || !integer(s.rng, 0, 0xffffffff) || !Number.isFinite(s.elapsed) || s.elapsed < 0 || s.elapsed > CLOUD_WAVES * CLOUD_WAVE_MS || !integer(s.lane, 0, 2) || !integer(s.lives, 0, 5) || !integer(s.score, 0) || !integer(s.dodged, 0) || !integer(s.stars, 0) || !integer(s.serial, 0) || !Number.isFinite(s.nextSpawn) || s.nextSpawn <= s.elapsed || s.nextSpawn > s.elapsed + 1500 || !Number.isFinite(s.shieldUntil) || s.shieldUntil < 0 || s.shieldUntil > s.elapsed + 1600) return false;
  if (!['ready', 'running', 'paused', 'over', 'won'].includes(s.phase) || s.phase === 'over' && s.lives !== 0 || s.phase !== 'over' && s.lives === 0 || s.phase === 'won' && s.elapsed !== CLOUD_WAVES * CLOUD_WAVE_MS) return false;
  return Array.isArray(s.items) && s.items.length <= 12 && new Set(s.items.map(item => item?.id)).size === s.items.length && s.items.every(item => item && integer(item.id, 0, s.serial - 1) && integer(item.lane, 0, 2) && Number.isFinite(item.born) && item.born >= 0 && item.born <= s.elapsed && Number.isFinite(item.duration) && item.duration >= 1800 && item.duration <= 4900 && (s.elapsed - item.born) < item.duration && ['cloud', 'star', 'heart'].includes(item.kind));
}
