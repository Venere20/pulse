import { useDraftField } from '../drafts/useDraftField';
import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../theme/ThemeProvider';
import { router } from 'expo-router';
import { useAppDataFields } from '../../state/AppData';
import { Button, Card, Chip, Input, T } from '../../ui/primitives';
import { FeatureFrame, useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { useMinuteClock } from '../shared/useMinuteClock';
import { MIN_TOUCH } from '../../theme/tokens';
export const EMOTIONS = [{ id: 'happy', label: '😊 Felice' }, { id: 'calm', label: '😌 Sereno/a' }, { id: 'tired', label: '😴 Stanco/a' }, { id: 'sad', label: '😔 Giù' }, { id: 'anxious', label: '😟 In ansia' }, { id: 'overwhelmed', label: '🫠 Troppe cose' }, { id: 'loved', label: '🥰 Amato/a' }, { id: 'lonely', label: '🫂 Mi sento solo/a' }, { id: 'excited', label: '🤩 Entusiasta' }, { id: 'annoyed', label: '😒 Infastidito/a' }, { id: 'angry', label: '😠 Arrabbiato/a' }, { id: 'sorry', label: '😞 Dispiaciuto/a' }];
export interface Emotion { id: string; mood: string; note: string; expires_at: string }
const emotionLabel = (mood?: string) => EMOTIONS.find(item => item.id === mood)?.label ?? 'Nessun umore condiviso';
const expiryLabel = (expiresAt: string) => new Date(expiresAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const DURATIONS = [
  { minutes: 30, label: '30 minuti' }, { minutes: 120, label: '2 ore' },
  { minutes: 480, label: '8 ore' }, { minutes: 1440, label: '1 giorno' },
] as const;
export function EmotionHomeCard() {
  const { c } = useTheme();
  const d = useAppDataFields(['names', 'partnerId', 'userId']); const data = useFeatureRows<Emotion>('emotional_states'); const now = useMinuteClock();
  const partner = data.rows.find(r => r.id === d.partnerId && Date.parse(r.expires_at) > now);
  const own = data.rows.find(r => r.id === d.userId && Date.parse(r.expires_at) > now);
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel="Apri e condividi il vostro umore" activeOpacity={0.8} onPress={() => router.push('/umore')}><Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1, gap: 4 }}>{data.error ? <T tone="muted">Umore non disponibile. Tocca per riprovare.</T> : data.loading ? <T tone="muted">Caricamento…</T> : <><T bold>{d.names[d.partnerId] || 'Partner'} · {partner ? emotionLabel(partner.mood) : 'Come stai?'}</T>{!!partner?.note && <T tone="muted" numberOfLines={2}>{partner.note}</T>}<T tone="muted">Tu · {own ? emotionLabel(own.mood) : 'Condividi il tuo umore'}</T></>} </View><Icon name="chevronRight" size={20} color={c.textMuted} /></View></Card></TouchableOpacity>;
}
// Kept at module scope so status cards retain their identity when the form updates.
function StateCard({ title, emotion, isOwn }: { title: string; emotion?: Emotion; isOwn: boolean }) {
  const { c, s, r } = useTheme();
  return <View style={{ flex: 1, minWidth: 0, backgroundColor: c.surface, borderRadius: r.lg, padding: s.md, gap: s.sm }}>
    <T v="caption" tone="muted" bold>{title}</T>
    {emotion ? <>
      <T bold numberOfLines={2} style={{ minHeight: 42 }}>{emotionLabel(emotion.mood)}</T>
      <T v="caption" tone="faint">Fino alle {expiryLabel(emotion.expires_at)}</T>
    </> : <>
      <T tone="muted" numberOfLines={2} style={{ minHeight: 42 }}>Nessun umore condiviso</T>
      <T v="caption" tone="faint">{isOwn ? 'Condividi quando vuoi' : 'Nessuno stato attivo'}</T>
    </>}
  </View>;
}
export function EmotionsScreen() {
  const { c, s, r } = useTheme();
  const d = useAppDataFields(['names', 'partnerId', 'userId']); const data = useFeatureRows<Emotion>('emotional_states'); const { busy, run } = useFeatureAction(); const now = useMinuteClock();
  const [mood, setMood] = useDraftField("emotions", 'mood', 'happy'); const [note, setNote] = useDraftField("emotions", 'note', ''); const [minutes, setMinutes] = useDraftField("emotions", 'minutes', 120); const [notify, setNotify] = useDraftField("emotions", 'notify', false);
  const [showAll, setShowAll] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const save = (value: string | null) => run(() => featureRpc('set_my_emotion', { p_mood: value, p_note: value ? note : '', p_minutes: minutes, p_notify: notify }), data.refresh);
  const active = data.rows.filter(row => Date.parse(row.expires_at) > now);
  const own = active.find(row => row.id === d.userId);
  const partner = active.find(row => row.id === d.partnerId);
  const partnerName = d.names[d.partnerId] || 'Partner';
  const firstSix = EMOTIONS.slice(0, 6);
  const selectedOutsideFirstSix = EMOTIONS.find(item => item.id === mood && !firstSix.some(initial => initial.id === item.id));
  const visibleEmotions = showAll ? EMOTIONS : selectedOutsideFirstSix ? [...firstSix, selectedOutsideFirstSix] : firstSix;
  const durationName = DURATIONS.find(option => option.minutes === minutes)?.label ?? `${minutes} minuti`;
  const hasNotes = Boolean(own?.note?.trim() || partner?.note?.trim());
  return <FeatureFrame title="Come mi sento" error={data.error} loading={data.loading} onRefresh={data.refresh}>
    <View style={{ gap: s.md }}>
      <T v="title" accessibilityRole="header">Adesso</T>
      <View style={{ flexDirection: 'row', gap: s.sm }}>
        <StateCard title="TU" emotion={own} isOwn />
        <StateCard title={partnerName} emotion={partner} isOwn={false} />
      </View>
      {(own || hasNotes) && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.lg, alignItems: 'center' }}>
        {hasNotes && <TouchableOpacity accessibilityRole="button" accessibilityLabel={showNotes ? 'Nascondi le note condivise' : 'Leggi le note condivise'} accessibilityState={{ expanded: showNotes }} onPress={() => setShowNotes(value => !value)} style={{ minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: s.xs }}>
          <T tone="primary" v="caption" bold>{showNotes ? 'Nascondi note' : 'Leggi note'}</T>
          <Icon name={showNotes ? 'chevronUp' : 'chevronDown'} size={17} color={c.primary} />
        </TouchableOpacity>}
        {!!own && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Nascondi il mio umore" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => { void save(null); }} style={{ minHeight: MIN_TOUCH, justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
          <T tone="primary" v="caption" bold>Nascondi il mio umore</T>
        </TouchableOpacity>}
      </View>}
      {showNotes && hasNotes && <Card outlined={false}><View style={{ gap: s.md }}>
        {!!partner?.note?.trim() && <View style={{ gap: 4 }}><T bold>{partnerName}</T><T tone="muted">{partner.note}</T></View>}
        {!!own?.note?.trim() && <View style={{ gap: 4 }}><T bold>Tu</T><T tone="muted">{own.note}</T></View>}
      </View></Card>}
    </View>
    <View style={{ gap: s.md }}>
      <View style={{ gap: 5 }}><T v="h2" accessibilityRole="header">Oggi mi sento…</T><T tone="muted">Scegli l&apos;emozione che descrive meglio questo momento.</T></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>{visibleEmotions.map(item => <Chip key={item.id} label={item.label} selected={mood === item.id} onPress={() => setMood(item.id)} />)}</View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={showAll ? 'Mostra meno emozioni' : 'Mostra tutte le 12 emozioni'} accessibilityState={{ expanded: showAll }} onPress={() => setShowAll(value => !value)} style={{ minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s.sm }}>
        <T tone="primary" bold>{showAll ? 'Mostra meno' : 'Mostra tutte le 12 emozioni'}</T>
        <Icon name={showAll ? 'chevronUp' : 'chevronDown'} size={18} color={c.primary} />
      </TouchableOpacity>
    </View>
    <View style={{ backgroundColor: c.surface, borderRadius: r.lg, overflow: 'hidden' }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Dettagli della condivisione" accessibilityState={{ expanded: showDetails }} activeOpacity={0.8} onPress={() => setShowDetails(value => !value)} style={{ minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: s.md, padding: s.md }}>
        <View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: r.md, backgroundColor: c.primarySoft }}><Icon name="sliders" size={21} color={c.primary} /></View>
        <View style={{ flex: 1, gap: 4 }}><T bold>Dettagli della condivisione</T><T v="caption" tone="muted" numberOfLines={2}>{durationName} · {notify ? 'Avvisa il partner' : 'Senza notifica'} · {note.trim() ? 'Con una frase' : 'Frase facoltativa'}</T></View>
        <Icon name={showDetails ? 'chevronUp' : 'chevronDown'} size={20} color={c.textMuted} />
      </TouchableOpacity>
      {showDetails && <View style={{ padding: s.lg, paddingTop: 0, gap: s.lg }}>
        <View style={{ height: 1, backgroundColor: c.border }} />
        <View style={{ gap: s.sm }}>
          <Input label="Vuoi aggiungere una frase?" placeholder="Se vuoi, racconta cosa senti..." value={note} onChangeText={setNote} maxLength={140} multiline style={{ minHeight: 84, textAlignVertical: 'top' }} />
          <T v="caption" tone="faint" style={{ textAlign: 'right' }}>{note.length}/140</T>
        </View>
        <View style={{ gap: s.md }}><T bold>Per quanto tempo vuoi mostrarlo?</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>{DURATIONS.map(option => <Chip key={option.minutes} label={option.label} selected={minutes === option.minutes} onPress={() => setMinutes(option.minutes)} />)}</View></View>
        <View style={{ gap: s.sm }}><T bold>Notifica al partner</T>
          <Chip label={notify ? 'Avvisa il partner ✓' : 'Senza notifica'} selected={notify} onPress={() => setNotify(previous => !previous)} />
          <T v="caption" tone="muted">La notifica è facoltativa: non modifica la durata dell&apos;umore. Pulse ne limita la frequenza.</T>
        </View>
      </View>}
    </View>
    <View style={{ gap: s.sm }}>
      <Button label="Condividi come mi sento" icon="heart" loading={busy} onPress={() => { void save(mood); }} />
      <T v="caption" tone="muted" style={{ textAlign: 'center' }}>{notify ? 'Pulse proverà ad avvisare il partner.' : 'Il tuo umore sarà condiviso senza notifica.'}</T>
    </View>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Di cosa avresti bisogno?" activeOpacity={0.8} onPress={() => router.push('/vicinanza')}>
      <Card outlined={false}><View style={{ flexDirection: 'row', alignItems: 'center', gap: s.md }}>
        <View style={{ width: 44, height: 44, borderRadius: r.md, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="heart" size={23} color={c.primary} /></View>
        <View style={{ flex: 1, gap: 4 }}><T bold>Di cosa avresti bisogno?</T><T tone="muted" v="caption">Raccontalo al partner, se vuoi.</T></View>
        <Icon name="chevronRight" size={20} color={c.textMuted} />
      </View></Card>
    </TouchableOpacity>
  </FeatureFrame>;
}

