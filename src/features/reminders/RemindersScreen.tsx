import { useDraftField } from '../drafts/useDraftField';
import React from 'react';
import { View } from 'react-native';
import { useAppDataFields } from '../../state/AppData';
import { Button, Card, Input, T } from '../../ui/primitives';
import { romeMoment } from '../../utils/together';
import { FeatureFrame, useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { MomentFields } from '../shared/MomentFields';
import { useProgressiveItems } from '../../hooks/useProgressiveItems';
interface Reminder { id: string; author_id: string; recipient_id: string; title: string; note: string; due_at: string; status: string }
export function RemindersScreen() {

  const d = useAppDataFields(['names', 'today', 'userId']); const data = useFeatureRows<Reminder>('partner_reminders'); const { busy, run } = useFeatureAction();
  const [title, setTitle] = useDraftField("reminders", 'title', ''); const [note, setNote] = useDraftField("reminders", 'note', ''); const [day, setDay] = useDraftField("reminders", 'day', d.today); const [time, setTime] = useDraftField("reminders", 'time', '20:00');
  const create = () => run(async () => {
    const moment = romeMoment(day, time); if (!Number.isFinite(moment)) throw new Error('Controlla data e ora');
    await featureRpc('create_partner_reminder', { p_title: title, p_note: note, p_due: new Date(moment).toISOString() }); setTitle(''); setNote('');
  }, data.refresh);
  const act = (id: string, action: string) => run(() => featureRpc('partner_reminder_action', { p_id: id, p_action: action }), data.refresh);
  const rows = data.rows.filter(r => r.status === 'open');
  const page = useProgressiveItems(rows);
  const renderRow = ({ item: r }: { item: Reminder }) => <Card key={r.id}><View style={{ gap: 8 }}><T v="title">{r.title}</T><T tone="muted">{r.author_id === d.userId ? 'Per il partner' : `Da ${d.names[r.author_id]}`} · {new Date(r.due_at).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}</T>{!!r.note && <T>{r.note}</T>}<Button variant="secondary" disabled={busy} label={r.recipient_id === d.userId ? 'Ne abbiamo parlato' : 'Annulla promemoria'} onPress={() => act(r.id, r.recipient_id === d.userId ? 'done' : 'cancel')} /></View></Card>;
  return <FeatureFrame title="Ricordati di chiedermi" error={data.error} loading={data.loading} onRefresh={data.refresh}
    list={{ label: "Elenco promemoria", items: page.visible, keyExtractor: r => r.id, renderItem: renderRow, empty: <Card><T tone="muted">Nessun promemoria aperto.</T></Card>, after: page.hasMore ? <><T tone="muted">{page.count} di {page.total} promemoria</T><Button label="Mostra altri promemoria" variant="secondary" onPress={page.showMore} /></> : null }}>
    <Card><View style={{ gap: 12 }}><T tone="muted">Un esame, un colloquio, una giornata importante: lascia al partner un promemoria per chiederti come è andata.</T><Input label="Di cosa vorresti parlare?" value={title} onChangeText={setTitle} maxLength={80} /><Input label="Un dettaglio (facoltativo)" value={note} onChangeText={setNote} maxLength={300} multiline /><MomentFields day={day} time={time} onDay={setDay} onTime={setTime} /><Button label="Crea promemoria per il partner" loading={busy} disabled={!title.trim()} onPress={create} /></View></Card>



  </FeatureFrame>;
}
