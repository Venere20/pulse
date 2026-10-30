import { countLabel } from '../../utils/italian';
import React, { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useAppDataFields } from '../../state/AppData';
import { Screen, Header } from '../../ui/layout';
import { Button, Card, Chip, Input, T } from '../../ui/primitives';
import { useFeatureRows } from '../useFeatureRows';
import { StoryMoment } from '../story/StoryScreen';
import { searchEntries, searchExcerpt, searchIndex, SearchKind } from './logic';
const FILTERS = [['all', 'Tutto'], ['memory', 'Incontri e ricordi'], ['fridge', 'Post-it'], ['bucket', 'Desideri'], ['story', 'La nostra storia']] as const;
export function SearchScreen() {

 const d = useAppDataFields(['bucket', 'loadError', 'loaded', 'refresh', 'visits']); const notes = useFeatureRows<{ id: string; body: string; created_at: string; removed_at: string | null }>('fridge_notes'); const moments = useFeatureRows<StoryMoment>('story_moments');
 const [query, setQuery] = useState(''); const [kind, setKind] = useState<SearchKind | 'all'>('all'); const [limit, setLimit] = useState(30);
 const index = useMemo(() => searchIndex(d.visits, notes.rows, d.bucket, moments.rows), [d.visits, d.bucket, notes.rows, moments.rows]);
 const results = useMemo(() => searchEntries(index, query, kind), [index, query, kind]); const error = d.loadError ?? notes.error ?? moments.error;
 const loading = !d.loaded || notes.loading || moments.loading;
 const refresh = async () => { await Promise.all([d.refresh(), notes.refresh(), moments.refresh()]); };
 return <Screen scroll={false} header={<Header title="Cerca nei vostri ricordi" onBack={() => router.canGoBack() ? router.back() : router.replace('/')} />} contentStyle={{ paddingBottom: 16 }}>
  <Input label="Cosa cerchi?" placeholder="Una parola, un luogo, un ricordo…" value={query} onChangeText={text => { setQuery(text); setLimit(30); }} maxLength={120} autoCorrect={false} />
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{FILTERS.map(([value, label]) => <Chip key={value} label={label} selected={kind === value} onPress={() => { setKind(value); setLimit(30); }} />)}</View>
  {error ? <Card><T tone="danger">Ricerca incompleta: alcuni dati non sono disponibili.</T><Button label="Riprova" onPress={() => void refresh()} /></Card> : <T v="caption" tone="muted">{loading ? 'Carico i contenuti condivisi…' : query.trim().length < 2 ? 'Scrivi almeno due caratteri. La ricerca ignora accenti e maiuscole.' : countLabel(results.length, 'risultato', 'risultati')}</T>}
  <FlatList style={{ flex: 1 }} data={results.slice(0, limit)} keyExtractor={row => `${row.kind}:${row.id}`} initialNumToRender={6} contentContainerStyle={{ gap: 12, paddingBottom: 24 }} renderItem={({ item }) => <Card><View style={{ gap: 8 }}><T v="caption" tone="muted">{FILTERS.find(([value]) => value === item.kind)?.[1]}</T><T v="title">{item.title}</T>{!!item.text && <T>{searchExcerpt(item.text, query)}</T>}<Button label="Apri il contenuto" variant="secondary" onPress={() => router.push(item.path as Parameters<typeof router.push>[0])} /></View></Card>} ListEmptyComponent={!loading && query.trim().length >= 2 ? <T tone="muted">Nessun risultato per queste parole.</T> : null} ListFooterComponent={results.length > limit ? <Button label="Mostra altri risultati" variant="secondary" onPress={() => setLimit(n => n + 30)} /> : null} />
 </Screen>;
}
