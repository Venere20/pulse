import { integer, isDifficulty, randomSeed, seeded, shuffled, SoloDifficulty } from './campaign';
import { ITALIAN_WORDS } from './italianWords';
export const SECRET_WORD_ROUNDS = 200;
export type LetterClue = 'correct' | 'present' | 'absent';
export interface SecretWordState { v: 1; difficulty: SoloDifficulty; order: number[]; index: number; guesses: string[]; hints: number[]; score: number; solved: number; streak: number }
const vocabulary = new Set(ITALIAN_WORDS);
export const normaliseWord = (s: string) => s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
export const guessLimit = (difficulty: SoloDifficulty) => difficulty === 'easy' ? 8 : difficulty === 'hard' ? 5 : 6;
export const hintLimit = (difficulty: SoloDifficulty) => difficulty === 'easy' ? 2 : difficulty === 'hard' ? 0 : 1;
export function newSecretWord(difficulty: SoloDifficulty = 'normal', seed = randomSeed()): SecretWordState {
  return { v: 1, difficulty, order: shuffled(ITALIAN_WORDS.map((_, i) => i), seeded(seed)).slice(0, SECRET_WORD_ROUNDS), index: 0, guesses: [], hints: [], score: 0, solved: 0, streak: 0 };
}
export const secretTarget = (s: SecretWordState) => ITALIAN_WORDS[s.order[s.index]];
export function wordClues(target: string, guess: string): LetterClue[] {
  const result: LetterClue[] = Array(5).fill('absent'); const remaining = target.split('');
  for (let i = 0; i < 5; i++) if (guess[i] === target[i]) { result[i] = 'correct'; remaining[i] = ''; }
  for (let i = 0; i < 5; i++) if (result[i] !== 'correct') { const found = remaining.indexOf(guess[i]); if (found >= 0) { result[i] = 'present'; remaining[found] = ''; } }
  return result;
}
export function wordResult(s: SecretWordState) { return s.guesses.includes(secretTarget(s)) ? 'won' : s.guesses.length === guessLimit(s.difficulty) ? 'lost' : 'playing'; }
export function guessError(s: SecretWordState, input: string) {
  const word = normaliseWord(input);
  return !/^[A-Z]{5}$/.test(word) ? 'Scrivi una parola di cinque lettere.' : !vocabulary.has(word) ? 'Questa parola non è nel vocabolario del gioco. Provane un’altra.' : s.guesses.includes(word) ? 'Hai già provato questa parola.' : null;
}
export function guessWord(s: SecretWordState, input: string): SecretWordState {
  if (wordResult(s) !== 'playing' || guessError(s, input)) return s;
  const word = normaliseWord(input), guesses = [...s.guesses, word], won = word === secretTarget(s);
  return { ...s, guesses, score: s.score + (won ? Math.max(5, (guessLimit(s.difficulty) - guesses.length + 1) * 10 - s.hints.length * 5) : 0), solved: s.solved + (won ? 1 : 0), streak: won ? s.streak + 1 : guesses.length === guessLimit(s.difficulty) ? 0 : s.streak };
}
export function revealLetter(s: SecretWordState): SecretWordState {
  if (wordResult(s) !== 'playing' || s.hints.length >= hintLimit(s.difficulty)) return s;
  const target = secretTarget(s);
  const index = [...target].findIndex((_, i) => !s.hints.includes(i) && !s.guesses.some(g => g[i] === target[i]));
  return index < 0 ? s : { ...s, hints: [...s.hints, index] };
}
export function nextSecretWord(s: SecretWordState): SecretWordState {
  return wordResult(s) === 'playing' || s.index === s.order.length - 1 ? s : { ...s, index: s.index + 1, guesses: [], hints: [] };
}
export function validSecretWord(value: unknown): value is SecretWordState {
  const s = value as SecretWordState;
  if (!s || s.v !== 1 || !isDifficulty(s.difficulty) || !Array.isArray(s.order) || s.order.length !== SECRET_WORD_ROUNDS || new Set(s.order).size !== s.order.length || !s.order.every(i => integer(i, 0, ITALIAN_WORDS.length - 1)) || !integer(s.index, 0, SECRET_WORD_ROUNDS - 1)) return false;
  if (!Array.isArray(s.guesses) || s.guesses.length > guessLimit(s.difficulty) || new Set(s.guesses).size !== s.guesses.length || !s.guesses.every(w => vocabulary.has(w)) || !Array.isArray(s.hints) || s.hints.length > hintLimit(s.difficulty) || new Set(s.hints).size !== s.hints.length || !s.hints.every(i => integer(i, 0, 4))) return false;
  const correct = s.guesses.indexOf(secretTarget(s));
  return (correct < 0 || correct === s.guesses.length - 1) && integer(s.score, 0) && integer(s.solved, 0, s.index + 1) && integer(s.streak, 0, s.solved);
}
