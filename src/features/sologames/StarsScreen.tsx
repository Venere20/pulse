import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Button, Card, T } from '../../ui/primitives';
import { useTheme } from '../../theme/ThemeProvider';
import { FeatureFrame } from '../FeatureFrame';
import { CONSTELLATIONS } from './logic';
import { useLocalGame } from './localState';
import { migrateSky, newSky, nextSky, retrySky, touchStar, validSky } from './stars';
import { confirmAction } from '../../utils/confirm';
export function StarsScreen() {
  const local = useLocalGame('stars', newSky, validSky, migrateSky);
  const { state: s, setState } = local; const { c } = useTheme();
  const sky = CONSTELLATIONS[s.order[s.index]]; const finished = s.next === sky.points.length;
  const allFinished = finished && s.index === s.order.length - 1;
  const coordinates = [...new Set(sky.points.map(p => p.join(',')))];
  return <FeatureFrame title="Unisci le stelle"><T>Segui i numeri e illumina una costellazione. Senza fretta e senza perdere punti: una piccola pausa per te.</T>
    <Card accent><T tone="muted">Disegno {s.index + 1} di {s.order.length} · Nessuna ripetizione nella partita</T><T v="title">{sky.name}</T><T accessibilityLiveRegion="polite">{allFinished ? 'Hai completato tutto il cielo! ✨' : finished ? 'Costellazione completata ✨' : `Tocca la stella ${s.next + 1} di ${sky.points.length}`}</T><T tone="muted">Costellazioni completate in totale: {s.completed}</T></Card>
    <View style={{ width: '100%', aspectRatio: 1, borderRadius: 20, backgroundColor: '#17131F', overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}><Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Polyline points={sky.points.slice(0, s.next).map(p => p.join(',')).join(' ')} fill="none" stroke={c.primary} strokeWidth="0.8" strokeLinejoin="round" />
      </Svg></View>
      {coordinates.map(coord => {
        const indices = sky.points.map((p, i) => p.join(',') === coord ? i : -1).filter(i => i >= 0);
        const index = indices.find(i => i >= s.next) ?? indices[indices.length - 1];
        const [x, y] = sky.points[index]; const lit = indices.some(i => i < s.next); const current = index === s.next;
        return <TouchableOpacity key={coord} accessibilityRole="button" accessibilityLabel={`Stella ${index + 1}`}
          accessibilityState={{ disabled: finished || !current, selected: lit }} disabled={finished || !current}
          onPress={() => setState(old => touchStar(old, index))}
          style={{ position: 'absolute', zIndex: current ? 2 : 1, left: `${x}%`, top: `${y}%`, marginLeft: -22, marginTop: -22, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: current ? c.primarySoft : '#17131F', borderWidth: current ? 2 : 0, borderColor: c.primary }}>
          <T bold tone={current ? 'primary' : 'muted'} style={lit && !current ? { color: c.warning } : undefined}>{finished || index < s.next ? '★' : index + 1}</T>
        </TouchableOpacity>;
      })}
    </View>
    {allFinished ? <><T>Hai unito tutti i {s.order.length} disegni. Una nuova partita avrà un nuovo ordine casuale.</T><Button label="Inizia una nuova partita" onPress={async () => { if (await confirmAction('Nuova partita', 'Hai completato tutti i disegni. Vuoi iniziare un nuovo cielo?', 'Inizia')) setState(old => newSky(old.completed)); }} /></>
      : finished ? <Button label="Prossima costellazione" onPress={() => setState(nextSky)} />
      : <Button label="Ricomincia questa costellazione" variant="secondary" onPress={() => setState(retrySky)} />}
    <T tone="muted">{local.storageError ? 'Progressi non salvati: lo spazio di archiviazione non è disponibile.' : 'Il tuo cielo resta salvato su questo dispositivo.'}</T>
  </FeatureFrame>;
}
