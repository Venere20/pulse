import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDataFields } from '../../state/AppData';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { useToast } from '../../ui/Toast';
import type { Stroke } from '../canvas/protocol';
import { useScreenActive } from '../../hooks/useActivity';
import { gamePollDelay } from '../../utils/recovery';
import { isPartnerMatch, mergePartnerMatch } from './matchUpdates';
import { usePartnerGameRealtime } from './usePartnerGameRealtime';
import { recoverGameSecret } from './secretRecovery';

export type PartnerGameKey = 'connect4' | 'battleship' | 'drawguess';
export interface Shot { cell: number; hit: boolean; sunk: boolean }
export interface PartnerMatch {
  id: string; game: PartnerGameKey; player_a: string; player_b: string; turn: string;
  status: 'setup' | 'playing' | 'won' | 'draw' | 'cancelled'; winner: string | null; revision: number;
  created_at: string; updated_at: string;
  state: { board?: string; ready_a?: boolean; ready_b?: boolean; shots_a?: Shot[]; shots_b?: Shot[];
    drawer?: string; strokes?: Stroke[]; drawing_revision?: number; guesses?: string[]; letters?: number; answer?: string };
}
export function usePartnerGame(game: PartnerGameKey) {
  const d = useAppDataFields(['userId', 'partnerId']);
  const data = useFeatureRows<PartnerMatch>('partner_games', { column: 'game', value: game }, 'created_at', 20, false);
  const refresh = data.refresh;
  const readHealth = data.readHealth;
  const match = data.rows[0];
  const [secret, setSecret] = useState<{ matchId: string; owner: string; ships?: number[][]; word?: string } | null>(null);
  const [secretError, setSecretError] = useState<{ matchId: string; owner: string } | null>(null);
  const [secretRetry, setSecretRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const toast = useToast();
  const active = useScreenActive();
  const id = match?.id;
  const updateRows = data.updateRows;
  const receive = useCallback((row: unknown) => updateRows(rows => mergePartnerMatch(rows, row, game, d.userId)), [updateRows, game, d.userId]);
  usePartnerGameRealtime(game, d.userId, active, receive, refresh);
  const ownFleetReady = match?.player_a === d.userId ? match?.state.ready_a : match?.state.ready_b;
  const needsSecret = game === 'battleship' ? !!ownFleetReady : game === 'drawguess' && match?.state.drawer === d.userId;
  const scope = useRef(0);
  useEffect(() => { const currentScope = scope; currentScope.current++; return () => { currentScope.current++; }; }, [game, d.userId]);
  useEffect(() => {
    if (!id || !active || !needsSecret) return;
    return recoverGameSecret(signal => featureRpc<{ ships?: number[][]; word?: string }>('partner_game_secret', { p_id: id }, false, signal),
      value => { setSecret({ ...value, matchId: id, owner: d.userId }); setSecretError(null); },
      () => setSecretError({ matchId: id, owner: d.userId }));
  }, [id, needsSecret, active, d.userId, secretRetry]);
  // Reconnects and resume also refresh; polling covers missed realtime events.
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const current = readHealth();
      if (current.busy) { timer = setTimeout(() => { void poll(); }, gamePollDelay(current.failures)); return; }
      await refresh();
      if (disposed) return;
      const state = readHealth();
      // Permissions/schema failures need user action; don't repeat them forever.
      if (state.failures && !state.retryable) return;
      timer = setTimeout(() => { void poll(); }, gamePollDelay(state.failures));
    };
    timer = setTimeout(() => { void poll(); }, gamePollDelay(readHealth().failures));
    return () => { disposed = true; clearTimeout(timer); };
  }, [refresh, readHealth, active, id]);
  const run = async (action: () => Promise<PartnerMatch>) => {
    if (running.current) return false;
    running.current = true; setBusy(true); const ticket = scope.current;
    try { const row = await action(); if (ticket !== scope.current) return false; if (!isPartnerMatch(row, game, d.userId)) throw new Error('Stato della partita non disponibile: aggiorna e riprova'); receive(row); return true; }
    catch (e) { if (ticket !== scope.current) return false; toast.error(e instanceof Error ? e.message : 'Mossa non salvata'); await data.refresh(); return false; }
    finally { running.current = false; setBusy(false); }
  };
  const act = (action: string, payload: Record<string, unknown> = {}) => run(() => action === 'draw_patch'
    ? featureRpc<PartnerMatch>('patch_partner_drawing_state', { p_id: match?.id, p_drawing_revision: payload.drawing_revision, p_keep_count: payload.keep_count, p_strokes: payload.strokes })
    : featureRpc<PartnerMatch>('play_partner_game_state', { p_id: match?.id, p_action: action, p_data: payload, p_revision: match?.revision }));
  return { ...data, match, busy, act, d, secret: needsSecret && secret?.matchId === id && secret.owner === d.userId ? secret : null,
    secretError: needsSecret && secretError?.matchId === id && secretError.owner === d.userId,
    retrySecret: () => setSecretRetry(value => value + 1),
    start: () => run(() => featureRpc<PartnerMatch>('start_partner_game_state', { p_game: game })) };
}
