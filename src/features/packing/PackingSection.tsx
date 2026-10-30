import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAppDataFields } from '../../state/AppData';
import { Visit } from '../../types/travel';
import { fetchTripWeather, TripWeather } from '../../utils/weather';
import { Button, Card, Chip, Input, T, ProgressBar } from '../../ui/primitives';
import { useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { packingCategories, packingSuggestions } from './rules';
import { packingCategory, packingGroups } from './categories';
interface Item {
    id: string;
    list_id: string;
    label: string;
    quantity: number;
    category: string;
    source_key: string | null;
    checked: boolean;
    dismissed: boolean;
}
export function PackingSection({ visit }: {
    visit: Visit;
}) {
    const d = useAppDataFields(['bucket', 'partnerId', 'visitBucket']);
    const { busy, run } = useFeatureAction();
    const [list, setList] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [label, setLabel] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [category, setCategory] = useState('other');
    const [climate, setClimate] = useState<'cold' | 'mild' | 'hot'>('mild');
    const [weather, setWeather] = useState<TripWeather | null>(null);
    const items = useFeatureRows<Item>('packing_items', { column: 'list_id', value: list ?? '00000000-0000-0000-0000-000000000000' }, 'created_at', Infinity, true, !!list);
    const progress = useFeatureRows<{
        visit_id: string;
        owner_id: string;
        total: number;
        checked: number;
    }>('packing_progress', { column: 'visit_id', value: visit.id }, 'updated_at');
    const defaults = useFeatureRows<{
        id: string;
        label: string;
        quantity: number;
        category: string;
    }>('packing_defaults');
    const [edit, setEdit] = useState<string | null>(null);
    const [filter, setFilter] = useState('all');
    const [autoGroup, setAutoGroup] = useState(true);
    useEffect(() => { let alive = true; featureRpc<string>('open_packing_list', { p_visit: visit.id }).then(l => { if (alive)
        setList(l); }).catch(e => { if (alive)
        setError(e.message); }); return () => { alive = false; }; }, [visit.id]);
    useEffect(() => { let alive = true; void fetchTripWeather(visit.meeting_point || visit.location || '', visit.start_date, visit.end_date).then(w => { if (alive)
        setWeather(w.ok ? w : null); }); return () => { alive = false; }; }, [visit.meeting_point, visit.location, visit.start_date, visit.end_date]);
    const own = items.rows.filter(i => i.list_id === list && !i.dismissed);
    const checked = own.filter(i => i.checked).length;
    const partner = progress.rows.find(p => p.visit_id === visit.id && p.owner_id === d.partnerId);
    const wishes = d.bucket.filter(b => d.visitBucket.some(l => l.visit_id === visit.id && l.bucket_item_id === b.id)).map(b => b.title);
    const suggestions = packingSuggestions(visit, weather, climate, wishes).filter(s => !items.rows.some(i => i.list_id === list && i.source_key === s.source_key));
    const refresh = async () => { await Promise.all([items.refresh(), progress.refresh()]); };
    const groups = packingGroups(own, autoGroup);
    const action = (action: string, item?: string, data?: object) => run(() => featureRpc('packing_item_action', { p_list: list, p_action: action, p_item: item ?? null, p_data: data ?? {} }), refresh);
    return <><Card><T v="title">La tua valigia è privata</T><T>{checked} / {own.length} oggetti preparati</T><ProgressBar value={own.length ? checked / own.length : 0}/><T tone="muted">Partner: {partner ? `${partner.checked} / ${partner.total} preparati` : 'valigia non ancora preparata'}</T></Card>
  {(error || items.error || progress.error) && <Card><T tone="danger">{error ?? items.error ?? progress.error}</T><Button label="Riprova" onPress={() => run(async () => { setList(await featureRpc<string>('open_packing_list', { p_visit: visit.id })); setError(null); }, refresh)}/></Card>}
  <Card><Input label={edit ? 'Modifica oggetto' : 'Aggiungi un oggetto'} value={label} onChangeText={setLabel} maxLength={60}/><Input label="Quantità" value={quantity} onChangeText={setQuantity} keyboardType="number-pad"/>
   <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{Object.entries(packingCategories).map(([id, name]) => <Chip key={id} label={name} selected={category === id} onPress={() => setCategory(id)}/>)}</View>
   <Button label={edit ? 'Salva' : 'Aggiungi'} disabled={!list || !label.trim()} loading={busy} onPress={() => run(async () => { const q = Number(quantity); if (!Number.isInteger(q) || q < 1 || q > 99)
        throw new Error('Quantità da 1 a 99'); await featureRpc('packing_item_action', { p_list: list, p_action: edit ? 'edit' : 'add', p_item: edit, p_data: { label, quantity: q, category } }); setLabel(''); setEdit(null); }, refresh)}/>
   <Button variant="ghost" label="Salva tra le cose che porto sempre" disabled={!label.trim() || busy} onPress={() => run(() => featureRpc('packing_default_action', { p_action: 'add', p_data: { label, quantity: Number(quantity), category } }), defaults.refresh)}/>
  </Card>
  <Card><View style={{ gap: 10 }}><T v="title">Oggetti per categoria</T><Chip label="Raggruppa gli oggetti non classificati" selected={autoGroup} onPress={() => setAutoGroup(value => !value)} /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Chip label={`Tutti (${own.length})`} selected={filter === 'all'} onPress={() => setFilter('all')} />{groups.map(g => <Chip key={g.id} label={`${g.title} (${g.items.length})`} selected={filter === g.id} onPress={() => setFilter(g.id)} />)}</View><T tone="muted">Puoi modificare la categoria di ogni oggetto. Quantità e spunte restano conservate.</T></View></Card>
  {groups.filter(g => filter === 'all' || filter === g.id).map(g => g.items.length ? <Card key={g.id}><T v="title">{g.title} · {g.checked}/{g.items.length} preparati</T>{g.items.map(i => <View key={i.id} style={{ gap: 6, marginTop: 10 }}><Chip label={`${i.checked ? '✅' : '⬜'} ${i.label} × ${i.quantity}`} selected={i.checked} onPress={busy ? undefined : () => action('check', i.id, { checked: !i.checked })}/><View style={{ flexDirection: 'row', gap: 8 }}><Button small variant="ghost" label="Modifica" onPress={() => { setEdit(i.id); setLabel(i.label); setQuantity(String(i.quantity)); setCategory(packingCategory(i.label,i.category,autoGroup)); }}/><Button small variant="ghost" label="Rimuovi" disabled={busy} onPress={() => action('remove', i.id)}/></View></View>)}</Card> : filter !== 'all' ? <Card key={g.id}><T tone="muted">Nessun oggetto in {g.title.toLocaleLowerCase('it-IT')}.</T></Card> : null)}
  <Card><T v="title">Suggerimenti da valutare</T><T tone="muted">{weather ? `Meteo: ${weather.avgTemp}°C, pioggia ${weather.rainChance}%` : 'Previsioni non disponibili. Scegli il clima previsto.'}</T>
   {!weather && <View style={{ flexDirection: 'row', gap: 8 }}>{([['cold', 'Freddo'], ['mild', 'Mite'], ['hot', 'Caldo']] as const).map(([id, title]) => <Chip key={id} label={title} selected={climate === id} onPress={() => setClimate(id)}/>)}</View>}
   {suggestions.map(s => <View key={s.source_key} style={{ marginTop: 12, gap: 4 }}><T>{s.label} × {s.quantity}</T><View style={{ flexDirection: 'row', gap: 8 }}><Button small label="Aggiungi" disabled={!list || busy} onPress={() => action('add', undefined, s)}/><Button small variant="ghost" label="Ignora" disabled={!list || busy} onPress={() => action('dismiss', undefined, s)}/></View></View>)}
  </Card>
  {!!defaults.rows.length && <Card><T v="title">Le cose che porti sempre</T><T tone="muted">Aggiunte automaticamente alle nuove valigie.</T>{defaults.rows.map(i => <View key={i.id}><T>{i.label} × {i.quantity}</T><Button small variant="ghost" label="Rimuovi dagli oggetti abituali" disabled={busy} onPress={() => run(() => featureRpc('packing_default_action', { p_action: 'remove', p_id: i.id }), defaults.refresh)}/></View>)}</Card>}
 </>;
}
