import type { TrisMatch, WyrAnswer } from '../types/games';
import type { DailyAnswer } from '../types/travel';

export function isChoiceRow(value: unknown, users: readonly string[]): value is WyrAnswer & DailyAnswer {
  const row = value as DailyAnswer | null;
  return !!row && users.includes(row.user_id) && typeof row.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.day.slice(0, 10)) &&
    Number.isInteger(row.choice) && row.choice >= 0 && Number.isInteger(row.question_id) && row.question_id >= 0;
}
export function mergeChoiceRows<T extends WyrAnswer>(rows: T[], next: T): T[] {
  return [...rows.filter(row => row.day.slice(0, 10) !== next.day.slice(0, 10) || row.user_id !== next.user_id), next];
}
export function mergeTrisRows(rows: TrisMatch[], value: unknown, users: readonly string[]): TrisMatch[] {
  const next = value as TrisMatch | null;
  if (!next || typeof next.id !== 'string' || next.game !== 'tris' || !users.includes(next.player_x) || !users.includes(next.player_o) ||
    next.player_x === next.player_o || typeof next.board !== 'string' || !/^[XO-]{9}$/.test(next.board) ||
    ![next.player_x, next.player_o].includes(next.turn) || !['playing', 'won', 'draw', 'cancelled'].includes(next.status) || !next.created_at) return rows;
  const current = rows.find(row => row.id === next.id);
  const moves = (board: string) => board.replaceAll('-', '').length;
  if (current && (moves(current.board) > moves(next.board) || current.status !== 'playing' && next.status === 'playing')) return rows;
  return [...rows.filter(row => row.id !== next.id), next]
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}
