import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useAppDataFields } from '../../state/AppData';
import { Button, Card, Chip, Input, T } from '../../ui/primitives';
import { CATEGORIES } from '../../types/bucket';
import { FeatureFrame, useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { BucketDetail, BucketPreference, chooseCandidates, pickCandidate } from './logic';
export function ChooseScreen() {

  const d = useAppDataFields(['bucket', 'loadError', 'loaded', 'partnerId', 'refresh', 'userId']); const preferences = useFeatureRows<BucketPreference>('bucket_preferences'); const details = useFeatureRows<BucketDetail>('bucket_details'); const { busy, run } = useFeatureAction();
  const [category, setCategory] = useState('all'); const [budget, setBudget] = useState<number | null>(null); const [minutes, setMinutes] = useState<number | null>(null); const [chosen, setChosen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); const [cost, setCost] = useState(''); const [duration, setDuration] = useState('');
  const candidates = chooseCandidates(d.bucket, preferences.rows, details.rows, [d.userId, d.partnerId], category, budget, minutes);
  const result = candidates.find(c => c.item.id === chosen)?.item;
  const refresh = async () => { await Promise.all([d.refresh(), preferences.refresh(), details.refresh()]); };
  const vote = (id: string, value: string | null) => run(() => featureRpc('set_bucket_preference', { p_id: id, p_vote: value }), preferences.refresh);
  const save = () => run(async () => {
    const numericCost = cost.trim() ? Number(cost.replace(',', '.')) : null; const numericDuration = duration.trim() ? Number(duration) : null;
    if ((numericCost !== null && !Number.isFinite(numericCost)) || (numericDuration !== null && !Number.isInteger(numericDuration))) throw new Error('Inserisci importi e minuti validi');
    await featureRpc('set_bucket_details', { p_id: editing, p_budget: numericCost, p_minutes: numericDuration }); setEditing(null);
  }, details.refresh);
  return <FeatureFrame title="Scegli per noi" error={preferences.error ?? details.error ?? d.loadError} loading={preferences.loading || details.loading || !d.loaded} onRefresh={refresh}>
    <Card><View style={{ gap: 12 }}><T v="title">Cosa facciamo insieme?</T><T tone="muted">Parte dai vostri desideri, dà precedenza a quelli che piacciono a entrambi ed esclude ogni «Non ora».</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Chip label="Tutto" selected={category === 'all'} onPress={() => setCategory('all')} />{CATEGORIES.map(c => <Chip key={c.id} label={c.label} selected={category === c.id} onPress={() => setCategory(c.id)} />)}</View><T>Budget totale stimato</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[null, 0, 30, 100].map(v => <Chip key={String(v)} label={v === null ? 'Qualsiasi' : v === 0 ? 'Gratis' : `Fino a € ${v}`} selected={budget === v} onPress={() => setBudget(v)} />)}</View><T>Tempo disponibile</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[null, 60, 120, 480].map(v => <Chip key={String(v)} label={v === null ? 'Qualsiasi' : `${v / 60} ${v === 60 ? 'ora' : 'ore'}`} selected={minutes === v} onPress={() => setMinutes(v)} />)}</View><T v="caption" tone="muted">Con un limite di budget o tempo, includiamo solo desideri con una stima compilata.</T><Button label="Scegli per noi ✨" disabled={!candidates.length} onPress={() => setChosen(pickCandidate(candidates)?.id ?? null)} />{!candidates.length && <T tone="muted">Nessun desiderio compatibile. Cambia i filtri o aggiungi le stime.</T>}</View></Card>
    {result && <Card accent><View style={{ gap: 12 }}><T v="h2">✨ {result.title}</T><Button label="Organizziamo questa uscita" onPress={() => router.push({ pathname: '/proposte', params: { wish: result.id, title: result.title } })} /></View></Card>}
    {d.bucket.filter(b => !b.is_completed).map(item => {
      const own = preferences.rows.find(p => p.bucket_item_id === item.id && p.user_id === d.userId); const partner = preferences.rows.find(p => p.bucket_item_id === item.id && p.user_id === d.partnerId); const detail = details.rows.find(r => r.id === item.id);
      return <Card key={item.id}><View style={{ gap: 10 }}><T v="title">{item.title}</T><T tone="muted">Partner: {partner?.vote === 'yes' ? 'Mi va' : partner?.vote === 'no' ? 'Non ora' : partner?.vote === 'maybe' ? 'Forse' : 'Non ha ancora scelto'}</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[['yes', '❤️ Mi va'], ['maybe', '🤔 Forse'], ['no', '🌿 Non ora']].map(([v, label]) => <Chip key={v} label={label} selected={own?.vote === v} onPress={() => { if (!busy) vote(item.id, own?.vote === v ? null : v); }} />)}</View><T tone="muted">Budget: {detail?.estimated_budget != null ? `€ ${detail.estimated_budget}` : 'da stimare'} · Tempo: {detail?.estimated_minutes != null ? `${detail.estimated_minutes} min` : 'da stimare'}</T><Button label="Modifica le stime" variant="secondary" disabled={busy} onPress={() => { setEditing(item.id); setCost(String(detail?.estimated_budget ?? '')); setDuration(String(detail?.estimated_minutes ?? '')); }} />{editing === item.id && <><Input label="Budget totale (€)" value={cost} onChangeText={setCost} keyboardType="decimal-pad" /><Input label="Durata (minuti)" value={duration} onChangeText={setDuration} keyboardType="number-pad" /><Button label="Salva stime" loading={busy} onPress={save} /><Button label="Annulla modifiche" variant="ghost" onPress={() => setEditing(null)} /></>}</View></Card>;
    })}
  </FeatureFrame>;
}
