import React, { useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Header } from '../../ui/layout';
import { Button, Card, Chip, T } from '../../ui/primitives';
import { useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { notificationPath } from '../../navigation/notificationPath';
interface Notification { id: string; title: string; body: string; url: string; created_at: string; read_at: string | null }
export function InboxScreen() {
  const [limit, setLimit] = useState(50); const [unread, setUnread] = useState(false);
  const data = useFeatureRows<Notification>('notification_inbox', undefined, 'created_at', limit); const { busy, run } = useFeatureAction();
  const read = (id: string | null) => run(() => featureRpc('read_my_notifications', { p_id: id, p_before: id ? null : data.rows[0]?.created_at }), data.refresh);
  const open = (row: Notification) => { const path = notificationPath(row.url); if (!path) return; void read(row.id); router.push(path as Parameters<typeof router.push>[0]); };
  return <Screen scroll={false} header={<Header title="I tuoi avvisi" onBack={() => router.canGoBack() ? router.back() : router.replace('/')} />} contentStyle={{ paddingBottom: 16 }}>
    <View style={{ gap: 10 }}><T tone="muted">Gli avvisi restano qui anche quando la notifica del telefono non arriva.</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Chip label="Tutti" selected={!unread} onPress={() => setUnread(false)} /><Chip label="Da leggere" selected={unread} onPress={() => setUnread(true)} /></View><Button label="Segna tutti come letti" variant="secondary" disabled={busy || !data.rows.some(r => !r.read_at)} onPress={() => void read(null)} /></View>
    <Button label="Riepilogo degli aggiornamenti" icon="bell" variant="secondary" onPress={() => router.push('/novita')} />
    {data.error && <Card><T tone="danger">{data.error}</T><Button label="Riprova" onPress={() => void data.refresh()} /></Card>}
    <FlatList style={{ flex: 1 }} data={data.rows.filter(row => !unread || !row.read_at)} keyExtractor={row => row.id} initialNumToRender={6} contentContainerStyle={{ gap: 12, paddingBottom: 24 }} onRefresh={() => void data.refresh()} refreshing={data.loading} renderItem={({ item }) => <Card accent={!item.read_at}><View style={{ gap: 8 }}><T v="title">{item.title}</T><T>{item.body}</T><T v="caption" tone="muted">{new Date(item.created_at).toLocaleString('it-IT')}</T>{notificationPath(item.url) && <Button label="Apri" variant="secondary" disabled={busy} onPress={() => open(item)} />}{!item.read_at && <Button label="Segna come letto" variant="ghost" disabled={busy} onPress={() => void read(item.id)} />}</View></Card>} ListEmptyComponent={<T tone="muted">{data.loading ? 'Caricamento…' : unread ? 'Nessun avviso da leggere fra quelli caricati.' : 'I prossimi avvisi compariranno qui.'}</T>} ListFooterComponent={data.rows.length >= limit ? <Button label="Carica avvisi precedenti" variant="secondary" onPress={() => setLimit(n => n + 50)} /> : null} />
  </Screen>;
}
