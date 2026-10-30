import { TrisMatch } from '../types/games';

export type Mark = 'X' | 'O';

export const EMPTY_BOARD = '---------';

const LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** Le tre caselle in fila della combinazione vincente, oppure null. */
export const winningLine = (board: string): number[] | null => {
  for (const [a, b, c] of LINES) {
    const m = board[a];
    if (m && m !== '-' && m === board[b] && m === board[c]) return [a, b, c];
  }
  return null;
};

export const isFull = (board: string): boolean => !board.includes('-');

export const placeMark = (board: string, index: number, mark: Mark): string =>
  board.slice(0, index) + mark + board.slice(index + 1);

/** Che simbolo usa questo utente nella partita (null se non partecipa). */
export const markOf = (match: Pick<TrisMatch, 'player_x' | 'player_o'>, userId: string): Mark | null =>
  match.player_x === userId ? 'X' : match.player_o === userId ? 'O' : null;

export interface TrisStats {
  myWins: number;
  partnerWins: number;
  draws: number;
}

export const computeTrisStats = (matches: TrisMatch[], me: string, partner: string): TrisStats => {
  let myWins = 0;
  let partnerWins = 0;
  let draws = 0;
  for (const m of matches) {
    if (m.status === 'draw') draws++;
    else if (m.status === 'won') {
      if (m.winner === me) myWins++;
      else if (m.winner === partner) partnerWins++;
    }
  }
  return { myWins, partnerWins, draws };
};
