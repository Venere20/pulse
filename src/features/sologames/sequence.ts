import { integer, isDifficulty, randomSeed, seeded, stageSeed, SoloDifficulty } from './campaign';
export const SEQUENCE_ROUNDS = 120;
export interface SequenceState { v: 1; seed: number; difficulty: SoloDifficulty; level: number; input: number; lives: number; score: number; phase: 'ready' | 'input' | 'roundWon' | 'lost' | 'won' }
export function newSequence(difficulty: SoloDifficulty = 'normal', seed = randomSeed()): SequenceState {
  return { v: 1, seed, difficulty, level: 0, input: 0, lives: 5, score: 0, phase: 'ready' };
}
export function sequencePattern(s: SequenceState): number[] {
  const random = seeded(stageSeed(s.seed, s.level));
  const length = Math.min(24, (s.difficulty === 'easy' ? 2 : s.difficulty === 'hard' ? 4 : 3) + Math.floor(s.level / 5));
  return Array.from({ length }, () => Math.floor(random() * 4));
}
export function sequenceFlashMs(s: SequenceState) { return Math.max(300, (s.difficulty === 'easy' ? 800 : s.difficulty === 'hard' ? 480 : 650) - s.level * 3); }
export function sequenceInput(s: SequenceState, pad: number): SequenceState {
  if (s.phase !== 'input' || !integer(pad, 0, 3)) return s;
  const pattern = sequencePattern(s);
  if (pattern[s.input] !== pad) return { ...s, input: 0, lives: s.lives - 1, phase: s.lives === 1 ? 'lost' : 'ready' };
  const input = s.input + 1;
  const finished = input === pattern.length;
  return { ...s, input, phase: finished ? s.level === SEQUENCE_ROUNDS - 1 ? 'won' : 'roundWon' : 'input', score: s.score + (finished ? pattern.length * 10 : 0) };
}
export function advanceSequence(s: SequenceState): SequenceState {
  return s.phase !== 'roundWon' ? s : { ...s, level: s.level + 1, input: 0, phase: 'ready', lives: Math.min(5, s.lives + ((s.level + 1) % 10 === 0 ? 1 : 0)) };
}
export function validSequence(value: unknown): value is SequenceState {
  const s = value as SequenceState;
  if (!s || s.v !== 1 || !integer(s.seed, 0, 0xffffffff) || !isDifficulty(s.difficulty) || !integer(s.level, 0, SEQUENCE_ROUNDS - 1) || !integer(s.lives, 0, 5) || !integer(s.score, 0) || !integer(s.input, 0, 24)) return false;
  const length = sequencePattern(s).length;
  if (s.phase === 'lost') return s.lives === 0 && s.input === 0;
  if (s.lives === 0) return false;
  if (s.phase === 'ready') return s.input === 0;
  if (s.phase === 'input') return s.input < length;
  return (s.phase === 'won' && s.level === SEQUENCE_ROUNDS - 1 || s.phase === 'roundWon' && s.level < SEQUENCE_ROUNDS - 1) && s.input === length;
}
