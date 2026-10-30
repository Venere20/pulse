import { drafts, useDraftField } from '../drafts/useDraftField';
import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useAppDataFields } from '../../state/AppData';
import { MonthCalendar } from '../../components/MonthCalendar';
import { Button, Card, Chip, Input, T } from '../../ui/primitives';
import { FeatureFrame, useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { confirmAction } from '../../utils/confirm';
import { useProgressiveItems } from '../../hooks/useProgressiveItems';
import { ProposalWishPicker } from './ProposalWishPicker';
interface Proposal {
    id: string;
    title: string;
    place: string | null;
    note: string | null;
    status: string;
    visit_id: string | null;
    created_by: string;
    bucket_item_id?: string | null;
}
interface Option {
    id: string;
    proposal_id: string;
    start_date: string;
    end_date: string;
    proposed_by: string;
    withdrawn_at: string | null;
}
interface Vote {
    option_id: string;
    user_id: string;
    vote: 'yes' | 'maybe' | 'no';
}
const choices = [['yes', '✅ Va bene'], ['maybe', "🤔 Con riserva"], ['no', '❌ Non posso']] as const;
export function ProposalsScreen({ id, initialTitle = '', wish }: {
    id?: string;
    initialTitle?: string;
    wish?: string;
}) {

    const d = useAppDataFields(['bucket', 'partnerId', 'refresh', 'today', 'userId', 'visits']);
    const props = useFeatureRows<Proposal>('date_proposals');
    const options = useFeatureRows<Option>('date_options', undefined, 'start_date');
    const votes = useFeatureRows<Vote>('date_votes', undefined, '');
    const links = useFeatureRows<{ proposal_id: string; bucket_item_id: string }>('date_proposal_wishes', id ? { column: 'proposal_id', value: id } : undefined, '', Infinity, true);
    const { busy, run } = useFeatureAction();
    const [title, setTitle] = useDraftField(`proposal:${id ?? wish ?? 'new'}`, 'title', initialTitle.slice(0, 80));
    const [place, setPlace] = useDraftField(`proposal:${id ?? wish ?? 'new'}`, 'place', '');
    const [note, setNote] = useDraftField(`proposal:${id ?? wish ?? 'new'}`, 'note', '');
    const [editing, setEditing] = useDraftField(`proposal:${id ?? wish ?? 'new'}`, 'editing', !!wish);
    const [replace, setReplace] = useDraftField<string | null>(`proposal:${id ?? wish ?? 'new'}`, 'replace', null);
    const [wishIds, setWishIds] = useDraftField<string[]>(`proposal:${id ?? wish ?? 'new'}`, 'wishIds', wish ? [wish] : []);
    const [wishesEditing, setWishesEditing] = useDraftField(`proposal:${id ?? wish ?? 'new'}`, 'wishesEditing', false);
    const [ranges, setRanges] = useDraftField<{
        start_date: string;
        end_date: string;
    }[]>(`proposal:${id ?? wish ?? 'new'}`, 'ranges', []);
    const [range, setRange] = useDraftField<{
        start: string | null;
        end: string | null;
    }>(`proposal:${id ?? wish ?? 'new'}`, 'range', { start: null, end: null });
    const refresh = async () => { await Promise.all([props.refresh(), options.refresh(), votes.refresh(), links.refresh()]); };
    const proposal = props.rows.find(p => p.id === id);
    const linkedIds = [...new Set([...links.rows.filter(link => link.proposal_id === id).map(link => link.bucket_item_id), ...(proposal?.bucket_item_id ? [proposal.bucket_item_id] : [])])];
    const selectedWishes = (ids: string[]) => { setWishIds(ids); if (!id && !title.trim() && ids.length) setTitle(d.bucket.find(item => item.id === ids[0])?.title.slice(0, 80) ?? ''); };
    const wishNames = (p: Proposal) => [...new Set([...links.rows.filter(link => link.proposal_id === p.id).map(link => link.bucket_item_id), ...(p.bucket_item_id ? [p.bucket_item_id] : [])])].map(wid => d.bucket.find(item => item.id === wid)).filter(item => !!item);
    const page = useProgressiveItems(props.rows);
    const pick = (day: string) => setRange(r => !r.start || r.end || day < r.start ? { start: day, end: null } : { ...r, end: day });
    const addRange = () => { if (range.start) {
        setRanges(v => [...v, { start_date: range.start!, end_date: range.end ?? range.start! }]);
        setRange({ start: null, end: null });
    } };
    const submit = () => run(async () => {
        const dates = range.start ? [...ranges, { start_date: range.start, end_date: range.end ?? range.start }] : ranges;
        if (id) {
            if (!dates[0])
                throw new Error('Scegli le date');
            await featureRpc('change_date_option', { p_proposal: id, p_start: dates[0].start_date, p_end: dates[0].end_date, p_replace: replace });
        }
        else {
            const pid = await featureRpc<string>('create_date_proposal_with_wishes', { p_wishes: wishIds, p_title: title, p_place: place, p_note: note, p_options: dates });
            drafts.clearIfUnchanged(d.userId, `proposal:${id ?? wish ?? 'new'}`, { title, place, note, editing, replace, ranges, range, wishIds, wishesEditing });
            router.push(`/proposte/${pid}`);
        }
        setEditing(false);
        setRanges([]);
        setRange({ start: null, end: null });
        setReplace(null);
    }, refresh);
    const remove = (p: Proposal) => run(async () => {
        if (!await confirmAction('Elimina proposta', `Vuoi eliminare «${p.title}» per entrambi? Verranno eliminate anche le opzioni e le relative votazioni.${p.visit_id ? ' L’incontro già creato, i ricordi e le spese resteranno intatti.' : ''}`, 'Elimina proposta')) return;
        await featureRpc('delete_date_proposal', { p_proposal: p.id });
        if (p.id === id) {
            drafts.clearIfUnchanged(d.userId, `proposal:${id}`, { title, place, note, editing, replace, ranges, range, wishIds, wishesEditing });
            setEditing(false);
        }
        await refresh();
        if (p.id === id) router.replace('/proposte');
    });
    const renderRow = ({ item: p }: { item: Proposal }) => <Card key={p.id}><T v="title">{p.title}</T><T tone="muted">{p.status === 'open' ? 'Aperta' : p.status === 'confirmed' ? 'Confermata' : p.status === 'expired' ? 'Scaduta' : 'Annullata'}</T>{wishNames(p).map(item => <T key={item.id} tone="primary">★ {item.title}</T>)}<Button variant="ghost" label="Apri" onPress={() => router.push(`/proposte/${p.id}`)}/><Button variant="danger" label="Elimina proposta" disabled={busy} onPress={() => remove(p)}/></Card>;
  return <FeatureFrame title={id ? 'Proposta di date' : 'Proposte di date'} error={props.error ?? options.error ?? votes.error ?? links.error} loading={props.loading} onRefresh={refresh}
    list={id ? undefined : { label: "Elenco proposte", items: page.visible, keyExtractor: p => p.id, renderItem: renderRow, empty: null, after: page.hasMore ? <><T tone="muted">{page.count} di {page.total} proposte</T><Button label="Mostra altre proposte" variant="secondary" onPress={page.showMore} /></> : null }}>
  {!id && <><Button label="Proponi le date" onPress={() => setEditing(v => !v)}/></>}
  {id && !proposal && !props.loading && <T>Proposta non trovata.</T>}
  {proposal && <><Card><T v="h2">{proposal.title}</T><T>{proposal.place}</T><T>{proposal.note}</T></Card>
   <Card><T v="title">Desideri inclusi</T>{wishNames(proposal).length ? wishNames(proposal).map(item => <T key={item.id}>★ {item.title}{item.is_completed ? ' · Già realizzato' : ''}</T>) : <T tone="muted">Nessun desiderio collegato.</T>}
    {proposal.status === 'open' && <Button label={wishesEditing ? 'Chiudi selezione desideri' : 'Aggiungi o modifica desideri'} variant="secondary" disabled={busy || links.loading} onPress={() => { if (!wishesEditing) setWishIds(linkedIds); setWishesEditing(!wishesEditing); }} />}
    {proposal.status === 'open' && wishesEditing && <><ProposalWishPicker items={d.bucket} selected={wishIds} onChange={setWishIds} busy={busy} /><Button label="Salva desideri nella proposta" loading={busy} onPress={() => run(async () => { await featureRpc('set_proposal_wishes', { p_proposal: proposal.id, p_wishes: wishIds }); setWishesEditing(false); }, refresh)} /></>}
   </Card>
   {options.rows.filter(o => o.proposal_id === id && !o.withdrawn_at).map(o => {
                const ov = votes.rows.filter(v => v.option_id === o.id);
                const own = ov.find(v => v.user_id === d.userId);
                const partner = ov.find(v => v.user_id === d.partnerId);
                const expired = o.start_date < d.today;
                const open = proposal.status === 'open' && !expired;
                const overlap = d.visits.some(v => v.start_date <= o.end_date && v.end_date >= o.start_date);
                return <Card key={o.id}><T v="title">{o.start_date} → {o.end_date}</T>{overlap && <T tone="muted">Si sovrappone a un incontro esistente.</T>}
    <T tone="muted">Partner: {choices.find(c => c[0] === partner?.vote)?.[1] ?? 'In attesa'}</T>
    {open ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{choices.map(([vote, label]) => <Chip key={vote} label={label} selected={own?.vote === vote} onPress={() => { if (!busy)
                    void run(() => featureRpc('vote_date_option', { p_option: o.id, p_vote: vote }), refresh); }}/>)}</View> : <T tone="muted">{expired ? 'Date passate' : proposal.status}</T>}
    {open && own && partner && own.vote !== 'no' && partner.vote !== 'no' && <Button label="Conferma incontro" disabled={busy} onPress={() => run(async () => {
                            if (own.vote === 'maybe' && partner.vote === 'maybe' && !await confirmAction("Avete entrambi espresso una riserva", "Vuoi confermare comunque queste date?"))
                                return;
                            const vid = await featureRpc<string>('confirm_date_option', { p_option: o.id });
                            await d.refresh();
                            router.push(`/visit/${vid}`);
                        }, refresh)}/>}
    {open && o.proposed_by === d.userId && <Button variant="ghost" label="Sostituisci opzione" onPress={() => { setReplace(o.id); setEditing(true); }}/>}</Card>;
            })}
   {proposal.visit_id && <Button label="Apri incontro" onPress={() => router.push(`/visit/${proposal.visit_id}`)}/>}
   <Button variant="danger" label="Elimina proposta" disabled={busy} onPress={() => remove(proposal)} />
   {proposal.status === 'open' && <><Button variant="secondary" label="Proponi altre date" onPress={() => { setReplace(null); setEditing(true); }}/><Button variant="danger" label="Annulla proposta" disabled={busy} onPress={() => run(async () => { if (await confirmAction('Annulla proposta', 'Vuoi annullare questa proposta?'))
            await featureRpc('cancel_date_proposal', { p_proposal: id }); }, refresh)}/></>}
  </>}
  {editing && <Card>{!id && <><Input label="Titolo" value={title} onChangeText={setTitle} maxLength={80}/><Input label="Luogo" value={place} onChangeText={setPlace} maxLength={80}/><Input label="Nota" value={note} onChangeText={setNote} maxLength={500} multiline/><ProposalWishPicker items={d.bucket} selected={wishIds} onChange={selectedWishes} busy={busy} /></>}
   <MonthCalendar visits={d.visits} range={range} onPickDay={pick}/>
   {ranges.map((r, i) => <Chip key={i} label={`${r.start_date} → ${r.end_date} ×`} onPress={() => setRanges(v => v.filter((_, j) => j !== i))}/>)}
   {!id && ranges.length < 3 && <Button variant="ghost" disabled={!range.start} label="Aggiungi un altro intervallo" onPress={addRange}/>}
   <Button label={id ? 'Salva opzione' : 'Invia proposta'} loading={busy} disabled={(!id && !title.trim()) || (!range.start && !ranges.length)} onPress={submit}/>
  </Card>}
 </FeatureFrame>;
}
