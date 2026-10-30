import { trackResult } from '../services/saveState';
import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { supabase } from '../config/supabase';
import { useAppDataFields } from '../state/AppData';
import { useGames } from '../state/Games';
import { EMPTY_BOARD, computeTrisStats, isFull, markOf, placeMark, winningLine } from '../utils/tris';
import { Screen, Header } from '../ui/layout';
import { Button, Card, T, Row } from '../ui/primitives';
import { useToast } from '../ui/Toast';
import { useTheme } from '../theme/ThemeProvider';

export const TrisScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {

  const { c, r, s } = useTheme();
  const toast = useToast();
  const d = useAppDataFields(['partnerId', 'userId']);
  const g = useGames();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const match = g.trisMatches[0] || null; // la più recente
  const active = match && match.status === 'playing' ? match : null;
  const myMark = match ? markOf(match, d.userId) : null;
  const myTurn = !!active && active.turn === d.userId;
  const line = match ? winningLine(match.board) : null;
  const stats = computeTrisStats(g.trisMatches, d.userId, d.partnerId);

  const statusText = () => {
    if (!match) return 'Nessuna partita in corso: sfida il partner!';
    if (match.status === 'cancelled') return 'Partita annullata. Nessun risultato conteggiato.';
    if (match.status === 'draw') return 'Pareggio! 🤝';
    if (match.status === 'won') return match.winner === d.userId ? 'Hai vinto! 🎉' : 'Ha vinto il partner 😅';
    return myTurn ? 'Tocca a te!' : 'Tocca al partner…';
  };

  const play = async (index: number) => {
    if (!active || busy || !myTurn || active.board[index] !== '-') return;
    const mark = markOf(active, d.userId);
    if (!mark) return;

    const board = placeMark(active.board, index, mark);
    const won = !!winningLine(board);
    const patch = {
      board,
      turn: d.partnerId,
      status: won ? ('won' as const) : isFull(board) ? ('draw' as const) : ('playing' as const),
      winner: won ? d.userId : null,
      updated_at: new Date().toISOString(),
    };

    setBusy(true);
    g.patchTris(active.id, patch); // la mossa compare subito
    // La condizione sulla board vecchia evita di sovrascrivere una mossa arrivata nel frattempo
    const { data, error } = await trackResult(() => supabase
      .from('game_matches')
      .update(patch)
      .eq('id', active.id)
      .eq('board', active.board)
      .eq('status', 'playing')
      .select('*'));
    setBusy(false);

    if (error || !data || data.length === 0) {
      toast.error(error ? 'Mossa non salvata: ' + error.message : 'La partita è cambiata: riprova.');
      void g.refresh(['game_matches']);
    } else {
      g.acceptTris(data[0]);
    }
  };

  const startMatch = async () => {
    if (busy) return;
    // Chi comincia si alterna a ogni partita
    const last = g.trisMatches[0];
    const starter = last ? (last.player_x === d.userId ? d.partnerId : d.userId) : d.userId;
    const other = starter === d.userId ? d.partnerId : d.userId;

    setBusy(true);
    const { data, error } = await trackResult(() => supabase.from('game_matches').insert([
      { game: 'tris', player_x: starter, player_o: other, turn: starter, board: EMPTY_BOARD, created_by: d.userId },
    ]).select('*'));
    setBusy(false);
    if (error) return toast.error('Partita non creata: ' + error.message);
    if (data?.[0]) g.acceptTris(data[0]);
    else void g.refresh(['game_matches']);
  };

  const cancelMatch = async () => {
    if (!active || busy) return;
    if (!confirmCancel) {
      setConfirmCancel(true);
      setTimeout(() => setConfirmCancel(false), 3000);
      return;
    }
    setConfirmCancel(false);
    setBusy(true);
    const { data, error } = await trackResult(() => supabase.from('game_matches')
      .update({ status: 'cancelled', winner: null, updated_at: new Date().toISOString() })
      .eq('id', active.id).eq('status', 'playing').eq('board', active.board).select('*'));
    setBusy(false);
    if (!error && data?.[0]) g.acceptTris(data[0]);
    else {
      toast.error(error ? 'Partita non annullata: ' + error.message : 'La partita è cambiata: riprova.');
      void g.refresh(['game_matches']);
    }
  };

  const markColor = (m: string) => (m === 'X' ? c.primary : c.warning);

  return (
    <Screen header={<Header title="Tris" subtitle="Una mossa alla volta, anche a distanza" onBack={onBack} />}>
      {!g.available && g.loaded ? (
        <Card>
          <T tone="muted">Il gioco non è disponibile al momento. Riprova più tardi.</T>
        </Card>
      ) : (
        <>
          <Card accent>
            <Row gap={s.lg} style={{ justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <T v="h1" tone="primary">{stats.myWins}</T>
                <T tone="muted">Tu</T>
              </View>
              <View style={{ alignItems: 'center' }}>
                <T v="h1">{stats.draws}</T>
                <T tone="muted">pareggi</T>
              </View>
              <View style={{ alignItems: 'center' }}>
                <T v="h1" tone="primary">{stats.partnerWins}</T>
                <T tone="muted">Partner</T>
              </View>
            </Row>
          </Card>

          <Card>
            <T v="title" style={{ textAlign: 'center' }}>{statusText()}</T>
            {myMark && match && (
              <T tone="muted" style={{ textAlign: 'center', marginTop: 2 }}>
                Tu sei {myMark}
                {match.status === 'playing' && match.turn !== d.userId ? ' · aspetta la mossa del partner' : ''}
              </T>
            )}

            {match && (
              <View style={{ width: '100%', maxWidth: 360, alignSelf: 'center', marginTop: s.lg, gap: s.sm }}>
                {[0, 1, 2].map((row) => (
                  <View key={row} style={{ flexDirection: 'row', gap: s.sm }}>
                    {[0, 1, 2].map((col) => {
                      const i = row * 3 + col;
                      const v = match.board[i];
                      const isWin = !!line && line.includes(i);
                      const canTap = !!active && myTurn && v === '-' && !busy;
                      return (
                        <TouchableOpacity
                          key={i}
                          accessibilityRole="button"
                          accessibilityLabel={`Casella ${i + 1}: ${v === '-' ? 'vuota' : v}`}
                          disabled={!canTap}
                          activeOpacity={0.8}
                          onPress={() => play(i)}
                          style={{
                            flex: 1,
                            aspectRatio: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: r.md,
                            borderWidth: 2,
                            borderColor: isWin ? c.success : canTap ? c.primary : c.border,
                            backgroundColor: isWin ? c.success + '22' : c.surfaceAlt,
                          }}
                        >
                          {v !== '-' && (
                            <T style={{ fontSize: 44, lineHeight: 52, fontWeight: '800', color: markColor(v) }}>{v}</T>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}

            <View style={{ marginTop: s.lg, gap: s.sm }}>
              {(!match || !active) && (
                <Button
                  label={match && match.status !== 'cancelled' ? 'Rivincita' : 'Nuova partita'}
                  icon="refresh"
                  onPress={startMatch}
                  loading={busy}
                />
              )}
              {active && (
                <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={cancelMatch} style={{ alignItems: 'center', padding: s.sm }}>
                  <T tone="muted">{confirmCancel ? 'Sicuro? Tocca di nuovo per annullare' : 'Annulla partita'}</T>
                </TouchableOpacity>
              )}
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
};
