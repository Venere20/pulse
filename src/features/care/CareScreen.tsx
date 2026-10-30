import { countLabel } from '../../utils/italian';
import { useDraftField } from '../drafts/useDraftField';
import React from 'react';
import { View } from 'react-native';
import { useAppDataFields } from '../../state/AppData';
import { Button, Card, Chip, Input, T } from '../../ui/primitives';
import { FeatureFrame, useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { useMinuteClock } from '../shared/useMinuteClock';
export const NEEDS = [
  { id: 'talk', label: '💬 Vorrei parlare' }, { id: 'message', label: '💌 Un messaggio' },
  { id: 'distraction', label: '🎲 Distraiamoci' }, { id: 'space', label: '🌿 Un po’ di spazio' },
  { id: 'hug', label: '🫂 Ho bisogno di vicinanza' },
];
interface Care { id: string; need: string | null; note: string; expires_at: string }
export function CareScreen() {

  const d = useAppDataFields(['names', 'userId']); const data = useFeatureRows<Care>('care_requests');
  const { busy, run } = useFeatureAction(); const now = useMinuteClock();
  const [need, setNeed] = useDraftField("care", 'need', 'talk'); const [note, setNote] = useDraftField("care", 'note', ''); const [minutes, setMinutes] = useDraftField("care", 'minutes', 120);
  const active = data.rows.filter(r => r.need && Date.parse(r.expires_at) > now);
  const save = (value: string | null) => run(() => featureRpc('set_care_request', { p_need: value, p_note: value ? note : '', p_minutes: minutes }), data.refresh);
  return <FeatureFrame title="Come starmi vicino" error={data.error} loading={data.loading} onRefresh={data.refresh}>
    <Card><T v="title">Un piccolo gesto può bastare</T><T tone="muted">Condividi ciò di cui hai bisogno, così il partner non dovrà indovinarlo.</T></Card>
    {active.map(r => <Card key={r.id} accent={r.id !== d.userId}><T v="title">{r.id === d.userId ? 'Tu' : d.names[r.id]} · {NEEDS.find(n => n.id === r.need)?.label}</T>{!!r.note && <T>{r.note}</T>}<T tone="muted">Fino alle {new Date(r.expires_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</T>{r.id === d.userId && <Button label="Rimuovi la richiesta" variant="ghost" disabled={busy} onPress={() => save(null)} />}</Card>)}
    <Card><View style={{ gap: 12 }}><T v="title">Oggi mi farebbe bene…</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{NEEDS.map(n => <Chip key={n.id} label={n.label} selected={need === n.id} onPress={() => setNeed(n.id)} />)}</View>
      <Input label="Vuoi aggiungere qualcosa?" value={note} onChangeText={setNote} maxLength={140} multiline />
      <T tone="muted">Mantieni la richiesta per</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[30, 120, 480].map(m => <Chip key={m} label={m === 30 ? '30 minuti' : countLabel(m / 60, 'ora', 'ore')} selected={minutes === m} onPress={() => setMinutes(m)} />)}</View>
      <Button label="Condividi con il partner" loading={busy} onPress={() => save(need)} />
    </View></Card>
  </FeatureFrame>;
}
