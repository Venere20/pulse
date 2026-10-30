import React from 'react';
import { View } from 'react-native';
import type { Visit } from '../../types/travel';
import { Button, Card, Chip, T } from '../../ui/primitives';
import { confirmAction } from '../../utils/confirm';
import { isVisitConcluded } from '../../utils/visitLifecycle';
import { romeDay, togetherState } from '../../utils/together';
import { useFeatureAction } from '../FeatureFrame';
import { featureRpc } from '../useFeatureRows';

export function VisitLifecycleCard({ visit, today, now, onChanged }: { visit: Visit; today: string; now: number; onChanged: () => Promise<unknown> }) {
  const { busy, run } = useFeatureAction();
  const concluded = isVisitConcluded(visit, today);
  const started = !!togetherState([visit], null, now).visit;
  const manual = visit.timing_mode === 'manual';
  const act = (action: string) => run(async () => {
    if (action === 'finish' && !await confirmAction('Concludi incontro', 'L’incontro passerà nei ricordi per entrambi. Le date previste resteranno nel programma.', 'Concludi incontro')) return;
    await featureRpc('visit_lifecycle', { p_visit: visit.id, p_action: action });
  }, onChanged);
  const time = (value: string) => new Date(value).toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' });
  const currentDay = romeDay(now);
  if (!concluded && (currentDay < visit.start_date || currentDay > visit.end_date)) return null;
  return <Card><View style={{ gap: 12 }}>
    <T v="title">{concluded ? 'Incontro concluso' : started ? 'Il vostro incontro è iniziato' : 'Inizio e fine incontro'}</T>
    {!concluded && <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label="Con le date previste" selected={!manual} onPress={busy || visit.started_at ? undefined : () => act('scheduled')} />
        <Chip label="Manuale / arrivo" selected={manual} onPress={busy ? undefined : () => act('manual')} />
      </View>
      <T tone="muted">{manual ? 'Parte quando premi «Inizia incontro» o «Sono arrivato/a» e termina quando lo confermi. Nessun rilevamento della posizione.' : 'Inizia alla data e all’ora di arrivo previste e termina dopo l’ultimo giorno. Puoi passare alla gestione manuale.'}</T>
      {!visit.started_at && <>
        <Button label={started ? 'Conferma inizio manuale' : 'Inizia incontro'} disabled={busy} onPress={() => act('start')} />
        <Button label="Sono arrivato/a" variant="secondary" disabled={busy} onPress={() => act('start')} />
      </>}
      {started && <>
        <Button label="Concludi incontro" disabled={busy} onPress={() => act('finish')} />
        <Button label="Sono rientrato/a" variant="secondary" disabled={busy} onPress={() => act('finish')} />
      </>}
    </>}
    {!!visit.started_at && <T tone="muted">Inizio confermato: {time(visit.started_at)}</T>}
    {!!visit.ended_at && <T tone="muted">Fine confermata: {time(visit.ended_at)}</T>}
  </View></Card>;
}
