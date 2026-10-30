import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { BucketItem, CATEGORIES } from '../../types/bucket';
import { Button, Input, T } from '../../ui/primitives';
import { useTheme } from '../../theme/ThemeProvider';
import { useProgressiveItems } from '../../hooks/useProgressiveItems';

export function ProposalWishPicker({ items, selected, onChange, busy }: { items: BucketItem[]; selected: string[]; onChange: (ids: string[]) => void; busy: boolean }) {
  const { c, s } = useTheme(); const [search, setSearch] = useState('');
  const available = items.filter(item => (!item.is_completed || selected.includes(item.id)) && item.title.toLocaleLowerCase('it').includes(search.trim().toLocaleLowerCase('it')));
  const page = useProgressiveItems(available, search);
  const missing = selected.filter(id => !items.some(item => item.id === id));
  return <View style={{ gap: s.sm }}>
    <T v="title">Desideri da fare insieme</T><T tone="muted">Scegli le attività o i luoghi da includere. Quando confermate le date, saranno collegati all’incontro.</T>
    <Input label="Cerca nei desideri" placeholder="Un’attività, un ristorante, un luogo…" value={search} onChangeText={setSearch} editable={!busy} />
    <T>{selected.length}/20 desideri selezionati</T>
    {page.visible.map(item => { const checked = selected.includes(item.id); const disabled = busy || !checked && (selected.length >= 20 || item.is_completed); return <TouchableOpacity key={item.id} accessibilityRole="checkbox" accessibilityLabel={item.title} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => onChange(checked ? selected.filter(id => id !== item.id) : [...selected, item.id])} style={{ minHeight: 48, padding: s.sm, borderRadius: 12, borderWidth: 1, borderColor: checked ? c.primary : c.border, backgroundColor: checked ? c.primarySoft : c.surfaceAlt, flexDirection: 'row', alignItems: 'center', gap: s.sm }}><T bold tone="primary">{checked ? '✓' : '+'}</T><T style={{ flex: 1 }}>{CATEGORIES.find(category => category.id === item.category)?.emoji} {item.title}{item.is_completed ? ' · Già realizzato' : ''}</T></TouchableOpacity>; })}
    {!page.total && <T tone="muted">{search ? 'Nessun desiderio corrisponde alla ricerca.' : 'Non ci sono desideri da organizzare. Puoi aggiungerli nella sezione Desideri.'}</T>}
    {page.hasMore && <Button label="Mostra altri desideri" variant="ghost" onPress={page.showMore} />}
    {missing.length > 0 && <><T tone="danger">Alcuni desideri della bozza non sono più disponibili.</T><Button label="Rimuovi desideri non disponibili" variant="ghost" disabled={busy} onPress={() => onChange(selected.filter(id => !missing.includes(id)))} /></>}
  </View>;
}
