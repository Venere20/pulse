export type HeartKind = 'normal' | 'gold' | 'bomb';
export const HEART_DIFFICULTIES = {
  easy: { label: 'Facile', seconds: 45, maxSeconds: 90, targets: 3, bombChance: 0.10, goldChance: 0.25, penalty: 2, bonus: 3, lifetime: 1500, minimumLifetime: 900 },
  normal: { label: 'Normale', seconds: 30, maxSeconds: 60, targets: 4, bombChance: 0.25, goldChance: 0.15, penalty: 3, bonus: 2, lifetime: 1200, minimumLifetime: 650 },
  hard: { label: 'Difficile', seconds: 20, maxSeconds: 40, targets: 5, bombChance: 0.40, goldChance: 0.08, penalty: 4, bonus: 1, lifetime: 900, minimumLifetime: 450 },
} as const;
export type HeartDifficulty = keyof typeof HEART_DIFFICULTIES;
export interface HeartTarget { id: number; cell: number; kind: HeartKind }
export function heartKind(difficulty: HeartDifficulty, roll: number): HeartKind {
  const config = HEART_DIFFICULTIES[difficulty];
  return roll < config.bombChance ? 'bomb' : roll < config.bombChance + config.goldChance ? 'gold' : 'normal';
}
export function heartWave(difficulty: HeartDifficulty, firstId: number, random = Math.random): HeartTarget[] {
  const available = Array.from({ length: 16 }, (_, i) => i);
  return Array.from({ length: HEART_DIFFICULTIES[difficulty].targets }, (_, i) => {
    const cell = available.splice(Math.floor(random() * available.length), 1)[0];
    return { id: firstId + i, cell, kind: heartKind(difficulty, random()) };
  });
}
export function heartEffect(kind: HeartKind, difficulty: HeartDifficulty, leftMs: number, elapsedMs: number) {
  const config = HEART_DIFFICULTIES[difficulty];
  const delta = kind === 'gold' ? config.bonus * 1000 : kind === 'bomb' ? -config.penalty * 1000 : 0;
  const time = Math.max(0, Math.min(leftMs + delta, config.maxSeconds * 1000 - elapsedMs));
  return { points: kind === 'bomb' ? 0 : kind === 'gold' ? 3 : 1, time, change: time - leftMs };
}
export function waveLifetime(difficulty: HeartDifficulty, hits: number) {
  const config = HEART_DIFFICULTIES[difficulty];
  return Math.max(config.minimumLifetime, config.lifetime - hits * 10);
}
