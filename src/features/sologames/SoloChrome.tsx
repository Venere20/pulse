import React from 'react';
import { View } from 'react-native';
import { Button, Chip, T } from '../../ui/primitives';
import { SOLO_DIFFICULTIES, SoloDifficulty } from './campaign';
import { confirmAction } from '../../utils/confirm';

export function SoloDifficultyPicker({ value, onChange }: { value: SoloDifficulty; onChange: (value: SoloDifficulty) => void }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{SOLO_DIFFICULTIES.map(item => <Chip key={item.key} label={item.label} selected={item.key === value} onPress={async () => {
    if (item.key !== value && await confirmAction('Cambia difficoltà', 'La partita attuale verrà sostituita con una nuova. Continuare?', 'Cambia')) onChange(item.key);
  }} />)}</View>;
}
export function SoloSaveNote({ error }: { error: boolean }) {
  return <T tone={error ? 'danger' : 'muted'}>{error ? 'Salvataggio locale non disponibile. I progressi potrebbero andare persi quando esci.' : 'Progressi salvati su questo dispositivo per il tuo profilo. Puoi uscire e riprendere.'}</T>;
}
export function NewSoloGame({ onNew }: { onNew: () => void }) {
  return <Button label="Nuova partita" variant="secondary" onPress={async () => {
    if (await confirmAction('Nuova partita', 'Vuoi ricominciare? I progressi della partita attuale verranno sostituiti.', 'Ricomincia')) onNew();
  }} />;
}
