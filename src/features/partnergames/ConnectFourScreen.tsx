import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { FeatureFrame } from '../FeatureFrame';
import { Button, T } from '../../ui/primitives';
import { useTheme } from '../../theme/ThemeProvider';
import { usePartnerGame } from './usePartnerGame';
import { MatchStatus } from './MatchStatus';
import { confirmAction } from '../../utils/confirm';

export function ConnectFourScreen() {
  const g = usePartnerGame('connect4'); const { c } = useTheme(); const m = g.match;
  const playing = m?.status === 'playing'; const mine = m?.player_a === g.d.userId ? 'A' : 'B';
  return <FeatureFrame title="Forza 4" error={g.error} loading={g.loading} onRefresh={g.refresh}>
    <T>Allinea quattro gettoni in orizzontale, verticale o diagonale. Tocca una colonna per lasciar cadere il tuo gettone.</T>
    {!m && <Button label="Invita il partner a Forza 4" loading={g.busy} onPress={() => void g.start()} />}
    {m && <>
      <MatchStatus match={m} userId={g.d.userId} />
      <T tone="muted">Tu: {mine === 'A' ? 'rosa' : 'blu'} · Partner: {mine === 'A' ? 'blu' : 'rosa'}</T>
      <ScrollView horizontal style={{ marginHorizontal: -10 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: 16 }}>
          {Array.from({ length: 7 }, (_, col) => <TouchableOpacity key={col} accessibilityRole="button"
            accessibilityLabel={`Colonna ${col + 1}`} accessibilityState={{ disabled: !playing || m.turn !== g.d.userId || g.busy || m.state.board?.[col] !== '-' }}
            disabled={!playing || m.turn !== g.d.userId || g.busy || m.state.board?.[col] !== '-'}
            onPress={() => void g.act('drop', { column: col })} style={{ width: 44, paddingVertical: 8, alignItems: 'center', gap: 6 }}>
            <T tone="primary" bold>{col + 1}</T>
            {Array.from({ length: 6 }, (_, row) => {
              const value = m.state.board?.[row * 7 + col];
              return <View key={row} accessibilityLabel={`Riga ${row + 1}, colonna ${col + 1}: ${value === '-' ? 'vuota' : value === mine ? 'tu' : 'partner'}`}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: value === 'A' ? c.primary : value === 'B' ? c.info : c.bg }} />;
            })}
          </TouchableOpacity>)}
        </View>
      </ScrollView>
      {playing ? <Button label="Annulla partita" variant="ghost" disabled={g.busy} onPress={() => void (async () => {
        if (await confirmAction('Annulla partita', 'La partita finirà per entrambi.', 'Annulla partita')) await g.act('cancel');
      })()} /> : <Button label="Rivincita a Forza 4" loading={g.busy} onPress={() => void g.start()} />}
    </>}
    <T tone="muted">La partita si salva a ogni mossa. Puoi tornare più tardi.</T>
  </FeatureFrame>;
}
