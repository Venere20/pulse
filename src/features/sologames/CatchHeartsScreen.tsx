import { useScreenActive } from '../../hooks/useActivity';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, TouchableOpacity, View } from 'react-native';
import { FeatureFrame } from '../FeatureFrame';
import { Button, Card, T } from '../../ui/primitives';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../theme/ThemeProvider';
import { HEART_DIFFICULTIES, HeartDifficulty, HeartTarget, heartEffect, heartWave, waveLifetime } from './hearts';
import { useSoloRecord } from './localState';
import { useUpdateProtection } from '../updates/useUpdateProtection';
type Phase = 'ready' | 'playing' | 'paused' | 'done';
function HeartsRound({ difficulty, onActive }: { difficulty: HeartDifficulty; onActive: (value: boolean) => void }) {
  const config = HEART_DIFFICULTIES[difficulty]; const { c } = useTheme(); const active = useScreenActive();
  const record = useSoloRecord('hearts:v2:' + difficulty); const saveRecord = record.record;
  const [phase, setPhase] = useState<Phase>('ready'); const mode = useRef<Phase>('ready');
  const [seconds, setSeconds] = useState<number>(config.seconds); const [score, setScore] = useState(0);
  const [targets, setTargets] = useState<HeartTarget[]>([]); const current = useRef<HeartTarget[]>([]);
  const [feedback, setFeedback] = useState('');
  const deadline = useRef(0); const remaining = useRef<number>(config.seconds * 1000); const spawnAt = useRef(0);
  const hits = useRef(0); const points = useRef(0); const sequence = useRef(0);
  const startedAt = useRef(0); const pausedAt = useRef(0);
  useEffect(() => () => onActive(false), [onActive]);
  const spawn = useCallback(() => {
    const next = heartWave(difficulty, sequence.current); sequence.current += next.length;
    current.current = next; setTargets(next); spawnAt.current = Date.now() + waveLifetime(difficulty, hits.current);
  }, [difficulty]);
  const finish = useCallback(() => {
    if (!['playing', 'paused'].includes(mode.current)) return;
    mode.current = 'done'; current.current = []; setTargets([]); setPhase('done'); onActive(false); saveRecord(points.current);
  }, [saveRecord, onActive]);
  const pause = useCallback(() => {
    if (mode.current !== 'playing') return;
    remaining.current = Math.max(0, deadline.current - Date.now()); pausedAt.current = Date.now();
    mode.current = 'paused'; setPhase('paused');
  }, []);
  useEffect(() => { if (active) return; const timer = setTimeout(pause, 0); return () => clearTimeout(timer); }, [active, pause]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', value => { if (value !== 'active') pause(); });
    if (Platform.OS === 'web') {
      const visibility = () => { if (document.hidden) pause(); }; document.addEventListener('visibilitychange', visibility);
      return () => { listener.remove(); document.removeEventListener('visibilitychange', visibility); };
    }
    return () => listener.remove();
  }, [pause]);
  useEffect(() => {
    if (phase !== 'playing' || !active) return;
    const timer = setInterval(() => {
      if (mode.current !== 'playing') return;
      const left = Math.max(0, deadline.current - Date.now()); setSeconds(Math.ceil(left / 1000));
      if (left === 0) finish(); else if (Date.now() >= spawnAt.current) spawn();
    }, 100);
    return () => clearInterval(timer);
  }, [phase, active, finish, spawn]);
  const start = () => {
    points.current = 0; hits.current = 0; setScore(0); setSeconds(config.seconds); setFeedback('');
    startedAt.current = Date.now(); deadline.current = Date.now() + config.seconds * 1000;
    remaining.current = config.seconds * 1000; mode.current = 'playing'; setPhase('playing'); onActive(true); spawn();
  };
  const catchHeart = useCallback((id: number) => {
    const now = Date.now();
    const target = current.current.find(t => t.id === id);
    if (!target || mode.current !== 'playing') return;
    if (now >= deadline.current) { setSeconds(0); finish(); return; }
    // A displayed target stays tappable until the timer actually replaces it.
    // Discarding it on the scheduled wave deadline can swallow a lethal bomb.
    current.current = current.current.filter(t => t.id !== id); setTargets(current.current);
    const effect = heartEffect(target.kind, difficulty, deadline.current - now, now - startedAt.current);
    points.current += effect.points; hits.current++; setScore(points.current);
    deadline.current = now + effect.time; setSeconds(Math.ceil(effect.time / 1000));
    setFeedback(target.kind === 'bomb' ? `Cuore bomba: −${config.penalty}s` : target.kind === 'gold' ? `Cuore dorato: +${Math.round(effect.change / 1000)}s · +3 punti` : '+1 punto');
    if (effect.time === 0) finish(); else if (!current.current.length) spawn();
  }, [difficulty, config.penalty, finish, spawn]);
  return <>
    <T>Tocca i cuori rosa e dorati, evita quelli bomba. I dorati aggiungono tempo; le bombe lo tolgono.</T>
    <Card><T bold>{config.label}: {config.seconds}s iniziali · {config.targets} cuori alla volta</T>
      <T tone="muted">Bombe: {Math.round(config.bombChance * 100)}% · −{config.penalty}s. Dorati: {Math.round(config.goldChance * 100)}% · +{config.bonus}s e 3 punti.</T>
      <T tone="faint">Frequenze indicative. Con i bonus la partita dura al massimo {config.maxSeconds}s di gioco, pause escluse.</T></Card>
    <Card accent><T v="h2" accessibilityLiveRegion="polite">{score} punti · {seconds}s</T>
      <T tone="muted">Record {config.label.toLowerCase()}: {record.best ?? 0} punti</T>
      {!!feedback && <T accessibilityLiveRegion="polite">{feedback}</T>}</Card>
    <View style={{ width: '100%', aspectRatio: 1, backgroundColor: c.surfaceAlt, borderRadius: 20, overflow: 'hidden' }}>
      {phase === 'playing' ? targets.map(target => <TouchableOpacity key={target.id} accessibilityRole="button"
        accessibilityLabel={target.kind === 'bomb' ? 'Cuore bomba' : target.kind === 'gold' ? 'Acchiappa il cuore dorato' : 'Acchiappa il cuore'} onPress={() => catchHeart(target.id)}
        style={{ position: 'absolute', left: `${target.cell % 4 * 25}%`, top: `${Math.floor(target.cell / 4) * 25}%`, width: '25%', height: '25%', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="heart" size={38} color={target.kind === 'gold' ? c.warning : target.kind === 'bomb' ? c.danger : c.primary} />
        {target.kind !== 'normal' && <T v="caption" bold style={{ color: target.kind === 'gold' ? c.warning : c.danger }}>{target.kind === 'bomb' ? `💣 −${config.penalty}s` : `★ +${config.bonus}s`}</T>}
      </TouchableOpacity>) : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <Icon name="heart" size={56} color={c.primary} /><T v="title" style={{ textAlign: 'center' }}>{phase === 'paused' ? 'Una pausa per te' : phase === 'done' ? `Partita finita! ${score} punti` : "Ti va di raccogliere un po’ di cuori?"}</T>
      </View>}
    </View>
    {phase === 'playing' ? <Button label="Pausa" variant="secondary" onPress={pause} /> : phase === 'paused' ? <>
      <Button label="Riprendi" onPress={() => { startedAt.current += Date.now() - pausedAt.current; deadline.current = Date.now() + remaining.current; mode.current = 'playing'; setPhase('playing'); spawn(); }} />
      <Button label="Termina partita" variant="ghost" onPress={finish} />
    </> : <Button label={phase === 'done' ? 'Riprova Acchiappa cuori' : 'Inizia Acchiappa cuori'} onPress={start} />}
    <T tone="muted">{record.storageError ? 'Record non salvato: archiviazione locale non disponibile.' : 'Record separati per difficoltà, salvati su questo dispositivo. Cambio scheda o app: pausa automatica.'}</T>
  </>;
}
export function CatchHeartsScreen() {
  const [difficulty, setDifficulty] = useState<HeartDifficulty>('normal');
  const [active, setActive] = useState(false);
  useUpdateProtection(active);
  return <FeatureFrame title="Acchiappa cuori">
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(Object.keys(HEART_DIFFICULTIES) as HeartDifficulty[]).map(key => <Button key={key} small variant={difficulty === key ? 'primary' : 'secondary'} label={HEART_DIFFICULTIES[key].label} disabled={active} onPress={() => setDifficulty(key)} />)}
    </View>
    <HeartsRound key={difficulty} difficulty={difficulty} onActive={setActive} />
  </FeatureFrame>;
}
