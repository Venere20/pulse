import { countLabel } from '../../utils/italian';
import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useAppDataFields } from '../../state/AppData';
import { Button, Card, Input, T } from '../../ui/primitives';
import { FeatureFrame, useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { monthlyRecap, shiftMonth } from './logic';
import { useDraftField } from '../drafts/useDraftField';
interface Reflection { id: string; author_id: string; month: string; body: string }
export function RecapScreen() {

  const d = useAppDataFields(['bucket', 'expenses', 'loadError', 'loaded', 'names', 'refresh', 'today', 'userId', 'visits', 'visitBucket']); const data = useFeatureRows<Reflection>('monthly_reflections'); const { busy, run } = useFeatureAction();
  const [month, setMonth] = useState(d.today.slice(0, 7)); const [draft, setDraft] = useDraftField<string | null>(`recap:${month}`, 'body', null);
  const recap = monthlyRecap(month, d.today, d.visits, d.expenses, d.bucket, d.visitBucket);
  const reflections = data.rows.filter(r => r.month === `${month}-01`); const own = reflections.find(r => r.author_id === d.userId);
  const move = (by: number) => { setMonth(shiftMonth(month, by)); };
  const save = () => run(async () => { await featureRpc('save_monthly_reflection', { p_month: `${month}-01`, p_body: draft ?? own?.body ?? '' }); setDraft(null); }, data.refresh);
  return <FeatureFrame title="Il nostro mese" error={data.error ?? d.loadError} loading={data.loading || !d.loaded} onRefresh={() => { void data.refresh(); void d.refresh(); }}>
    <Card><View style={{ gap: 12 }}><T v="h2">{new Date(`${month}-01T12:00:00Z`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button label="Mese precedente" variant="secondary" disabled={month <= '2000-01'} onPress={() => move(-1)} /><Button label="Mese successivo" variant="secondary" disabled={month >= d.today.slice(0, 7)} onPress={() => move(1)} /></View><T>{countLabel(recap.meetings.length, 'incontro', 'incontri')} · {countLabel(recap.days, 'giorno insieme', 'giorni insieme')}</T><T>€ {recap.spent.toFixed(2).replace('.', ',')} spesi per gli incontri</T><T>{countLabel(recap.wishes.length, 'desiderio realizzato', 'desideri realizzati')}</T><T tone="muted">Il mese corrente si aggiorna fino a oggi. I desideri completati prima di questo aggiornamento non hanno una data storica certa.</T></View></Card>
    {!recap.meetings.length && <Card><T tone="muted">Nessun incontro registrato in questo mese. Potete comunque conservarne un pensiero.</T></Card>}
    {recap.meetings.map(v => <Card key={v.id}><View style={{ gap: 8 }}><T v="title">{v.title}</T>{!!v.memory_notes && <T>{v.memory_notes}</T>}<Button label="Apri incontro e ricordi" variant="secondary" onPress={() => router.push(`/visit/${v.id}`)} /></View></Card>)}
    {recap.wishes.map(w => <Card key={w.id}><T>✨ {w.title}</T></Card>)}
    {reflections.filter(r => r.author_id !== d.userId).map(r => <Card key={r.id} accent><T v="title">Il pensiero di {d.names[r.author_id]}</T><T>{r.body}</T></Card>)}
    <Card><View style={{ gap: 12 }}><Input label="Cosa vuoi ricordare di questo mese?" value={draft ?? own?.body ?? ''} onChangeText={setDraft} maxLength={600} multiline /><Button label="Salva il tuo pensiero" loading={busy} onPress={save} /><T v="caption" tone="muted">Il pensiero è condiviso con il partner. Svuota il testo e salva per rimuoverlo.</T></View></Card>
  </FeatureFrame>;
}
