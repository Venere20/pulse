import { integer, randomSeed, seeded, stageSeed } from './campaign';
export const PUZZLE_ROUNDS = 200;
export type PuzzleSize = 3 | 4 | 5;
export interface SlidingState { v: 1; seed: number; size: PuzzleSize; level: number; board: number[]; initial: number[]; seen: string[]; history: number[][]; moves: number; totalMoves: number; completed: number }
export const solvedBoard = (size: number) => Array.from({ length: size * size }, (_, i) => (i + 1) % (size * size));
export const puzzleSolved = (board: number[]) => board.every((value, i) => value === (i + 1) % board.length);
export function neighbours(size: number, blank: number) { return [blank - size, blank + size, blank - 1, blank + 1].filter(i => i >= 0 && i < size * size && Math.abs(i % size - blank % size) + Math.abs(Math.floor(i / size) - Math.floor(blank / size)) === 1); }
export function puzzleSolvable(board: number[], size: number) {
  if (board.length !== size * size || new Set(board).size !== board.length || !board.every(n => integer(n, 0, board.length - 1))) return false;
  let inversions = 0; for (let i = 0; i < board.length; i++) for (let j = i + 1; j < board.length; j++) if (board[i] && board[j] && board[i] > board[j]) inversions++;
  return size % 2 === 1 ? inversions % 2 === 0 : (inversions + size - Math.floor(board.indexOf(0) / size)) % 2 === 1;
}
export function scramblePuzzle(size: PuzzleSize, seed: number, level: number, used: string[] = []): number[] {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const board = solvedBoard(size), random = seeded(stageSeed(seed, level + attempt * PUZZLE_ROUNDS));
    let blank = board.length - 1, previous = -1;
    for (let i = 0; i < 40 + level * 3 + (size - 3) * 30; i++) {
      const options = neighbours(size, blank).filter(i => i !== previous), tile = options[Math.floor(random() * options.length)];
      [board[blank], board[tile]] = [board[tile], board[blank]]; previous = blank; blank = tile;
    }
    if (!puzzleSolved(board) && !used.includes(board.join(','))) return board;
  }
  throw new Error('Impossibile preparare il puzzle');
}
export function newSliding(size: PuzzleSize = 3, seed = randomSeed()): SlidingState {
  const board = scramblePuzzle(size, seed, 0);
  return { v: 1, seed, size, level: 0, board, initial: board, seen: [board.join(',')], history: [], moves: 0, totalMoves: 0, completed: 0 };
}
export function slideTile(s: SlidingState, index: number): SlidingState {
  const blank = s.board.indexOf(0);
  if (puzzleSolved(s.board) || !neighbours(s.size, blank).includes(index)) return s;
  const board = [...s.board]; [board[blank], board[index]] = [board[index], board[blank]];
  return { ...s, board, history: [...s.history, s.board].slice(-40), moves: s.moves + 1, totalMoves: s.totalMoves + 1, completed: s.completed + (puzzleSolved(board) ? 1 : 0) };
}
export function undoSlide(s: SlidingState): SlidingState {
  return !s.history.length || puzzleSolved(s.board) ? s : { ...s, board: s.history[s.history.length - 1], history: s.history.slice(0, -1), moves: s.moves + 1, totalMoves: s.totalMoves + 1 };
}
export function resetSliding(s: SlidingState): SlidingState { return puzzleSolved(s.board) ? s : { ...s, board: [...s.initial], history: [], moves: 0 }; }
export function nextSliding(s: SlidingState): SlidingState {
  if (!puzzleSolved(s.board) || s.level === PUZZLE_ROUNDS - 1) return s;
  const board = scramblePuzzle(s.size, s.seed, s.level + 1, s.seen);
  return { ...s, level: s.level + 1, board, initial: board, seen: [...s.seen, board.join(',')], history: [], moves: 0 };
}
export function validSliding(value: unknown): value is SlidingState {
  const s = value as SlidingState;
  if (!s || s.v !== 1 || ![3, 4, 5].includes(s.size) || !integer(s.seed, 0, 0xffffffff) || !integer(s.level, 0, PUZZLE_ROUNDS - 1) || !Array.isArray(s.board) || !Array.isArray(s.initial) || !puzzleSolvable(s.board, s.size) || !puzzleSolvable(s.initial, s.size) || puzzleSolved(s.initial)) return false;
  return integer(s.moves, 0) && integer(s.totalMoves, s.moves) && s.completed === s.level + (puzzleSolved(s.board) ? 1 : 0)
    && Array.isArray(s.seen) && s.seen.length === s.level + 1 && new Set(s.seen).size === s.seen.length && s.seen[s.level] === s.initial.join(',') && s.seen.every(key => typeof key === 'string' && key.length <= 80 && puzzleSolvable(key.split(',').map(Number), s.size))
    && Array.isArray(s.history) && s.history.length <= 40 && s.history.every(board => Array.isArray(board) && puzzleSolvable(board, s.size));
}
