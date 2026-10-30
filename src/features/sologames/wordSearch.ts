import { integer, isDifficulty, randomSeed, seeded, shuffled, stageSeed, SoloDifficulty } from './campaign';
import { ITALIAN_WORDS } from './italianWords';
export const SEARCH_ROUNDS = 200;
export interface SearchPuzzle { size: number; letters: string[]; words: { text: string; cells: number[] }[] }
export interface SearchState { v: 1; seed: number; difficulty: SoloDifficulty; level: number; found: { text: string; cells: number[] }[]; hints: string[]; score: number }
export function newWordSearch(difficulty: SoloDifficulty = 'normal', seed = randomSeed()): SearchState { return { v: 1, seed, difficulty, level: 0, found: [], hints: [], score: 0 }; }
export function searchPuzzle(s: Pick<SearchState, 'seed' | 'difficulty' | 'level'>): SearchPuzzle {
  const size = s.difficulty === 'easy' ? 8 : s.difficulty === 'hard' ? 10 : 9;
  const count = s.difficulty === 'easy' ? 6 : s.difficulty === 'hard' ? 10 : 8;
  const random = seeded(stageSeed(s.seed, s.level));
  const directions = s.difficulty === 'easy' ? [[1, 0], [0, 1]] : s.difficulty === 'normal' ? [[1, 0], [0, 1], [1, 1], [-1, 1]] : [[1, 0], [0, 1], [1, 1], [-1, 1], [-1, 0], [0, -1], [-1, -1], [1, -1]];
  for (let attempt = 0; attempt < 80; attempt++) {
    const letters = Array<string>(size * size).fill(''); const words: SearchPuzzle['words'] = [];
    for (const text of shuffled(ITALIAN_WORDS, random).slice(0, count)) {
      const options: number[][] = [];
      for (let cell = 0; cell < letters.length; cell++) for (const [dx, dy] of directions) {
        const x = cell % size, y = Math.floor(cell / size), ex = x + dx * (text.length - 1), ey = y + dy * (text.length - 1);
        if (ex < 0 || ex >= size || ey < 0 || ey >= size) continue;
        const cells = [...text].map((_, i) => (y + dy * i) * size + x + dx * i);
        if (cells.every((index, i) => !letters[index] || letters[index] === text[i])) options.push(cells);
      }
      if (!options.length) break;
      const cells = options[Math.floor(random() * options.length)];
      cells.forEach((cell, i) => { letters[cell] = text[i]; }); words.push({ text, cells });
    }
    if (words.length === count) {
      const alphabet = 'ABCDEFGHILMNOPQRSTUVZ';
      return { size, letters: letters.map(letter => letter || alphabet[Math.floor(random() * alphabet.length)]), words };
    }
  }
  throw new Error('Impossibile preparare la griglia');
}
export function searchLine(size: number, start: number, end: number): number[] | null {
  if (!integer(start, 0, size * size - 1) || !integer(end, 0, size * size - 1)) return null;
  const dx = end % size - start % size, dy = Math.floor(end / size) - Math.floor(start / size);
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return null;
  const length = Math.max(Math.abs(dx), Math.abs(dy)) + 1;
  return Array.from({ length }, (_, i) => (Math.floor(start / size) + Math.sign(dy) * i) * size + start % size + Math.sign(dx) * i);
}
export function findSearchWord(s: SearchState, start: number, end: number): SearchState {
  const puzzle = searchPuzzle(s), cells = searchLine(puzzle.size, start, end); if (!cells) return s;
  const text = cells.map(i => puzzle.letters[i]).join('');
  const word = puzzle.words.find(word => (word.text === text || word.text === [...text].reverse().join('')) && !s.found.some(found => found.text === word.text));
  return word ? { ...s, found: [...s.found, { text: word.text, cells }], score: s.score + 10 } : s;
}
export function hintSearch(s: SearchState): SearchState {
  if (s.hints.length === 3) return s;
  const word = searchPuzzle(s).words.find(word => !s.found.some(found => found.text === word.text) && !s.hints.includes(word.text));
  return word ? { ...s, hints: [...s.hints, word.text], score: Math.max(0, s.score - 3) } : s;
}
export function nextWordSearch(s: SearchState): SearchState {
  return s.found.length !== searchPuzzle(s).words.length || s.level === SEARCH_ROUNDS - 1 ? s : { ...s, level: s.level + 1, found: [], hints: [] };
}
export function validWordSearch(value: unknown): value is SearchState {
  const s = value as SearchState;
  if (!s || s.v !== 1 || !integer(s.seed, 0, 0xffffffff) || !isDifficulty(s.difficulty) || !integer(s.level, 0, SEARCH_ROUNDS - 1) || !integer(s.score, 0) || !Array.isArray(s.found) || !Array.isArray(s.hints) || s.hints.length > 3 || new Set(s.hints).size !== s.hints.length) return false;
  const puzzle = searchPuzzle(s);
  return s.hints.every(text => puzzle.words.some(word => word.text === text)) && s.found.length <= puzzle.words.length && new Set(s.found.map(found => found?.text)).size === s.found.length
    && s.found.every(found => found && typeof found.text === 'string' && Array.isArray(found.cells) && found.cells.length === found.text.length && puzzle.words.some(word => word.text === found.text)
      && found.cells.every(i => integer(i, 0, puzzle.size * puzzle.size - 1)) && searchLine(puzzle.size, found.cells[0], found.cells[found.cells.length - 1])?.join(',') === found.cells.join(',')
      && [found.text, [...found.text].reverse().join('')].includes(found.cells.map(i => puzzle.letters[i]).join('')));
}
