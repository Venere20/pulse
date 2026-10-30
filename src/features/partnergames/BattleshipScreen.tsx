import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { Button, Chip, T } from '../../ui/primitives';
import { useTheme } from '../../theme/ThemeProvider';
import { useToast } from '../../ui/Toast';
import { FeatureFrame } from '../FeatureFrame';
import { MatchStatus } from './MatchStatus';
import { Shot, usePartnerGame } from './usePartnerGame';
import { confirmAction } from '../../utils/confirm';

export function shipCells(start: number, length: number, vertical: boolean): number[] | null {
  const cells = Array.from({ length }, (_, i) => start + i * (vertical ? 6 : 1));
  return cells.every(cell => cell >= 0 && cell < 36 && (vertical || Math.floor(cell / 6) === Math.floor(start / 6))) ? cells : null;
}
function SeaGrid({ label, ships = [], shots, selected, onCell, disabled }: {
  label: string; ships?: number[][]; shots: Shot[]; selected?: number | null;
  onCell?: (cell: number) => void; disabled?: boolean;
}) {
  const { c } = useTheme();
  return <View style={{ gap: 8 }}><T v="title">{label}</T>
    <ScrollView horizontal contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ gap: 2 }}>
        {Array.from({ length: 6 }, (_, row) => <View key={row} style={{ flexDirection: 'row', gap: 2 }}>
          {Array.from({ length: 6 }, (_, col) => {
            const cell = row * 6 + col; const shot = shots.find(s => s.cell === cell); const ship = ships.some(s => s.includes(cell));
            const coord = String.fromCharCode(65 + row) + (col + 1);
            const text = shot ? shot.hit ? shot.sunk ? '✹' : '×' : '·' : ship ? '■' : coord;
            const description = `${label}, ${coord}: ${shot ? shot.hit ? shot.sunk ? 'colpita, nave affondata' : 'colpita' : 'acqua' : ship ? 'nave' : 'non colpita'}`;
            return <TouchableOpacity key={cell} accessibilityRole="button" accessibilityLabel={description}
              accessibilityState={{ selected: selected === cell, disabled: disabled || !onCell || !!shot }}
              disabled={disabled || !onCell || !!shot} onPress={() => onCell?.(cell)}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8,
                borderWidth: 2, borderColor: selected === cell ? c.primary : c.border,
                backgroundColor: shot?.hit ? c.dangerSoft : ship ? c.primarySoft : c.surfaceAlt }}>
              <T v="caption" bold tone={shot?.hit ? 'danger' : ship ? 'primary' : 'muted'}>{text}</T>
            </TouchableOpacity>;
          })}
        </View>)}
      </View>
    </ScrollView>
  </View>;
}
function NavalRound({ g }: { g: ReturnType<typeof usePartnerGame> }) {
  const m = g.match!; const [ships, setShips] = useState<number[][]>([]);
  const [vertical, setVertical] = useState(false); const [target, setTarget] = useState<number | null>(null);
  const toast = useToast(); const isA = m.player_a === g.d.userId;
  const ready = isA ? m.state.ready_a : m.state.ready_b;
  const myShots = (isA ? m.state.shots_a : m.state.shots_b) ?? [];
  const enemyShots = (isA ? m.state.shots_b : m.state.shots_a) ?? [];
  const addShip = (cell: number) => {
    if (ships.length >= 3) return;
    const next = shipCells(cell, ships.length === 0 ? 3 : 2, vertical);
    if (!next || next.some(p => ships.some(s => s.includes(p)))) { toast.error('La nave deve restare nella griglia, senza sovrapporsi.'); return; }
    setShips(value => [...value, next]);
  };
  return <>
    <MatchStatus match={m} userId={g.d.userId} />
    {m.status === 'setup' && !ready ? <>
      <T>Posiziona tre navi: 3, 2 e 2 caselle. Tocca la casella iniziale; le navi si estendono verso destra o in basso.</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label="Orizzontale" selected={!vertical} onPress={() => setVertical(false)} />
        <Chip label="Verticale" selected={vertical} onPress={() => setVertical(true)} />
      </View>
      <T tone="primary">{ships.length < 3 ? `Nave ${ships.length + 1}: ${ships.length === 0 ? 3 : 2} caselle` : 'Flotta pronta da confermare'}</T>
      <SeaGrid label="Posiziona la tua flotta" ships={ships} shots={[]} onCell={addShip} disabled={g.busy || ships.length === 3} />
      <Button label="Rimuovi ultima nave" variant="secondary" disabled={!ships.length || g.busy} onPress={() => setShips(value => value.slice(0, -1))} />
      <Button label="Conferma la mia flotta" disabled={ships.length !== 3} loading={g.busy} onPress={() => void g.act('fleet', { ships })} />
    </> : <>
      {m.status === 'setup' && <T tone="muted">La tua flotta è salvata e nascosta al partner. Aspettiamo la sua.</T>}
      <SeaGrid label="La tua flotta" ships={g.secret?.ships ?? []} shots={enemyShots} />
      <T tone="muted">■ nave · × colpita · ✹ affondata · · acqua</T>
      {m.status !== 'setup' && <>
        <SeaGrid label="Mare del partner" shots={myShots} selected={target} onCell={setTarget}
          disabled={g.busy || m.status !== 'playing' || m.turn !== g.d.userId} />
        {m.status === 'playing' && <Button label={target === null ? 'Scegli una casella da colpire' : `Colpisci ${String.fromCharCode(65 + Math.floor(target / 6))}${target % 6 + 1}`}
          loading={g.busy} disabled={target === null || m.turn !== g.d.userId || myShots.some(s => s.cell === target)}
          onPress={() => void (async () => { if (await g.act('shoot', { cell: target })) setTarget(null); })()} />}
        <T tone="primary">Hai colpito {myShots.filter(s => s.hit).length}/7 caselle della flotta avversaria.</T>
      </>}
    </>}
    {['setup', 'playing'].includes(m.status) ? <Button label="Annulla partita" variant="ghost" disabled={g.busy} onPress={() => void (async () => {
      if (await confirmAction('Annulla partita', 'La partita finirà per entrambi.', 'Annulla partita')) await g.act('cancel');
    })()} /> : <Button label="Rivincita a Battaglia navale" loading={g.busy} onPress={() => void g.start()} />}
  </>;
}
export function BattleshipScreen() {
  const g = usePartnerGame('battleship');
  return <FeatureFrame title="Battaglia navale" error={g.error} loading={g.loading} onRefresh={g.refresh}>
    <T>Affonda le tre navi del partner. Una mossa a testa, anche quando colpisci. Le posizioni restano segrete.</T>
    {g.secretError && <><T tone="danger">Non riesco a caricare la tua flotta. Controlla la connessione e riprova.</T><Button label="Riprova a caricare la flotta" variant="secondary" onPress={g.retrySecret} /></>}
    {g.match ? <NavalRound key={g.match.id} g={g} /> : <Button label="Invita il partner a Battaglia navale" loading={g.busy} onPress={() => void g.start()} />}
    <T tone="muted">Flotte confermate e mosse si salvano: potete riprendere la partita più tardi.</T>
  </FeatureFrame>;
}
