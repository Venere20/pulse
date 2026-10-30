import { useAppForeground } from '../hooks/useActivity';
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { RowChange, useRealtimeRows } from '../hooks/useRealtimeRows';
import { useFeatureRows } from '../features/useFeatureRows';
import { TrisMatch, WyrAnswer } from '../types/games';
import { useAppDataFields } from './AppData';
import { isChoiceRow, mergeChoiceRows, mergeTrisRows } from './gameRows';

type GameTable = 'game_matches' | 'wyr_answers';
interface GamesData {
  loaded: boolean;
  available: boolean;
  trisMatches: TrisMatch[];
  wyrAnswers: WyrAnswer[];
  trisMyTurn: boolean;
  wyrPending: boolean;
  refresh: (tables?: readonly GameTable[]) => Promise<void>;
  patchTris: (id: string, patch: Partial<TrisMatch>) => void;
  acceptTris: (row: TrisMatch) => void;
  acceptWyr: (row: WyrAnswer) => void;
  removeTris: (id: string) => void;
}
const Ctx = createContext<GamesData | null>(null);
export const useGames = () => { const value = useContext(Ctx); if (!value) throw new Error('useGames fuori da GamesProvider'); return value; };

export const GamesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userId, partnerId, today } = useAppDataFields(['userId', 'partnerId', 'today']);
  const foreground = useAppForeground();
  const tris = useFeatureRows<TrisMatch>('game_matches', undefined, 'created_at', Infinity, false);
  const wyr = useFeatureRows<WyrAnswer>('wyr_answers', undefined, 'day', Infinity, false);
  const { refresh: readTris, updateRows: updateTris } = tris;
  const { refresh: readWyr, updateRows: updateWyr } = wyr;
  const loaded = !tris.loading && !wyr.loading;
  const missing = [tris.errorCode, wyr.errorCode].some(code => code === '42P01' || code === 'PGRST205');
  const available = tris.hasSnapshot && wyr.hasSnapshot && !missing;
  const refresh = useCallback(async (tables?: readonly GameTable[]) => {
    const selected = Array.isArray(tables) ? tables : ['game_matches', 'wyr_answers'];
    await Promise.all([selected.includes('game_matches') ? readTris() : undefined, selected.includes('wyr_answers') ? readWyr() : undefined]);
  }, [readTris, readWyr]);
  const acceptTris = useCallback((row: TrisMatch) => updateTris(rows => mergeTrisRows(rows, row, [userId, partnerId])), [updateTris, userId, partnerId]);
  const acceptWyr = useCallback((row: WyrAnswer) => {
    if (isChoiceRow(row, [userId, partnerId]) && row.choice <= 1) updateWyr(rows => mergeChoiceRows(rows, row));
  }, [updateWyr, userId, partnerId]);
  const patchTris = useCallback((id: string, patch: Partial<TrisMatch>) => updateTris(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row)), [updateTris]);
  const removeTris = useCallback((id: string) => updateTris(rows => rows.filter(row => row.id !== id)), [updateTris]);
  const onRow = useCallback((event: RowChange) => {
    if (event.eventType === 'DELETE') { void refresh([event.table as GameTable]); return; }
    if (event.table === 'game_matches') acceptTris(event.new as unknown as TrisMatch);
    else if (event.table === 'wyr_answers') acceptWyr(event.new as unknown as WyrAnswer);
  }, [acceptTris, acceptWyr, refresh]);
  const onReconnect = useCallback(() => { void refresh(); }, [refresh]);
  useRealtimeRows(['game_matches', 'wyr_answers'], userId, foreground, onRow, onReconnect);
  const trisMyTurn = tris.rows[0]?.status === 'playing' && tris.rows[0]?.turn === userId;
  const wyrPending = available && !wyr.rows.some(row => row.day.slice(0, 10) === today && row.user_id === userId);
  const value = useMemo<GamesData>(() => ({ loaded, available, trisMatches: tris.rows, wyrAnswers: wyr.rows, trisMyTurn, wyrPending,
    refresh, patchTris, acceptTris, acceptWyr, removeTris }), [loaded, available, tris.rows, wyr.rows, trisMyTurn, wyrPending, refresh, patchTris, acceptTris, acceptWyr, removeTris]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
