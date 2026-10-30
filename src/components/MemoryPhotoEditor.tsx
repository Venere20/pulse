import React, { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { BottomSheet } from '../ui/layout';
import { Button, Chip, T } from '../ui/primitives';
import { useTheme } from '../theme/ThemeProvider';
import { cropForRatio, moveCrop, orientedRatio, photoLayout, PhotoLayout, rotatePhoto, visibleCrop, zoomCrop } from '../features/memories/photoLayout';
import { MemoryPhotoFrame } from './MemoryPhotoFrame';

export function MemoryPhotoEditor({ uri, initial, onClose, onConfirm, resolvedUri, onError, saveHint }: {
  uri: string; initial?: PhotoLayout; onClose: () => void; onConfirm: (layout: PhotoLayout) => void;
  resolvedUri?: string; onError?: React.ComponentProps<typeof MemoryPhotoFrame>['onError']; saveHint?: string;
}) {
  const { s, c, r } = useTheme();
  const [draft, setDraft] = useState(() => photoLayout(initial));
  const [ratio, setRatio] = useState(1), [loaded, setLoaded] = useState(false);
  const size = useRef({ width: 1, height: 1 });
  const drag = useRef<{ x: number; y: number; crop: PhotoLayout['crop']; width: number; height: number } | null>(null);
  const shift = (dx: number, dy: number) => setDraft(value => ({ ...value, crop: moveCrop(visibleCrop(ratio, value), dx, dy) }));
  return <BottomSheet visible title="Inquadra la foto" onClose={onClose}
    footer={<><Button label="Conferma foto" disabled={!loaded} onPress={() => onConfirm(draft)} /><Button label="Annulla modifiche foto" variant="ghost" onPress={onClose} /></>}>
    <T>Confronta i due riquadri prima di confermare. Il file originale viene conservato.</T>
    <View style={{ flexDirection: 'row', gap: s.sm }}>
      {(['fixed', 'adaptive'] as const).map(mode => <View key={mode} style={{ flex: 1, gap: s.sm, padding: s.sm, borderRadius: r.md, borderWidth: 2, borderColor: draft.mode === mode ? c.primary : c.border }}>
        <MemoryPhotoFrame uri={uri} resolvedUri={resolvedUri} onError={onError} layout={{ ...draft, mode }} style={{ width: '100%', borderRadius: r.sm }} />
        <Button small variant={draft.mode === mode ? 'primary' : 'secondary'} label={mode === 'fixed' ? 'Riquadro fisso' : 'Riquadro adattivo'} onPress={() => setDraft(value => ({ ...value, mode }))} />
      </View>)}
    </View>
    <T tone="muted">Fisso: riquadro 4:3 con ritaglio. Adattivo: segue le proporzioni della foto e del ritaglio scelto.</T>
    <T v="title">Sposta e ritaglia</T>
    <T tone="muted">Trascina la foto nell’anteprima oppure usa i comandi. Ingrandisci per scegliere un dettaglio.</T>
    <View accessibilityLabel="Anteprima modificabile della foto" style={{ width: '100%', maxWidth: 360, alignSelf: 'center', ...(Platform.OS === 'web' ? { touchAction: 'none' as const } : {}) }}
      onLayout={event => { const { width, height } = event.nativeEvent.layout; size.current = { width, height }; }}
      onStartShouldSetResponder={() => loaded} onMoveShouldSetResponder={() => loaded}
      onResponderTerminationRequest={() => false}
      onResponderGrant={event => { drag.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, crop: visibleCrop(ratio, draft), ...size.current }; }}
      onResponderMove={event => {
        const start = drag.current;
        if (!start || (event.nativeEvent.touches?.length ?? 1) > 1) return;
        const dx = -(event.nativeEvent.pageX - start.x) / start.width * start.crop.width;
        const dy = -(event.nativeEvent.pageY - start.y) / start.height * start.crop.height;
        setDraft(value => ({ ...value, crop: moveCrop(start.crop, dx, dy) }));
      }} onResponderRelease={() => { drag.current = null; }} onResponderTerminate={() => { drag.current = null; }}>
      <MemoryPhotoFrame uri={uri} resolvedUri={resolvedUri} onError={onError} layout={draft} style={{ width: '100%', borderRadius: r.md }} onSourceRatio={value => { setRatio(value); setLoaded(true); }} />
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
      <Button small variant="secondary" label="Ruota a sinistra" disabled={!loaded} onPress={() => setDraft(value => rotatePhoto(value, false))} />
      <Button small variant="secondary" label="Ruota a destra" disabled={!loaded} onPress={() => setDraft(value => rotatePhoto(value, true))} />
      <Button small variant="secondary" label="Ingrandisci" disabled={!loaded} onPress={() => setDraft(value => ({ ...value, crop: zoomCrop(visibleCrop(ratio, value), 1 / 1.2) }))} />
      <Button small variant="secondary" label="Riduci" disabled={!loaded} onPress={() => setDraft(value => ({ ...value, crop: zoomCrop(value.crop, 1.2) }))} />
      <Button small variant="ghost" label="Sposta a sinistra" disabled={!loaded} onPress={() => shift(-.05, 0)} />
      <Button small variant="ghost" label="Sposta a destra" disabled={!loaded} onPress={() => shift(.05, 0)} />
      <Button small variant="ghost" label="Sposta in alto" disabled={!loaded} onPress={() => shift(0, -.05)} />
      <Button small variant="ghost" label="Sposta in basso" disabled={!loaded} onPress={() => shift(0, .05)} />
    </View>
    <T tone="muted">Rotazione: {draft.rotation ?? 0}°</T>
    <T bold>Formato del ritaglio</T>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
      {[['Originale', undefined], ['Quadrato', 1], ['4:3', 4 / 3], ['16:9', 16 / 9]] .map(([label, target]) => <Chip key={String(label)} label={String(label)} onPress={() => { if (loaded) setDraft(value => ({ ...value, crop: cropForRatio(orientedRatio(ratio, value), target as number | undefined) })); }} />)}
    </View>
    <Button label="Ripristina foto intera" variant="ghost" onPress={() => setDraft(value => ({ mode: value.mode, crop: cropForRatio(ratio) }))} />
    <T tone="faint">{saveHint ?? '«Conferma foto» applica l’anteprima al ricordo in modifica. Premi poi «Salva ricordo» per condividerla anche con il partner.'}</T>
  </BottomSheet>;
}
