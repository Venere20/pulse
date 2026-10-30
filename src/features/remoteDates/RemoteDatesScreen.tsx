import { useDraftField } from '../drafts/useDraftField';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useAppDataFields } from '../../state/AppData';
import { Button, Card, Chip, Input, T } from '../../ui/primitives';
import { romeMoment } from '../../utils/together';
import { FeatureFrame, useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { MomentFields } from '../shared/MomentFields';
import { useMinuteClock } from '../shared/useMinuteClock';
import { useProgressiveItems } from '../../hooks/useProgressiveItems';
export interface RemoteDate { id: string; author_id: string; recipient_id: string; response_by: string; title: string; kind: string; note: string; starts_at: string; duration_minutes: number; status: string }
const KINDS = [{ id: 'call', label: '📞 Chiamata' }, { id: 'dinner', label: '🍝 Cena insieme' }, { id: 'game', label: '🎲 Giochi' }, { id: 'music', label: '🎵 Musica' }];
export function RemoteDatesScreen() {

  const d = useAppDataFields(['today', 'userId']); const data = useFeatureRows<RemoteDate>('remote_dates'); const { busy, run } = useFeatureAction(); const now = useMinuteClock();
  const [title, setTitle] = useDraftField("remote-dates", 'title', ''); const [note, setNote] = useDraftField("remote-dates", 'note', ''); const [kind, setKind] = useDraftField("remote-dates", 'kind', 'call'); const [duration, setDuration] = useDraftField("remote-dates", 'duration', 30);
  const [day, setDay] = useDraftField("remote-dates", 'day', d.today); const [time, setTime] = useDraftField("remote-dates", 'time', '21:00'); const [counter, setCounter] = useState<string | null>(null); const [archive, setArchive] = useState(false);
  const moment = () => { const value = romeMoment(day, time); if (!Number.isFinite(value)) throw new Error('Controlla data e ora'); return new Date(value).toISOString(); };
  const act = (id: string, action: string) => run(async () => { await featureRpc('remote_date_action', { p_id: id, p_action: action, p_start: action === 'counter' ? moment() : null }); setCounter(null); }, data.refresh);
  const create = () => run(async () => { await featureRpc('create_remote_date', { p_title: title, p_kind: kind, p_note: note, p_start: moment(), p_duration: duration }); setTitle(''); setNote(''); }, data.refresh);
  const live = (r: RemoteDate) => ['proposed', 'accepted'].includes(r.status);
  const rows = data.rows.filter(r => archive ? !live(r) : live(r)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const page = useProgressiveItems(rows, archive ? 'archive' : 'live');
  const renderRow = ({ item: r }: { item: RemoteDate }) => <Card accent={r.status === 'accepted'}><View style={{ gap: 10 }}><T v="title">{r.title}</T><T tone="muted">{KINDS.find(k => k.id === r.kind)?.label} · {r.duration_minutes} minuti</T><T>{new Date(r.starts_at).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}</T>{!!r.note && <T>{r.note}</T>}<T tone="muted">{({ proposed: r.response_by === d.userId ? "In attesa della tua risposta" : "In attesa della risposta del partner", accepted: 'Confermato', declined: "Non accettato", cancelled: 'Annullato', done: "Concluso insieme", expired: 'Proposta scaduta' } as Record<string, string>)[r.status]}</T>
      {r.status === 'proposed' && r.response_by === d.userId && Date.parse(r.starts_at) > now && <><Button label="Ci sono ❤️" disabled={busy} onPress={() => act(r.id, 'accept')} /><Button label="Proponi un altro orario" variant="secondary" disabled={busy} onPress={() => { setCounter(r.id); const local = new Date(r.starts_at).toLocaleString('sv-SE', { timeZone: 'Europe/Rome' }); setDay(local.slice(0, 10)); setTime(local.slice(11, 16)); }} /><Button label="Questa volta non riesco" variant="ghost" disabled={busy} onPress={() => act(r.id, 'decline')} /></>}
      {counter === r.id && <><MomentFields day={day} time={time} onDay={setDay} onTime={setTime} /><Button label="Invia il nuovo orario" loading={busy} onPress={() => act(r.id, 'counter')} /><Button label="Chiudi controproposta" variant="ghost" onPress={() => setCounter(null)} /></>}
      {r.status === 'accepted' && Date.parse(r.starts_at) <= now && <Button label="Segna come concluso" disabled={busy} onPress={() => act(r.id, 'done')} />}
      {live(r) && <Button label="Annulla appuntamento" variant="ghost" disabled={busy} onPress={() => act(r.id, 'cancel')} />}
    </View></Card>;
  return <FeatureFrame title="Appuntamenti a distanza" error={data.error} loading={data.loading} onRefresh={data.refresh}
    list={{ label: "Elenco appuntamenti", items: page.visible, keyExtractor: r => r.id, renderItem: renderRow, empty: <Card><T tone="muted">Nessun appuntamento in questa sezione.</T></Card>, after: page.hasMore ? <><T tone="muted">{page.count} di {page.total} appuntamenti</T><Button label="Mostra altri appuntamenti" variant="secondary" onPress={page.showMore} /></> : null }}>
    <Card><View style={{ gap: 12 }}><T tone="muted">Scegliete un momento per voi. Per chiamate e musica, usate le vostre app abituali.</T><Input label="Il nostro appuntamento" value={title} onChangeText={setTitle} maxLength={80} /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{KINDS.map(k => <Chip key={k.id} label={k.label} selected={kind === k.id} onPress={() => setKind(k.id)} />)}</View><Input label="Un’idea per la serata" value={note} onChangeText={setNote} maxLength={300} multiline /><MomentFields day={day} time={time} onDay={setDay} onTime={setTime} /><T tone="muted">Durata dell’appuntamento</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[15, 30, 60, 120].map(m => <Chip key={m} label={`${m} minuti`} selected={duration === m} onPress={() => setDuration(m)} />)}</View><Button label="Invita il partner" disabled={!title.trim()} loading={busy} onPress={create} /></View></Card>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Chip label="In programma" selected={!archive} onPress={() => setArchive(false)} /><Chip label="Archivio" selected={archive} onPress={() => setArchive(true)} /></View>



  </FeatureFrame>;
}
