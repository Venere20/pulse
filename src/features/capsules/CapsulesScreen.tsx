import React, { useRef, useState } from 'react';
import { Switch, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../config/supabase';
import { preparePhoto } from '../../services/photoPreparation';
import { useAppDataFields } from '../../state/AppData';
import { confirmAction } from '../../utils/confirm';
import { romeMoment } from '../../utils/together';
import { Button, Card, Chip, Input, T } from '../../ui/primitives';
import { FeatureFrame, useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { useProgressiveItems } from '../../hooks/useProgressiveItems';
import { MomentFields } from '../shared/MomentFields';
import { StoredPhoto, StoredPhotoEditor } from '../../components/StoredPhoto';
import { PhotoLayout, PhotoLayouts } from '../memories/photoLayout';
import { useToast } from '../../ui/Toast';
interface Capsule {
    id: string;
    author_id: string;
    recipient_id: string;
    label: string | null;
    unlock_kind: string;
    unlock_at: string | null;
    visit_id: string | null;
    manual_hint: string | null;
    status: string;
    read_at: string | null;
    created_at: string;
}
interface Content {
    capsule_id: string;
    body: string | null;
    photo_paths: string[];
    photo_settings?: PhotoLayouts;
}
function PrivatePhoto({ path, layout }: { path: string; layout?: PhotoLayout }) {
    return <StoredPhoto bucket="capsules" path={path} layout={layout} label="Foto privata della capsula" />;
}
export function CapsulesScreen() {

    const d = useAppDataFields(['today', 'userId', 'visits']);
    const data = useFeatureRows<Capsule>('time_capsules');
    const { busy, run } = useFeatureAction();
    const toast = useToast();
    const [filter, setFilter] = useState('received');
    const [editing, setEditing] = useState(false);
    const [step, setStep] = useState(0);
    const [id, setId] = useState<string | null>(null);
    const [label, setLabel] = useState('');
    const [body, setBody] = useState('');
    const [paths, setPaths] = useState<string[]>([]);
    const [photoSettings, setPhotoSettings] = useState<PhotoLayouts>({});
    const [photoEditing, setPhotoEditing] = useState<string | null>(null);
    const selecting = useRef(false);
    const [picking, setPicking] = useState(false);
    const locked = busy || picking;
    const [kind, setKind] = useState('date');
    const [date, setDate] = useState('');
    const [visit, setVisit] = useState<string | null>(null);
    const [hint, setHint] = useState('');
    const [notify, setNotify] = useState(false);
    const [opened, setOpened] = useState<Content | null>(null);
    const uploaded = useRef<string[]>([]);
    const closeEditor = () => run(async () => {
        if (id && uploaded.current.length) await featureRpc('abandon_capsule_photos', { p_id: id, p_paths: uploaded.current });
        uploaded.current = []; setPhotoEditing(null); setEditing(false);
    }, data.refresh);
    const removePhoto = (path: string) => run(async () => {
        if (id && uploaded.current.includes(path)) {
            await featureRpc('abandon_capsule_photos', { p_id: id, p_paths: [path] });
            uploaded.current = uploaded.current.filter(value => value !== path);
        }
        setPaths(previous => previous.filter(value => value !== path));
    });
    const startNew = () => { setId(null); setLabel(''); setBody(''); setPaths([]); setPhotoSettings({}); setPhotoEditing(null); setKind('date'); setDate(''); setVisit(null); setHint(''); setNotify(false); setEditing(true); setStep(0); };
    const fetchContent = async (cid: string) => { const r = await supabase.from('capsule_contents').select('*').eq('capsule_id', cid).single(); if (r.error)
        throw new Error(r.error.message); return r.data as Content; };
    const edit = (c: Capsule) => run(async () => {
        const content = await fetchContent(c.id);
        setId(c.id);
        setLabel(c.label ?? '');
        setBody(content.body ?? '');
        setPaths(content.photo_paths);
        setPhotoSettings(content.photo_settings ?? {});
        setPhotoEditing(null);
        setKind(c.unlock_kind);
        setDate(c.unlock_at ? new Date(c.unlock_at).toLocaleString('sv-SE', { timeZone: 'Europe/Rome' }).slice(0, 16) : '');
        setVisit(c.visit_id);
        setHint(c.manual_hint ?? '');
        setEditing(true);
        setStep(0);
        uploaded.current = [];
    });
    const pick = async () => {
        if (selecting.current || busy || paths.length >= 3) return;
        selecting.current = true; setPicking(true);
        try {
        // Call picker directly from the gesture on web; a preceding network await loses user activation.
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 0.8 });
        if (result.canceled)
            return;
        await run(async () => {
            const asset = result.assets[0];
            const { bytes, mime, extension: ext } = await preparePhoto(asset, 5 * 1024 * 1024);
            const cid = id ?? await featureRpc<string>('create_capsule_draft');
            setId(cid);
            const path = `${cid}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
            const next = [...paths, path];
            await featureRpc('reserve_capsule_photo', { p_id: cid, p_path: path });
            const upload = await supabase.storage.from('capsules').upload(path, bytes, { contentType: mime, upsert: false });
            if (upload.error) {
                await featureRpc('abandon_capsule_photos', { p_id: cid, p_paths: [path] });
                throw new Error(upload.error.message);
            }
            setPaths(next);
            uploaded.current.push(path);
            setPhotoEditing(path);
            await data.refresh();
        });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Impossibile aggiungere la foto.');
        } finally { selecting.current = false; setPicking(false); }
    };
    const seal = () => run(async () => {
        let at: string | null = null;
        if (kind === 'date') {
            if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(date))
                throw new Error("Seleziona una data e un orario validi (ora italiana).");
            const instant = romeMoment(date.slice(0, 10), date.slice(11));
            if (!Number.isFinite(instant))
                throw new Error('Data non valida');
            at = new Date(instant).toISOString();
        }
        const cid = id ?? await featureRpc<string>('create_capsule_draft');
        setId(cid);
        await featureRpc('seal_capsule_v3', { p_id: cid, p_label: label, p_kind: kind, p_unlock_at: at, p_visit: visit, p_hint: hint, p_body: body, p_paths: paths, p_photo_settings: photoSettings, p_notify: notify });
        uploaded.current = [];
        setOpened(null);
        setEditing(false);
    }, data.refresh);
    const visible = data.rows.filter(c => filter === 'received' ? c.recipient_id === d.userId : c.author_id === d.userId);
    const page = useProgressiveItems(visible, filter);
    const renderRow = ({ item: c }: { item: Capsule }) => <Card key={c.id}><T v="title">{c.status === 'draft' ? '✏️' : c.status === 'open' ? '💌' : '🔒'} {c.label ?? 'Una sorpresa'}</T><T tone="muted">{c.status === 'draft' ? 'Bozza · scade dopo 24 ore' : c.unlock_kind === 'date' ? new Date(c.unlock_at!).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : c.unlock_kind === 'manual' ? c.manual_hint ?? 'Quando lo desideri' : c.unlock_kind === 'visit' ? 'Durante l’incontro scelto' : 'Al prossimo incontro'}</T>
   {c.author_id === d.userId ? <><Button variant="secondary" label="Leggi il contenuto" disabled={locked} onPress={() => run(async () => setOpened(await fetchContent(c.id)))}/>{c.status !== 'open' && <Button variant="ghost" label="Modifica" disabled={locked || editing} onPress={() => edit(c)}/>}<Button variant="ghost" label="Elimina" disabled={locked} onPress={() => run(async () => { if (await confirmAction('Elimina capsula', 'Il messaggio e le foto verranno eliminati.', 'Elimina')) {
            await featureRpc('delete_capsule', { p_id: c.id });
            setOpened(null);
        } }, data.refresh)}/></> : <Button label={c.read_at ? 'Rileggi' : c.unlock_kind === 'manual' ? 'Apri quando vuoi' : 'Apri capsula'} disabled={locked} onPress={() => run(async () => { if (c.unlock_kind === 'manual' && !c.read_at && !await confirmAction('Il momento giusto', 'Vuoi aprire ora questa capsula?', 'Apri'))
            return; await featureRpc('open_capsule', { p_id: c.id, p_unlock_manual: c.unlock_kind === 'manual' }); setOpened(await fetchContent(c.id)); }, data.refresh)}/>}
  </Card>;
  return <FeatureFrame title="Capsule del tempo" error={data.error} loading={data.loading} onRefresh={data.refresh}
    list={{ label: "Elenco capsule", items: page.visible, keyExtractor: c => c.id, renderItem: renderRow, empty: <T tone="muted">Nessuna capsula in questa sezione.</T>, after: page.hasMore ? <><T tone="muted">{page.count} di {page.total} capsule</T><Button label="Mostra altre capsule" variant="secondary" onPress={page.showMore} /></> : null }}>
  <Button label="Crea una capsula" disabled={locked || editing} onPress={startNew}/><View style={{ flexDirection: 'row', gap: 8 }}><Chip label="Per te" selected={filter === 'received'} onPress={() => setFilter('received')}/><Chip label="Le tue" selected={filter === 'sent'} onPress={() => setFilter('sent')}/></View>
  {editing && <Card><T v="title">{step === 0 ? '1 · Il contenuto' : step === 1 ? '2 · Quando si apre' : '3 · Rivedi e sigilla'}</T>
   {step === 0 ? <><Input label="Titolo facoltativo" value={label} onChangeText={setLabel} maxLength={40}/><Input label="Il tuo messaggio" value={body} onChangeText={setBody} maxLength={1000} multiline/><T tone="faint">{body.length}/1000</T>
    {paths.map((path, index) => <View key={path}><PrivatePhoto path={path} layout={photoSettings[path]}/><Button variant="secondary" label={`Inquadra foto ${index + 1}`} disabled={locked} onPress={() => setPhotoEditing(path)}/><Button variant="ghost" label="Rimuovi foto" disabled={locked} onPress={() => removePhoto(path)}/></View>)}
    <Button variant="secondary" label={`Aggiungi foto (${paths.length}/3)`} disabled={locked || paths.length >= 3} onPress={pick}/><Button label="Scegli l’apertura" disabled={locked || (!body.trim() && !paths.length)} onPress={() => setStep(1)}/>
   </> : step === 1 ? <><View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{[['date', 'Data e ora'], ['visit', 'Un incontro'], ['next_visit', 'Prossimo incontro'], ['manual', 'Un momento speciale']].map(([k, l]) => <Chip key={k} label={l} selected={kind === k} onPress={() => setKind(k)}/>)}</View>
    {kind === 'date' && <MomentFields day={date.slice(0, 10)} time={date.slice(11, 16)} onDay={day => setDate(`${day} ${date.slice(11, 16) || '09:00'}`)} onTime={time => setDate(`${date.slice(0, 10) || d.today} ${time}`)} />}
    {kind === 'visit' && <>{d.visits.filter(v => v.start_date >= d.today && v.status !== 'concluded').map(v => <Chip key={v.id} label={`${v.title} · ${v.start_date}`} selected={visit === v.id} onPress={() => setVisit(v.id)}/>)}</>}
    {kind === 'manual' && <><Input label="Il momento (es. Quando ti manca un abbraccio)" value={hint} onChangeText={setHint} maxLength={40}/><T tone="muted">Il partner sceglierà quando aprirla.</T></>}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Switch value={notify} onValueChange={setNotify} accessibilityLabel="Avvisa il partner della capsula"/><T>Avvisa il partner; altrimenti sarà una sorpresa.</T></View><Button label="Rivedi" onPress={() => setStep(2)}/><Button variant="ghost" label="Indietro" onPress={() => setStep(0)}/>
   </> : <>{paths.map(path => <PrivatePhoto key={path} path={path} layout={photoSettings[path]}/>)}<T v="title">{label || 'Una sorpresa'}</T><T>{body}</T><T tone="muted">{paths.length} foto · {kind === 'date' ? date : kind === 'manual' ? hint : kind === 'visit' ? d.visits.find(v => v.id === visit)?.title : 'Al prossimo incontro'}</T><Button label="Sigilla capsula" loading={busy} disabled={locked} onPress={seal}/><Button variant="ghost" label="Modifica" onPress={() => setStep(0)}/></>}
   <Button variant="ghost" label="Chiudi" disabled={locked} onPress={closeEditor}/>
  </Card>}
  {opened && <Card><T v="title">💌 Il messaggio</T><T>{opened.body}</T>{opened.photo_paths.map(p => <PrivatePhoto key={p} path={p} layout={opened.photo_settings?.[p]}/>)}<Button variant="ghost" label="Chiudi messaggio" onPress={() => setOpened(null)}/></Card>}


  {editing && photoEditing && <StoredPhotoEditor key={photoEditing} bucket="capsules" path={photoEditing} layout={photoSettings[photoEditing]}
    saveHint="Conferma la foto, poi sigilla la capsula per conservare le modifiche. Il partner le vedrà quando potrà aprirla."
    onClose={() => setPhotoEditing(null)} onConfirm={layout => { setPhotoSettings(previous => ({ ...previous, [photoEditing]: layout })); setPhotoEditing(null); }} />}
 </FeatureFrame>;
}
