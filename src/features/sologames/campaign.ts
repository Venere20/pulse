export type SoloDifficulty = 'easy' | 'normal' | 'hard';
export const SOLO_DIFFICULTIES: { key: SoloDifficulty; label: string }[] = [
  { key: 'easy', label: 'Facile' }, { key: 'normal', label: 'Normale' }, { key: 'hard', label: 'Difficile' },
];
export const isDifficulty = (v: unknown): v is SoloDifficulty => ['easy', 'normal', 'hard'].includes(v as string);
export const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function randomSeed() { return Math.floor(Math.random() * 0x100000000) >>> 0; }
export function seeded(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
export function shuffled<T>(values: readonly T[], random: () => number) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function stageSeed(seed: number, level: number) { return (seed ^ Math.imul(level + 1, 0x9e3779b1)) >>> 0; }
