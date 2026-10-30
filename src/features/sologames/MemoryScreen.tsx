import { useScreenActive } from '../../hooks/useActivity';
import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { FeatureFrame } from '../FeatureFrame';
import { Button, Card, Chip, T } from '../../ui/primitives';
import { useTheme } from '../../theme/ThemeProvider';
import { flipMemory, MEMORY_SYMBOLS, newMemory, resolveMemory, validMemory } from './logic';
import { useLocalGame, useSoloRecord } from './localState';
import { countLabel } from '../../utils/italian';
function MemoryRound({ pairs }: { pairs: number }) {
  const { c } = useTheme(); const active = useScreenActive(); const local = useLocalGame('memory:' + pairs, () => newMemory(pairs), (v): v is ReturnType<typeof newMemory> => validMemory(v, pairs));
  const { state: s, setState } = local; const record = useSoloRecord('memory:' + pairs, true);
  const saveRecord = record.record;
  const won = s.matched.length === s.deck.length;
  useEffect(() => { if (!active || s.open.length !== 2) return; const timer = setTimeout(() => setState(resolveMemory), 700); return () => clearTimeout(timer); }, [s.open, setState, active]);
  useEffect(() => { if (won) saveRecord(s.moves); }, [won, s.moves, saveRecord]);
  return <>
    <Card accent><T bold accessibilityLiveRegion="polite">{won ? `Tutte le coppie trovate in ${countLabel(s.moves, 'mossa', 'mosse')}!` : `${s.matched.length / 2}/${pairs} coppie · ${countLabel(s.moves, 'mossa', 'mosse')}`}</T><T tone="muted">Record: {record.best == null ? '—' : countLabel(record.best, 'mossa', 'mosse')}</T></Card>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {s.deck.map((symbol, i) => {
        const face = s.open.includes(i) || s.matched.includes(i); const found = s.matched.includes(i);
        return <TouchableOpacity key={i} accessibilityRole="button" accessibilityLabel={`Carta ${i + 1}${face ? ': ' + MEMORY_SYMBOLS[symbol] : ': coperta'}`}
          accessibilityState={{ disabled: found || s.open.length === 2, selected: face }} disabled={found || s.open.length === 2}
          onPress={() => setState(current => flipMemory(current, i))}
          style={{ width: '22%', flexGrow: 1, aspectRatio: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: face ? c.primarySoft : c.surfaceAlt, borderRadius: 14, borderWidth: 1, borderColor: found ? c.success : c.border }}>
          <T style={{ fontSize: 28 }}>{face ? MEMORY_SYMBOLS[symbol] : '♡'}</T>
        </TouchableOpacity>;
      })}
    </View>
    <Button label={won ? 'Gioca ancora a Memory' : 'Ricomincia Memory'} variant="secondary" onPress={() => setState(newMemory(pairs))} />
    <T tone="muted">{local.storageError || record.storageError ? 'Salvataggio locale non disponibile: la partita resta aperta finché non esci.' : 'Partita e record salvati su questo dispositivo. Puoi uscire e riprendere.'}</T>
  </>;
}
export function MemoryScreen() {
  const [pairs, setPairs] = useState(8);
  return <FeatureFrame title="Memory dei ricordi"><T>Trova le coppie di simboli: cuori, stelle e piccoli gesti. Questo Memory non usa le vostre fotografie.</T>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[6, 8, 12].map(n => <Chip key={n} label={`${n} coppie`} selected={pairs === n} onPress={() => setPairs(n)} />)}</View>
    <MemoryRound key={pairs} pairs={pairs} />
  </FeatureFrame>;
}
