import { trackResult } from '../services/saveState';
import React, { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { View, TouchableOpacity, Text, Platform } from 'react-native';
import { supabase } from '../config/supabase';
import { BucketItem, BucketCategory, CATEGORIES } from '../types/bucket';
import { useAppDataFields } from '../state/AppData';
import { Header, BottomSheet, IconButton, SegmentedTabs } from '../ui/layout';
import { ListScreen } from '../ui/ListScreen';
import { Button, Card, Chip, EmptyState, Input, T, Row, Skeleton } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { confirmAction } from '../utils/confirm';
import { MIN_TOUCH } from '../theme/tokens';
import { useDraftField } from '../features/drafts/useDraftField';
import { useProgressiveItems } from '../hooks/useProgressiveItems';

interface Props {
  onOpenVisit: (id: string) => void;
}

export const BucketScreen: React.FC<Props> = React.memo(({ onOpenVisit }) => {
  const { c, s, r } = useTheme();
  const toast = useToast();
  const d = useAppDataFields(['bucket', 'loaded', 'refresh', 'userId', 'visitBucket', 'visits']);
  const [title, setTitle] = useDraftField('bucket', 'title', '');
  const [category, setCategory] = useDraftField<BucketCategory>('bucket', 'category', 'place');
  const [filter, setFilter] = useState<BucketCategory | 'all'>('all');
  const [completion, setCompletion] = useState<'pending' | 'completed'>('pending');
  const [adding, setAdding] = useState(false);

  const [editItem, setEditItem] = useState<BucketItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<BucketCategory>('place');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!title.trim()) return toast.error('Scrivi il desiderio');
    setAdding(true);
    const { error } = await trackResult(() => supabase
      .from('bucket_list')
      .insert([{ title: title.trim(), category, is_completed: false, created_by: d.userId }]));
    setAdding(false);
    if (error) return toast.error('Errore: ' + error.message);
    setTitle('');
    toast.success('Aggiunto alla lista');
    d.refresh(['bucket_list']);
  };

  const toggle = async (item: BucketItem) => {
    const { error } = await trackResult(() => supabase.from('bucket_list').update({ is_completed: !item.is_completed }).eq('id', item.id));
    if (error) return toast.error('Errore: ' + error.message);
    d.refresh(['bucket_list']);
  };

  const openEdit = (item: BucketItem) => {
    setEditItem(item);
    setEditTitle(item.title);
    setEditCategory(item.category);
  };

  const saveEdit = async () => {
    if (!editItem) return;
    if (!editTitle.trim()) return toast.error('Scrivi il desiderio');
    setBusy(true);
    const { error } = await trackResult(() => supabase.from('bucket_list').update({ title: editTitle.trim(), category: editCategory }).eq('id', editItem.id));
    setBusy(false);
    if (error) return toast.error('Errore: ' + error.message);
    setEditItem(null);
    toast.success('Desiderio aggiornato');
    d.refresh(['bucket_list']);
  };

  const remove = async () => {
    if (!editItem) return;
    const ok = await confirmAction('Elimina desiderio', `Eliminare "${editItem.title}" dalla lista? Verrà scollegato anche dagli incontri.`, 'Elimina');
    if (!ok) return;
    setBusy(true);
    // il collegamento con gli incontri si elimina da solo (ON DELETE CASCADE); lo togliamo comunque per sicurezza
    await trackResult(() => supabase.from('visit_bucket_items').delete().eq('bucket_item_id', editItem.id));
    const { error } = await trackResult(() => supabase.from('bucket_list').delete().eq('id', editItem.id));
    setBusy(false);
    if (error) return toast.error('Errore: ' + error.message);
    setEditItem(null);
    toast.success('Desiderio eliminato');
    d.refresh(['bucket_list', 'visit_bucket_items']);
  };

  const visitFor = (itemId: string) => {
    const link = d.visitBucket.find((l) => l.bucket_item_id === itemId);
    return link ? d.visits.find((v) => v.id === link.visit_id) : undefined;
  };

  const items = useMemo(() => d.bucket.filter((i) =>
    i.is_completed === (completion === 'completed') && (filter === 'all' || i.category === filter)), [d.bucket, filter, completion]);
  const page = useProgressiveItems(items, `${completion}:${filter}`);
  const done = d.bucket.filter((i) => i.is_completed).length;

  const renderRow = ({ item }: { item: BucketItem }) => {
            const visit = visitFor(item.id);
            return (
              <Card key={item.id} padded={false}>
                <Row gap={0}>
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.is_completed }}
                    {...(Platform.OS === 'web' ? { 'aria-checked': item.is_completed } : {})}
                    accessibilityLabel={item.title}
                    onPress={() => toggle(item)}
                    style={{ width: MIN_TOUCH + 12, minHeight: 64, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name={item.is_completed ? 'checkSquare' : 'star'} size={24} color={item.is_completed ? c.success : c.textFaint} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, paddingVertical: s.md, gap: 4 }}>
                    <T style={item.is_completed ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}>
                      {CATEGORIES.find((cat) => cat.id === item.category)?.emoji} {item.title}
                    </T>
                    {visit && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Apri incontro ${visit.title}`}
                        onPress={() => onOpenVisit(visit.id)}
                        style={{ alignSelf: 'flex-start', minHeight: MIN_TOUCH, justifyContent: 'center', backgroundColor: c.primarySoft, borderRadius: r.pill, paddingHorizontal: 10 }}
                      >
                        <Text style={{ color: c.primary, fontSize: 14, fontWeight: '600' }}>{item.is_completed ? 'Incontro' : 'Pianificato'}: {visit.title}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <IconButton icon="edit" label={`Modifica ${item.title}`} onPress={() => openEdit(item)} />
                </Row>
              </Card>
            );
  };
  return (<>
    <ListScreen label="Lista dei desideri"
      header={<Header title="I nostri desideri" subtitle={d.bucket.length ? `${done} di ${d.bucket.length} realizzati` : undefined} />}
      items={d.loaded ? page.visible : []} keyExtractor={item => item.id} renderItem={renderRow}
      before={<View style={{ gap: s.lg }}><Button label="✨ Scegli per noi" variant="secondary" onPress={() => router.push('/scegli')} />
      <Card>
        <View style={{ gap: s.md }}>
          <Input label="Nuovo desiderio" placeholder="Es. Parigi, cena romantica..." value={title} onChangeText={setTitle} onSubmitEditing={add} returnKeyType="done" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
            {CATEGORIES.map((cat) => (
              <Chip key={cat.id} label={`${cat.emoji} ${cat.label}`} selected={category === cat.id} onPress={() => setCategory(cat.id)} />
            ))}
          </View>
          <Button label="Aggiungi alla lista" icon="plus" onPress={add} loading={adding} />
        </View>
      </Card>

      <SegmentedTabs tabs={[
        { key: 'pending', label: `Da realizzare (${d.bucket.length - done})` },
        { key: 'completed', label: `Realizzati (${done})` },
      ]} active={completion} onChange={setCompletion} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
        <Chip label="Tutti" selected={filter === 'all'} onPress={() => setFilter('all')} />
        {CATEGORIES.map((cat) => (
          <Chip key={cat.id} label={`${cat.emoji} ${cat.label}`} selected={filter === cat.id} onPress={() => setFilter(cat.id)} />
        ))}
      </View></View>}
      empty={!d.loaded ? <View style={{ gap: s.sm }}><Skeleton height={60} /><Skeleton height={60} /></View> : <Card><EmptyState icon="star" title={completion === 'completed' ? 'Nessun desiderio realizzato qui' : 'Nessun desiderio da realizzare qui'} hint={filter !== 'all' ? 'Prova un’altra categoria o seleziona «Tutti».' : completion === 'completed' ? 'Quando realizzi un desiderio, selezionalo per ritrovarlo in questa sezione.' : 'Aggiungi luoghi, cene ed esperienze da vivere insieme.'} /></Card>}
      after={d.loaded && page.hasMore ? <View style={{ gap: s.sm }}><T tone="muted">{page.count} di {page.total} desideri</T><Button label="Mostra altri desideri" variant="secondary" onPress={page.showMore} /></View> : null}
    />
      <BottomSheet
        visible={!!editItem}
        title="Modifica desiderio"
        onClose={() => setEditItem(null)}
        footer={
          <>
            <Button label="Salva modifiche" onPress={saveEdit} loading={busy} />
            <Button label="Elimina desiderio" icon="trash" variant="danger" onPress={remove} disabled={busy} />
          </>
        }
      >
        <Input label="Desiderio" value={editTitle} onChangeText={setEditTitle} />
        <T tone="muted">Categoria</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
          {CATEGORIES.map((cat) => (
            <Chip key={cat.id} label={`${cat.emoji} ${cat.label}`} selected={editCategory === cat.id} onPress={() => setEditCategory(cat.id)} />
          ))}
        </View>
      </BottomSheet>
  </>)
});

BucketScreen.displayName = 'BucketScreen';
