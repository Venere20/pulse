import React, { useState } from 'react';
import { View } from 'react-native';
import type { Visit } from '../../types/travel';
import { BottomSheet } from '../../ui/layout';
import { Button, Chip, Input, T } from '../../ui/primitives';
import { DateField } from '../../ui/DateField';
import { isVisitConcluded } from '../../utils/visitLifecycle';
import { romeDay } from '../../utils/together';
import { confirmAction } from '../../utils/confirm';
import { useFeatureAction } from '../FeatureFrame';
import { featureRpc } from '../useFeatureRows';
import { visitActualTimes, visitTimeFields } from './actualTimes';

export function VisitActualTimesEditor({ visit, now, onChanged }: { visit: Visit; now: number; onChanged: () => Promise<unknown> }) {
  const today = romeDay(now);
  const [open, setOpen] = useState(false);
  const [startDay, setStartDay] = useState('');
  const [startHour, setStartHour] = useState('');
  const [endDay, setEndDay] = useState('');
  const [endHour, setEndHour] = useState('');
  const [hasEnd, setHasEnd] = useState(false);
  const { busy, run } = useFeatureAction();
  const concluded = isVisitConcluded(visit, today);
  const edit = () => {
    const currentDay = romeDay(Date.now());
    const start = visitTimeFields(visit.started_at, visit.start_date <= currentDay ? visit.start_date : currentDay);
    if (!visit.started_at) start.hour = visit.arrival_time || visitTimeFields(new Date(Date.now()).toISOString(), currentDay).hour;
    const end = visitTimeFields(visit.ended_at, visit.end_date <= currentDay ? visit.end_date : currentDay);
    setStartDay(start.day); setStartHour(start.hour);
    setEndDay(end.day); setEndHour(end.hour);
    setHasEnd(concluded); setOpen(true);
  };
  const save = () => run(async () => {
    const args = visitActualTimes(startDay, startHour.trim(), endDay, endHour.trim(), hasEnd, Date.now());
    // Close the editor before the shared confirmation: web Modal stacking must
    // not leave its footer above the confirmation buttons. Preserve the draft.
    setOpen(false);
    try {
      if (!await confirmAction('Salva gli orari effettivi', hasEnd
        ? 'L’incontro risulterà concluso e i desideri collegati saranno segnati come realizzati. Le date previste restano invariate.'
        : 'L’incontro risulterà iniziato e resterà aperto finché non lo concluderai. Le date previste restano invariate.', 'Salva orari')) { setOpen(true); return; }
      await featureRpc('update_visit_actual_times', { p_visit: visit.id, ...args });
    } catch (error) { setOpen(true); throw error; }
    await onChanged();
  });
  return <>
    <Button label="Modifica inizio e fine effettivi" icon="edit" variant="secondary" onPress={edit} />
    <BottomSheet visible={open} title="Inizio e fine effettivi" onClose={() => { if (!busy) setOpen(false); }}
      footer={<><Button label="Salva orari" loading={busy} onPress={save} /><Button label="Annulla" variant="ghost" disabled={busy} onPress={() => setOpen(false)} /></>}>
      <T tone="muted">Inserisci quando vi siete incontrati davvero. Gli orari sono riferiti all’Italia e le date previste restano invariate.</T>
      <DateField label="Giorno di inizio effettivo" value={startDay} onChange={setStartDay} maxDate={today} disabled={busy} />
      <Input label="Ora di inizio effettivo (HH:MM)" value={startHour} onChangeText={setStartHour} placeholder="18:30" maxLength={5} editable={!busy} />
      {!concluded && <Chip label="Imposta anche la fine dell’incontro" selected={hasEnd} onPress={busy ? undefined : () => setHasEnd(value => !value)} />}
      {hasEnd && <View style={{ gap: 12 }}>
        <DateField label="Giorno di fine effettiva" value={endDay} onChange={setEndDay} minDate={startDay} maxDate={today} disabled={busy} />
        <Input label="Ora di fine effettiva (HH:MM)" value={endHour} onChangeText={setEndHour} placeholder="23:00" maxLength={5} editable={!busy} />
      </View>}
      <T tone="muted">{hasEnd ? 'Salvando la fine confermi la conclusione dell’incontro.' : 'Senza una fine l’incontro resta in corso, con chiusura manuale.'}</T>
    </BottomSheet>
  </>;
}
