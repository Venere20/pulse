import type { Constellation } from './starCatalog';
import { ADDITIONAL_CONSTELLATIONS } from './starDrawings';
export const MEMORY_SYMBOLS = ['💗', '⭐', '🌙', '🌸', '🌈', '🍓', '🦋', '🎁', '☀️', '🎵', '🍀', '🐱'];
export interface MemoryState { deck: number[]; open: number[]; matched: number[]; moves: number }
export function newMemory(pairs: number, random = Math.random): MemoryState {
  const deck = Array.from({ length: pairs * 2 }, (_, i) => i % pairs);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return { deck, open: [], matched: [], moves: 0 };
}
export function validMemory(value: unknown, pairs: number): value is MemoryState {
  const s = value as MemoryState;
  return !!s && Array.isArray(s.deck) && s.deck.length === pairs * 2 && s.deck.every(n => Number.isInteger(n) && n >= 0 && n < pairs)
    && Array.from({ length: pairs }, (_, n) => s.deck.filter(v => v === n).length).every(n => n === 2)
    && Array.isArray(s.open) && s.open.length <= 2 && Array.isArray(s.matched) && s.matched.length % 2 === 0
    && [...s.open, ...s.matched].every(n => Number.isInteger(n) && n >= 0 && n < s.deck.length)
    && new Set([...s.open, ...s.matched]).size === s.open.length + s.matched.length
    && s.matched.every(n => s.matched.some(other => other !== n && s.deck[other] === s.deck[n]))
    && Number.isSafeInteger(s.moves) && s.moves >= 0;
}
export function flipMemory(s: MemoryState, index: number): MemoryState {
  if (s.open.length === 2 || s.open.includes(index) || s.matched.includes(index) || index < 0 || index >= s.deck.length) return s;
  return { ...s, open: [...s.open, index], moves: s.moves + (s.open.length === 1 ? 1 : 0) };
}
export function resolveMemory(s: MemoryState): MemoryState {
  if (s.open.length !== 2) return s;
  return { ...s, open: [], matched: s.deck[s.open[0]] === s.deck[s.open[1]] ? [...s.matched, ...s.open] : s.matched };
}
const ORIGINAL_CONSTELLATIONS = [
  { name: 'Un cuore per te', points: [[50,82],[18,48],[20,28],[35,18],[50,33],[65,18],[80,28],[82,48],[50,82]] },
  { name: 'Una stella', points: [[50,15],[70,78],[18,40],[82,40],[30,78],[50,15]] },
  { name: 'La nostra casa', points: [[22,78],[22,42],[50,18],[78,42],[78,78],[22,78],[22,42],[78,42]] },
  { name: 'Un aquilone', points: [[50,16],[77,40],[50,65],[23,40],[50,16],[50,65],[60,80],[45,86]] },
  { name: 'Verso il mare', points: [[15,58],[85,58],[70,80],[30,80],[15,58],[50,58],[50,18],[76,48],[50,48]] },
  { name: 'Infinito', points: [[50,50],[30,25],[15,30],[15,65],[30,75],[50,50],[70,25],[85,30],[85,65],[70,75],[50,50]] },
] as const;
export const CONSTELLATIONS: readonly Constellation[] = [...ORIGINAL_CONSTELLATIONS, ...ADDITIONAL_CONSTELLATIONS];
