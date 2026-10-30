import { useDraftField } from '../drafts/useDraftField';
import React, { useEffect, useMemo, useState } from 'react';
import { Switch, View, useWindowDimensions } from 'react-native';
import { useAppDataFields } from '../../state/AppData';
import { supabase } from '../../config/supabase';
import { Button, Card, Chip, Input, T } from '../../ui/primitives';
import { FeatureFrame, useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { confirmAction } from '../../utils/confirm';
import { useProgressiveItems } from '../../hooks/useProgressiveItems';
import { useTheme } from '../../theme/ThemeProvider';
interface Note {
    id: string;
    body: string;
    kind: 'note' | 'task';
    color: string;
    tilt: number;
    created_by: string;
    pinned: boolean;
    done_at: string | null;
    removed_at: string | null;
    created_at: string;
}
const colors = { yellow: '#FFF3B0', pink: '#FFD6E5', blue: '#D5EAFF', green: '#DDF5D3', purple: '#E9DBFF', peach: '#FFE1CD' };
export function FridgeScreen() {

    const { width } = useWindowDimensions();
    const { s } = useTheme();
    const d = useAppDataFields(['names', 'userId']);
    const data = useFeatureRows<Note>('fridge_notes');
    const reactions = useFeatureRows<{
        note_id: string;
        user_id: string;
        reaction: string;
    }>('fridge_reactions', undefined, '');
    const { busy, run } = useFeatureAction();
    const [body, setBody] = useDraftField("fridge", 'body', '');
    const [kind, setKind] = useDraftField<'note' | 'task'>("fridge", 'kind', 'note');
    const [color, setColor] = useDraftField("fridge", 'color', 'yellow');
    const [silent, setSilent] = useDraftField("fridge", 'silent', false);
    const [filter, setFilter] = useState('active');
    const [edit, setEdit] = useDraftField<string | null>("fridge", 'edit', null);
    useEffect(() => { if (!data.loading && !data.error)
        void supabase.from('fridge_reads').upsert({ user_id: d.userId, seen_at: new Date().toISOString() }); }, [d.userId, data.loading, data.error, data.rows]);
    const refresh = async () => { await Promise.all([data.refresh(), reactions.refresh()]); };
    const update = (id: string, action: string, value?: string) => run(() => featureRpc('update_fridge_note', { p_id: id, p_action: action, p_value: value ?? null }), refresh);
    const visible = useMemo(() => data.rows.filter(n => filter === 'removed' ? !!n.removed_at : !n.removed_at && (filter === 'done' ? !!n.done_at : !n.done_at)).sort((a, b) => Number(b.pinned) - Number(a.pinned)), [data.rows, filter]);
    const page = useProgressiveItems(visible, filter);
    const renderNote = ({ item: n }: { item: Note }) => <Card style={{ flex: 1, backgroundColor: colors[n.color as keyof typeof colors], transform: [{ rotate: `${n.tilt}deg` }] }}>
   <T style={{ color: '#282431' }} v="title">{n.pinned ? '📌 ' : ''}{n.body}</T><T style={{ color: '#554A62' }}>{d.names[n.created_by] ?? 'Partner'}</T><T style={{ color: '#554A62' }}>{reactions.rows.filter(r => r.note_id === n.id).map(r => ({ heart: '❤️', smile: '😊', laugh: '😂' }[r.reaction])).join(' ')}</T>
   {n.removed_at ? <Button small label="Ripristina" disabled={busy} onPress={() => update(n.id, 'restore')}/> : <>
    {n.kind === 'task' && <Button small label={n.done_at ? 'Riapri' : 'Fatto!'} disabled={busy} onPress={() => update(n.id, 'done', n.done_at ? 'false' : 'true')}/>}
    <Button small variant="ghost" label={n.pinned ? "Togli dall’evidenza" : "Metti in evidenza"} disabled={busy} onPress={() => update(n.id, 'pin', String(!n.pinned))}/>
    {n.created_by === d.userId ? <Button small variant="ghost" label="Modifica" onPress={() => { setEdit(n.id); setBody(n.body); }}/> : <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>{[['heart', '❤️'], ['smile', '😊'], ['laugh', '😂']].map(([reaction, label]) => <Chip key={reaction} label={label} selected={reactions.rows.some(r => r.note_id === n.id && r.user_id === d.userId && r.reaction === reaction)} onPress={() => update(n.id, 'react', reaction)}/>)}</View>}
    <Button small variant="ghost" label="Rimuovi" disabled={busy} onPress={() => run(async () => { if (await confirmAction('Rimuovi post-it', 'Puoi recuperarlo dal cestino per 7 giorni.', 'Rimuovi'))
                await featureRpc('update_fridge_note', { p_id: n.id, p_action: 'remove' }); }, refresh)}/>
   </>}
  </Card>;
    return <FeatureFrame title="Il nostro frigo" error={data.error ?? reactions.error} loading={data.loading} onRefresh={refresh}
      list={{ label: "Post-it del nostro frigo", items: page.visible, keyExtractor: n => n.id, renderItem: renderNote, columns: Math.min(width, 720) - 2 * s.lg >= 280 + s.lg ? 2 : 1,
        empty: <T tone="muted">Nessun post-it in questa sezione.</T>,
        after: page.hasMore ? <><T tone="muted">{page.count} di {page.total} post-it</T><Button label="Mostra altri post-it" variant="secondary" onPress={page.showMore} /></> : null }}>
  <Card><Input label={edit ? 'Modifica il tuo post-it' : 'Un pensiero o una cosa da fare'} value={body} onChangeText={setBody} maxLength={160} multiline/>
   {!edit && <><View style={{ flexDirection: 'row', gap: 8 }}><Chip label="Nota" selected={kind === 'note'} onPress={() => setKind('note')}/><Chip label="Da fare" selected={kind === 'task'} onPress={() => setKind('task')}/></View><View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{Object.entries(colors).map(([id, c]) => <Chip key={id} label={id} color={c} selected={color === id} onPress={() => setColor(id)}/>)}</View><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Switch value={silent} onValueChange={setSilent} accessibilityLabel="Invia senza notifica"/><T>Pubblica senza notifica</T></View></>}
   <Button label={edit ? "Salva modifiche" : 'Attacca al frigo'} disabled={!body.trim()} loading={busy} onPress={() => run(async () => { if (edit)
        await featureRpc('update_fridge_note', { p_id: edit, p_action: 'edit', p_value: body });
    else
        await featureRpc('create_fridge_note', { p_body: body, p_kind: kind, p_color: color, p_silent: silent }); setBody(''); setEdit(null); }, refresh)}/>{edit && <Button variant="ghost" label="Annulla modifiche" onPress={() => { setEdit(null); setBody(''); }}/>}</Card>
  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{[['active', 'Attivi'], ['done', 'Completati'], ['removed', 'Cestino']].map(([id, label]) => <Chip key={id} label={label} selected={filter === id} onPress={() => setFilter(id)}/>)}</View>


 </FeatureFrame>;
}
