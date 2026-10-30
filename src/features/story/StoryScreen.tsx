import { DateField } from '../../ui/DateField';
import { useDraftField } from '../drafts/useDraftField';
import React, { useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useAppDataFields, isConcluded } from '../../state/AppData';
import { Button, Card, Input, T } from '../../ui/primitives';
import { formatDateIt } from '../../utils/dates';
import { confirmAction } from '../../utils/confirm';
import { FeatureFrame, useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { useProgressiveItems } from '../../hooks/useProgressiveItems';
import { useToast } from '../../ui/Toast';
import { STORY_PHOTO_LIMIT, uploadStoryPhoto, removeStoryPhotos } from './photos';
import { StoryPhoto } from './StoryPhoto';
import { StoredPhotoEditor } from '../../components/StoredPhoto';
import { PhotoLayouts } from '../memories/photoLayout';
import { actualVisitDates } from '../../utils/visitLifecycle';
export interface StoryMoment { id: string; author_id: string; title: string; day: string; body: string; photo_paths?: string[]; photo_settings?: PhotoLayouts }
export function StoryScreen() {

  const d = useAppDataFields(['loadError', 'loaded', 'names', 'refresh', 'today', 'userId', 'visits']); const data = useFeatureRows<StoryMoment>('story_moments'); const { busy, run } = useFeatureAction();
  const [editing, setEditing] = useDraftField("story", 'editing', false); const [id, setId] = useDraftField<string | null>("story", 'id', null); const [title, setTitle] = useDraftField("story", 'title', ''); const [day, setDay] = useDraftField("story", 'day', d.today); const [body, setBody] = useDraftField("story", 'body', '');
  const [photos, setPhotos] = useDraftField<string[]>('story', 'photos', []);
  const [picking, setPicking] = useState(false);
  const [photoSettings, setPhotoSettings] = useDraftField<PhotoLayouts>('story', 'photoSettings', {});
  const [photoQueue, setPhotoQueue] = useState<string[]>([]);
  const selecting = useRef(false);
  const toast = useToast();
  const savedPhotos = data.rows.find(r => r.id === id)?.photo_paths ?? [];
  const locked = busy || picking;
  const start = (r?: StoryMoment) => { setId(r?.id ?? null); setTitle(r?.title ?? ''); setDay(r?.day ?? d.today); setBody(r?.body ?? ''); setPhotos(r?.photo_paths ?? []); setPhotoSettings(r?.photo_settings ?? {}); setPhotoQueue([]); setEditing(true); };
  const save = () => run(async () => {
    await featureRpc('save_story_moment_v3', { p_id: id, p_title: title, p_day: day, p_body: body, p_photo_paths: photos, p_photo_settings: photoSettings });
    setEditing(false);
    // A failed cleanup never changes a successfully saved moment.
    await removeStoryPhotos(savedPhotos.filter(p => !photos.includes(p))).catch(() => {});
  }, data.refresh);
  const cancel = () => run(async () => {
    await removeStoryPhotos(photos.filter(p => !savedPhotos.includes(p)));
    setPhotos(savedPhotos); setPhotoQueue([]); setEditing(false);
  });
  const remove = (mid: string) => run(async () => {
    if (!await confirmAction('Elimina momento', 'Vuoi rimuovere questo momento dalla vostra storia?', 'Elimina')) return;
    const paths = data.rows.find(r => r.id === mid)?.photo_paths ?? [];
    await featureRpc('delete_story_moment', { p_id: mid });
    await removeStoryPhotos(paths).catch(() => {});
  }, data.refresh);
  const pick = async (camera: boolean) => {
    if (selecting.current || busy || photos.length >= STORY_PHOTO_LIMIT) return;
    selecting.current = true; setPicking(true);
    const uploaded: string[] = [];
    try {
      if (camera && Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Consenti l’accesso alla fotocamera per scattare una foto.');
      }
      // On web invoke the picker directly from the tap, retaining user activation.
      const remaining = STORY_PHOTO_LIMIT - photos.length;
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: remaining > 1, selectionLimit: remaining, quality: 0.8 });
      if (result.canceled) return;
      for (const asset of result.assets.slice(0, remaining)) uploaded.push(await uploadStoryPhoto(d.userId, asset));
      setPhotos(prev => [...prev, ...uploaded]);
      setPhotoQueue(uploaded);
    } catch (error) {
      await removeStoryPhotos(uploaded).catch(() => {});
      toast.error(error instanceof Error ? error.message : 'Impossibile aggiungere la foto.');
    } finally { selecting.current = false; setPicking(false); }
  };
  const timeline = useMemo(() => [
    ...data.rows.map(r => ({ key: `story:${r.id}`, title: r.title, day: r.day, body: r.body, moment: r, visit: null as string | null })),
    ...d.visits.filter(v => isConcluded(v, d.today)).map(actualVisitDates).map(v => ({ key: `visit:${v.id}`, title: v.title, day: v.start_date, body: v.memory_notes ?? '', moment: null as StoryMoment | null, visit: v.id })),
  ].sort((a, b) => b.day.localeCompare(a.day) || a.key.localeCompare(b.key)), [data.rows, d.visits, d.today]);
  const page = useProgressiveItems(timeline);
  return <FeatureFrame title="La nostra storia" error={data.error ?? d.loadError} loading={data.loading || !d.loaded} onRefresh={() => { void data.refresh(); void d.refresh(); }}
    list={{
      label: 'Timeline della nostra storia', items: page.visible, keyExtractor: r => r.key,
      renderItem: ({ item: r }) => <Card><View style={{ gap: 8 }}><T v="caption" tone="primary">{formatDateIt(r.day)}</T><T v="title">{r.title}</T>{!!r.body && <T>{r.body}</T>}{r.moment?.photo_paths?.map(path => <StoryPhoto key={path} path={path} layout={r.moment?.photo_settings?.[path]} />)}{r.visit ? <Button variant="secondary" label="Apri i ricordi dell’incontro" onPress={() => router.push(`/visit/${r.visit}`)} /> : r.moment?.author_id === d.userId ? <><Button label="Modifica momento" variant="secondary" disabled={locked || editing} onPress={() => start(r.moment!)} /><Button label="Elimina momento" variant="ghost" disabled={locked || editing} onPress={() => remove(r.moment!.id)} /></> : <T tone="muted">Aggiunto da {d.names[r.moment!.author_id]}</T>}</View></Card>,
      empty: <Card><T tone="muted">La vostra storia aspetta il primo momento.</T></Card>,
      after: page.hasMore ? <><T tone="muted">{page.count} di {page.total} momenti</T><Button label="Mostra altri momenti" variant="secondary" onPress={page.showMore} /></> : null,
    }}>
    <Card><View style={{ gap: 12 }}><T v="title">Ogni inizio merita un posto</T><T tone="muted">Primo messaggio, primo abbraccio, un momento buffo. Gli incontri passati compaiono automaticamente.</T><Button label="Aggiungi un momento" disabled={locked || editing} onPress={() => start()} /></View></Card>
    {editing && <Card accent><View style={{ gap: 12 }}><Input label="Titolo del momento" value={title} onChangeText={setTitle} maxLength={80} /><DateField label="Data del momento" value={day} onChange={setDay} maxDate={d.today} disabled={locked} /><Input label="Il ricordo" value={body} onChangeText={setBody} maxLength={600} multiline /><T tone="muted">Foto del momento · {photos.length}/{STORY_PHOTO_LIMIT}</T>{photos.map((path, index) => <View key={path} style={{ gap: 4 }}><StoryPhoto path={path} layout={photoSettings[path]} /><Button label={`Inquadra foto ${index + 1}`} variant="secondary" disabled={locked} onPress={() => setPhotoQueue([path])} /><Button label={`Rimuovi foto ${index + 1}`} variant="ghost" disabled={locked} onPress={() => run(async () => { if (!savedPhotos.includes(path)) await removeStoryPhotos([path]); setPhotos(prev => prev.filter(p => p !== path)); })} /></View>)}<View style={{ gap: 8 }}><Button label="Galleria" icon="image" variant="secondary" disabled={locked || photos.length >= STORY_PHOTO_LIMIT} onPress={() => void pick(false)} /><Button label="Scatta foto" icon="camera" variant="secondary" disabled={locked || photos.length >= STORY_PHOTO_LIMIT} onPress={() => void pick(true)} /></View>{picking && <T tone="muted">Preparazione delle foto…</T>}<Button label={id ? 'Salva le modifiche' : 'Conserva il momento'} loading={busy} disabled={locked || !title.trim()} onPress={save} /><Button label="Annulla modifiche" disabled={locked} variant="ghost" onPress={cancel} /></View></Card>}
    {editing && photoQueue[0] && <StoredPhotoEditor key={photoQueue[0]} bucket="story-photos" path={photoQueue[0]} layout={photoSettings[photoQueue[0]]}
      saveHint="Conferma la foto, poi salva il momento per condividere le modifiche con il partner."
      onClose={() => setPhotoQueue([])} onConfirm={layout => { setPhotoSettings(previous => ({ ...previous, [photoQueue[0]]: layout })); setPhotoQueue(previous => previous.slice(1)); }} />}
  </FeatureFrame>;
}
