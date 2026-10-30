import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { FeatureFrame } from '../FeatureFrame';
import { Button, Card, T } from '../../ui/primitives';
import { useTheme } from '../../theme/ThemeProvider';
import { useScreenActive } from '../../hooks/useActivity';
import { useLocalGame, useSoloRecord } from './localState';
import { advanceSequence, newSequence, sequenceFlashMs, sequenceInput, sequencePattern, SEQUENCE_ROUNDS, validSequence } from './sequence';
import { NewSoloGame, SoloDifficultyPicker, SoloSaveNote } from './SoloChrome';

export function SequenceScreen() {
  const local = useLocalGame('sequence:v1', newSequence, validSequence);
  const { state: s, setState } = local;
  const { c } = useTheme(); const active = useScreenActive();
  const record = useSoloRecord('sequence:score'); const saveRecord = record.record;
  const [playback, setPlayback] = useState<{ level: number; tick: number } | null>(null);
  const pattern = sequencePattern(s);
  const watching = active && playback !== null && playback.level === s.level;
  const lit = watching && playback.tick % 2 === 0 ? pattern[Math.floor(playback.tick / 2)] : null;
  useEffect(() => {
    if (!active) return;
    saveRecord(s.score);
  }, [s.score, active, saveRecord]);
  useEffect(() => {
    if (!playback) return;
    if (!active) { const timer = setTimeout(() => { setPlayback(null); setState(old => old.phase === 'input' ? { ...old, phase: 'ready', input: 0 } : old); }, 0); return () => clearTimeout(timer); }
    const timer = setTimeout(() => {
      if (playback.tick + 1 >= pattern.length * 2) {
        setPlayback(null); setState(old => old.level === playback.level && ['ready', 'input'].includes(old.phase) ? { ...old, phase: 'input', input: 0 } : old);
      } else setPlayback({ ...playback, tick: playback.tick + 1 });
    }, playback.tick % 2 === 0 ? sequenceFlashMs(s) : 240);
    return () => clearTimeout(timer);
  }, [active, playback, pattern.length, s, setState]);
  const symbols = ['☀', '☾', '★', '♡']; const colours = ['#B86C83', '#7169B8', '#B18A38', '#3F8C89'];
  const available = active && !watching && playback === null && s.phase === 'input';
  return <FeatureFrame title="Sequenza luminosa">
    <T>Osserva le quattro luci e ripeti la sequenza. Ti aspettano {SEQUENCE_ROUNDS} livelli: le sequenze si allungano, fino a 24 passi. Hai cinque vite e ne recuperi una ogni dieci livelli.</T>
    <SoloDifficultyPicker value={s.difficulty} onChange={difficulty => { setPlayback(null); setState(newSequence(difficulty)); }} />
    <Card accent><T v="title">Livello {s.level + 1}/{SEQUENCE_ROUNDS}</T><T>Vite: {s.lives} · Punti: {s.score} · Record: {record.best ?? 0}</T>
      <T accessibilityLiveRegion="polite">{!active ? 'Partita in pausa' : watching ? `Osserva: passo ${Math.floor(playback.tick / 2) + 1} di ${pattern.length}` : s.phase === 'input' ? `Tocca le luci: ${s.input}/${pattern.length}` : s.phase === 'won' ? 'Hai illuminato tutti i 120 livelli!' : s.phase === 'lost' ? 'Le vite sono finite. Proviamo un nuovo cielo?' : s.phase === 'roundWon' ? 'Sequenza completata!' : 'Guarda la sequenza quando sei pronto.'}</T>
    </Card>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{symbols.map((symbol, i) => <TouchableOpacity key={symbol} accessibilityRole="button" accessibilityLabel={`Luce ${i + 1}, ${symbol}${lit === i ? ', accesa' : ''}`} accessibilityState={{ disabled: !available, selected: lit === i }} disabled={!available} onPress={() => setState(old => sequenceInput(old, i))} style={{ width: '46%', flexGrow: 1, height: 112, borderRadius: 22, backgroundColor: lit === i ? colours[i] : c.surfaceAlt, borderWidth: lit === i ? 4 : 1, borderColor: lit === i ? c.text : c.border, alignItems: 'center', justifyContent: 'center' }}><T style={{ fontSize: 38, color: '#FFFFFF' }}>{symbol}</T><T>{i + 1}</T></TouchableOpacity>)}</View>
    {s.phase === 'ready' || s.phase === 'input' ? <Button label={watching ? 'Sequenza in corso…' : s.phase === 'input' ? 'Riguarda la sequenza' : 'Mostra la sequenza'} disabled={!active || watching} onPress={() => { setState(old => ({ ...old, phase: 'ready', input: 0 })); setPlayback({ level: s.level, tick: 0 }); }} /> : null}
    {s.phase === 'roundWon' && <Button label="Prossimo livello" onPress={() => setState(advanceSequence)} />}
    <NewSoloGame onNew={() => { setPlayback(null); setState(newSequence(s.difficulty)); }} />
    <SoloSaveNote error={local.storageError || record.storageError} />
  </FeatureFrame>;
}
