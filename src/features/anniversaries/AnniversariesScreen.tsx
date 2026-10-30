import { DateField } from '../../ui/DateField';
import { useDraftField } from '../drafts/useDraftField';
import React from 'react';
import { View } from 'react-native';
import { useAppDataFields } from '../../state/AppData';
import { Button, Card, Chip, Input, T } from '../../ui/primitives';
import { formatDateIt } from '../../utils/dates';
import { confirmAction } from '../../utils/confirm';
import { FeatureFrame, useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { Anniversary, AnniversaryRepeat, anniversaryRepeat, isAnniversaryToday, nextAnniversary, validAnniversaryDate } from './logic';
import { useProgressiveItems } from '../../hooks/useProgressiveItems';
export function AnniversariesScreen() {

  const d = useAppDataFields(['today', 'userId']); const data = useFeatureRows<Anniversary>('anniversaries'); const { busy, run } = useFeatureAction();
  const [editing, setEditing] = useDraftField("anniversaries", 'editing', false); const [id, setId] = useDraftField<string | null>("anniversaries", 'id', null); const [title, setTitle] = useDraftField("anniversaries", 'title', ''); const [day, setDay] = useDraftField("anniversaries", 'day', d.today); const [annual, setAnnual] = useDraftField("anniversaries", 'annual', true); const [emoji, setEmoji] = useDraftField("anniversaries", 'emoji', '❤️'); const [notify, setNotify] = useDraftField("anniversaries", 'notify', true);
  const [monthly, setMonthly] = useDraftField('anniversaries', 'monthly', false);
  const repeat = anniversaryRepeat({ annual, monthly });
  const selectRepeat = (value: AnniversaryRepeat) => { setMonthly(value === 'monthly'); setAnnual(value === 'yearly'); };
  const start = (r?: Anniversary, preset?: 'yearly' | 'monthly') => {
    setId(r?.id ?? null);
    setTitle(r?.title ?? (preset === 'monthly' ? 'Il nostro mesiversario' : preset === 'yearly' ? 'Il nostro anniversario' : ''));
    setDay(r?.first_day ?? d.today);
    selectRepeat(r ? anniversaryRepeat(r) : preset ?? 'yearly');
    setEmoji(r?.emoji ?? '❤️'); setNotify(r?.notify ?? true); setEditing(true);
  };
  const dateValid = validAnniversaryDate(day);
  const save = () => run(async () => {
    if (!dateValid) throw new Error("Scegli una data valida dal calendario.");
    await featureRpc('save_anniversary_v2', { p_id: id, p_title: title, p_first: day, p_repeat: repeat, p_emoji: emoji, p_notify: notify });
    setEditing(false);
  }, data.refresh);
  const remove = (rid: string) => run(async () => { if (await confirmAction('Elimina ricorrenza', 'Vuoi rimuovere questa data speciale?', 'Elimina')) await featureRpc('delete_anniversary', { p_id: rid }); }, data.refresh);
  const rows = [...data.rows].sort((a, b) => (nextAnniversary(a, d.today) ?? '9999').localeCompare(nextAnniversary(b, d.today) ?? '9999'));
  const page = useProgressiveItems(rows);
  const renderRow = ({ item: a }: { item: Anniversary }) => <Card accent={isAnniversaryToday(a, d.today)}><View style={{ gap: 8 }}><T v="title">{a.emoji} {a.title}</T><T>{isAnniversaryToday(a, d.today) ? 'È oggi! ❤️' : nextAnniversary(a, d.today) ? `Prossima: ${formatDateIt(nextAnniversary(a, d.today))}` : 'Una data da ricordare'}</T><T tone="muted">Dal {formatDateIt(a.first_day)} · {a.monthly ? 'Ogni mese' : a.annual ? 'Ogni anno' : 'Una sola volta'}</T>{a.author_id === d.userId && <><Button label="Modifica ricorrenza" variant="secondary" disabled={busy} onPress={() => start(a)} /><Button label="Elimina ricorrenza" variant="ghost" disabled={busy} onPress={() => remove(a.id)} /></>}</View></Card>;
  return <FeatureFrame title="Le nostre ricorrenze" error={data.error} loading={data.loading} onRefresh={data.refresh}
    list={{ label: "Elenco ricorrenze", items: page.visible, keyExtractor: a => a.id, renderItem: renderRow, empty: <Card><T tone="muted">Anniversari, compleanni e piccoli traguardi: scegliete le vostre date.</T></Card>, after: page.hasMore ? <><T tone="muted">{page.count} di {page.total} ricorrenze</T><Button label="Mostra altre ricorrenze" variant="secondary" onPress={page.showMore} /></> : null }}>
    <Card><View style={{ gap: 12 }}>
      <T v="title">Le vostre date importanti</T>
      <T tone="muted">Anniversario, mesiversario e tutte le ricorrenze che volete aggiungere. Nelle giornate speciali, anche il Pulse festeggia con voi.</T>
      <Button label="Anniversario" variant="secondary" disabled={busy} onPress={() => start(undefined, 'yearly')} />
      <Button label="Mesiversario" variant="secondary" disabled={busy} onPress={() => start(undefined, 'monthly')} />
      <Button label="Aggiungi una ricorrenza" disabled={busy} onPress={() => start()} />
    </View></Card>
    {editing && <Card accent><View style={{ gap: 12 }}>
      <T v="title">{id ? 'Modifica ricorrenza' : 'Nuova ricorrenza'}</T>
      <Input label="Cosa festeggiamo?" value={title} onChangeText={setTitle} maxLength={80} />
      <DateField label="Data di inizio" value={day} onChange={setDay} disabled={busy} />
      {!dateValid && <T tone="danger" v="caption">Scegli una data valida dal calendario.</T>}
      <T tone="muted">Ripetizione</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {([['yearly', 'Ogni anno'], ['monthly', 'Ogni mese'], ['once', 'Una sola volta']] as const).map(([value, label]) => <Chip key={value} label={label} selected={repeat === value} onPress={() => selectRepeat(value)} />)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['❤️', '🎂', '💍', '✨', '🎉'].map(e => <Chip key={e} label={e} selected={emoji === e} onPress={() => setEmoji(e)} />)}</View>
      <Chip label={notify ? 'Promemoria alle 9 ✓' : 'Promemoria disattivato'} selected={notify} onPress={() => setNotify(v => !v)} />
      <T v="caption" tone="muted">{monthly ? 'Il primo mesiversario cade un mese dopo la data iniziale. Se il giorno non esiste, si festeggia l’ultimo giorno del mese, mantenendo la data originale per i mesi successivi.' : 'Le ricorrenze del 29 febbraio si celebrano il 28 negli anni non bisestili.'} I promemoria seguono l’orario di Roma.</T>
      <Button label="Salva ricorrenza" loading={busy} disabled={!title.trim() || !dateValid} onPress={save} />
      <Button label="Annulla modifiche" variant="ghost" disabled={busy} onPress={() => setEditing(false)} />
    </View></Card>}



  </FeatureFrame>;
}
