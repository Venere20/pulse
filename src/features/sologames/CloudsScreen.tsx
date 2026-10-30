import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Platform, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { FeatureFrame } from '../FeatureFrame';
import { Button, Card, T } from '../../ui/primitives';
import { useTheme } from '../../theme/ThemeProvider';
import { useScreenActive } from '../../hooks/useActivity';
import { useUpdateProtection } from '../updates/useUpdateProtection';
import { useLocalGame, useSoloRecord } from './localState';
import { CloudItem, cloudLane, CloudsState, cloudsStep, cloudWave, CLOUD_WAVES, newClouds, validClouds } from './clouds';
import { SoloDifficulty } from './campaign';
import { NewSoloGame, SoloDifficultyPicker, SoloSaveNote } from './SoloChrome';

const CloudSprite = React.memo(function CloudSprite({ item, running, height, getElapsed }: { item: CloudItem; running: boolean; height: number; getElapsed: () => number }) {
  const [position] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const progress = Math.min(1, Math.max(0, (getElapsed() - item.born) / item.duration));
    position.setValue(progress);
    if (!running) return;
    const animation = Animated.timing(position, { toValue: 1, duration: Math.max(1, (1 - progress) * item.duration), easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' });
    animation.start(); return () => animation.stop();
  }, [item.born, item.duration, position, running, getElapsed]);
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', left: `${(item.lane + 0.5) / 3 * 100}%`, top: -24, marginLeft: -24, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', transform: [{ translateY: position.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) }] }}><T style={{ fontSize: item.kind === 'cloud' ? 43 : 32, color: '#E5EDF5' }}>{item.kind === 'cloud' ? '☁' : item.kind === 'star' ? '🌟' : '💗'}</T></Animated.View>;
});

export function CloudsScreen() {
  const local = useLocalGame('clouds:v1', newClouds, validClouds); const checkpoint = local.checkpoint;
  const [scene, setScene] = useState<CloudsState>(() => local.state.phase === 'running' ? { ...local.state, phase: 'paused' } : local.state);
  const engine = useRef(scene), lastCheckpoint = useRef(scene.elapsed);
  const active = useScreenActive(); const { c } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const height = Math.min(400, Math.max(200, windowHeight - 390));
  const record = useSoloRecord('clouds:score'); const saveRecord = record.record;
  useUpdateProtection(scene.phase === 'running');
  const getElapsed = useCallback(() => engine.current.elapsed, []);
  const pause = useCallback(() => {
    if (engine.current.phase !== 'running') return;
    const next: CloudsState = { ...engine.current, phase: 'paused' };
    engine.current = next; checkpoint(next); saveRecord(next.score); setScene(next);
  }, [checkpoint, saveRecord]);
  useEffect(() => {
    if (active) return;
    const timer = setTimeout(pause, 0); return () => clearTimeout(timer);
  }, [active, pause]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') pause(); });
    const visibility = () => { if (document.hidden) pause(); };
    if (Platform.OS === 'web') { document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', pause); }
    return () => { listener.remove(); if (Platform.OS === 'web') { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pause); } pause(); };
  }, [pause]);
  useEffect(() => {
    if (!active || scene.phase !== 'running') return;
    let previous = Date.now();
    const timer = setInterval(() => {
      const now = Date.now(), delta = now - previous; previous = now;
      // A stalled JS thread pauses instead of letting native animation outrun collisions.
      if (delta > 250) { pause(); return; }
      const next = cloudsStep(engine.current, delta); engine.current = next; setScene(next);
      if (next.phase !== 'running') { checkpoint(next); saveRecord(next.score); }
      else if (next.elapsed - lastCheckpoint.current >= 5000) { checkpoint({ ...next, phase: 'paused' }); lastCheckpoint.current = next.elapsed; saveRecord(next.score); }
    }, 80);
    return () => clearInterval(timer);
  }, [active, scene.phase, checkpoint, saveRecord, pause]);
  const move = useCallback((lane: number) => { const next = cloudLane(engine.current, lane); engine.current = next; setScene(next); }, []);
  useEffect(() => {
    if (Platform.OS !== 'web' || !active) return;
    const key = (event: KeyboardEvent) => {
      if (engine.current.phase !== 'running' || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { event.preventDefault(); move(Math.max(0, engine.current.lane - 1)); }
      else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { event.preventDefault(); move(Math.min(2, engine.current.lane + 1)); }
      else if (event.code === 'Space') { event.preventDefault(); pause(); }
    };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  }, [active, move, pause]);
  const reset = (difficulty: SoloDifficulty) => { const next = newClouds(difficulty); engine.current = next; lastCheckpoint.current = 0; checkpoint(next); setScene(next); };
  const running = active && scene.phase === 'running';
  const seconds = Math.floor(scene.elapsed / 1000), time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return <FeatureFrame title="Schiva le nuvole">
    {!running && <T>Guida la stellina tra tre corsie: evita le nuvole, raccogli stelle (+25 punti) e cuori. Tocca una corsia o usa i pulsanti; su PC puoi usare le frecce. Ogni cinque ondate recuperi una vita. L’obiettivo completo dura 100 ondate da 30 secondi: puoi fare pausa e riprendere.</T>}
    {!running && <SoloDifficultyPicker value={scene.difficulty} onChange={reset} />}
    <Card accent><T v="title">Ondata {cloudWave(scene)}/{CLOUD_WAVES} · {time}</T><T>Vite: {scene.lives}/5 · Punti: {scene.score} · Record: {record.best ?? 0}</T><T>Stelle: {scene.stars} · Nuvole evitate: {scene.dodged}</T><T accessibilityLiveRegion="polite">{scene.phase === 'over' ? 'Le vite sono finite.' : scene.phase === 'won' ? 'Hai attraversato tutte le 100 ondate!' : !running ? 'In pausa: riprendi quando vuoi.' : scene.shieldUntil > scene.elapsed ? 'Protezione temporanea dopo l’urto' : 'Evita le nuvole!'}</T></Card>
    {running && <View style={{ flexDirection: 'row', gap: 8 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Spostati a sinistra" disabled={scene.lane === 0} onPress={() => move(Math.max(0, scene.lane - 1))} style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.surfaceAlt, opacity: scene.lane === 0 ? 0.45 : 1 }}><T bold>←</T></TouchableOpacity>
      <View style={{ flex: 2 }}><Button label="Pausa" onPress={pause} /></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Spostati a destra" disabled={scene.lane === 2} onPress={() => move(Math.min(2, scene.lane + 1))} style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.surfaceAlt, opacity: scene.lane === 2 ? 0.45 : 1 }}><T bold>→</T></TouchableOpacity>
    </View>}
    <View style={{ height, width: '100%', backgroundColor: '#17131F', borderRadius: 20, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', inset: 0, flexDirection: 'row' }}>{[0, 1, 2].map(lane => <TouchableOpacity key={lane} accessibilityRole="button" accessibilityLabel={`Spostati nella corsia ${lane + 1}`} accessibilityState={{ selected: scene.lane === lane, disabled: !running }} disabled={!running} onPress={() => move(lane)} style={{ flex: 1, borderRightWidth: lane < 2 ? 1 : 0, borderColor: '#FFFFFF18', backgroundColor: scene.lane === lane ? '#FFFFFF05' : 'transparent' }} />)}</View>
      {scene.items.map(item => <CloudSprite key={item.id} item={item} running={running} height={height} getElapsed={getElapsed} />)}
      <View pointerEvents="none" style={{ position: 'absolute', top: '86%', left: `${(scene.lane + 0.5) / 3 * 100}%`, marginLeft: -22, marginTop: -22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: scene.shieldUntil > scene.elapsed ? 2 : 0, borderColor: c.primary }}><T style={{ fontSize: 38, color: '#FFD76A' }}>★</T></View>
      {!running && <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, top: '40%', backgroundColor: '#17131FE8', padding: 20, borderRadius: 16 }}><T bold style={{ color: '#FFFFFF', textAlign: 'center' }}>{scene.phase === 'over' ? 'Fine partita' : scene.phase === 'won' ? 'Cielo conquistato!' : 'Pronto a volare?'}</T></View>}
    </View>
    {!running && <>{['ready', 'paused'].includes(scene.phase) && <Button label={scene.phase === 'ready' ? 'Inizia a volare' : 'Riprendi il volo'} disabled={!active} onPress={() => { const next: CloudsState = { ...engine.current, phase: 'running' }; engine.current = next; setScene(next); }} />}<NewSoloGame onNew={() => reset(scene.difficulty)} /><SoloSaveNote error={local.storageError || record.storageError} /></>}
  </FeatureFrame>;
}
