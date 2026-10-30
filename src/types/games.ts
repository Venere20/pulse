export type PlayKey = 'daily' | 'tris' | 'wyr' | 'deeptalk' | 'connect4' | 'battleship' | 'drawguess' | 'hearts' | 'stars' | 'memory' | 'sequence' | 'secretword' | 'wordsearch' | 'clouds' | 'sliding';

export const PLAY_KEYS: PlayKey[] = ['daily', 'tris', 'wyr', 'deeptalk', 'connect4', 'battleship', 'drawguess', 'hearts', 'stars', 'memory', 'sequence', 'secretword', 'wordsearch', 'clouds', 'sliding'];

/** Una partita a Tris. `board` è una stringa di 9 caratteri: 'X', 'O' oppure '-' (casella vuota). */
export interface TrisMatch {
  id: string;
  game: string;
  player_x: string;
  player_o: string;
  board: string;
  turn: string;
  status: 'playing' | 'won' | 'draw' | 'cancelled';
  winner: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Risposta al «Preferisci…?» del giorno: choice 0 = prima opzione, 1 = seconda. */
export interface WyrAnswer {
  id?: string;
  day: string;
  question_id: number;
  user_id: string;
  choice: number;
  created_at?: string;
}
