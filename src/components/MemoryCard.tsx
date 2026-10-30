import { trackResult } from '../services/saveState';
import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../config/supabase';
import { Visit } from '../types/travel';
import { formatDateIt } from '../utils/dates';
import { MAX_MEMORY_PHOTOS, uploadMeetingPhoto, removeMeetingPhoto } from '../services/storage';
import { Button, Card, EmptyState, Input, T } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { MemoryPhotoFrame } from './MemoryPhotoFrame';
import { MemoryPhotoEditor } from './MemoryPhotoEditor';
import { PhotoLayouts } from '../features/memories/photoLayout';

/** Card del diario: foto a tutta larghezza, titolo, pensiero e desideri realizzati. */
export const MemoryCard: React.FC<{
  visit: Visit;
  doneWishes: string[];
  onOpen: () => void;
}> = ({ visit, doneWishes, onOpen }) => {
  const { c, r, s } = useTheme();
  const photos = visit.memory_photos || [];
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Apri ricordo ${visit.title}`} activeOpacity={0.9} onPress={onOpen}>
      <Card padded={false}>
        {photos.length > 0 ? (
          <MemoryPhotoFrame uri={photos[0]} preview layout={visit.memory_photo_settings?.[photos[0]]} style={{ width: '100%', backgroundColor: c.surfaceAlt }} />
        ) : (
          <View style={{ height: 120, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon name="camera" size={28} color={c.primary} />
            <T tone="primary" bold>Aggiungi foto e un pensiero</T>
          </View>
        )}
        <View style={{ padding: s.lg, gap: 4 }}>
          <T v="title">{visit.title}</T>
          <T tone="muted">
            {formatDateIt(visit.start_date)}
            {visit.end_date !== visit.start_date ? ` → ${formatDateIt(visit.end_date)}` : ''}
            {visit.meeting_point || visit.location ? ` · ${visit.meeting_point || visit.location}` : ''}
          </T>
          {visit.memory_notes ? <T style={{ marginTop: 6, fontStyle: 'italic' }} numberOfLines={3}>“{visit.memory_notes}”</T> : null}
          {doneWishes.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {doneWishes.map((w) => (
                <View key={w} style={{ flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: c.surfaceAlt, borderRadius: r.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Icon name="check" size={14} color={c.success} />
                  <T tone="muted">{w}</T>
                </View>
              ))}
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
};

/** Editor del ricordo (scheda "Ricordi" dell'incontro): nota e foto su Supabase Storage. */
export const MemoryEditor: React.FC<{ visit: Visit; doneWishes: string[]; onChanged: () => void }> = ({ visit, doneWishes, onChanged }) => {
  const { c, r, s } = useTheme();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [galleryWidth, setGalleryWidth] = useState(Math.min(width - 2 * s.lg, 560));
  const [photoIndex, setPhotoIndex] = useState(0);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const saved = visit.memory_photos || [];
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(visit.memory_notes || '');
  const [photos, setPhotos] = useState<string[]>(saved);
  const [layouts, setLayouts] = useState<PhotoLayouts>(visit.memory_photo_settings ?? {});
  const [photoQueue, setPhotoQueue] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(false);
  const selecting = useRef(false);
  useEffect(() => { const life = mounted; life.current = true; return () => { life.current = false; }; }, []);

  const start = () => {
    setNote(visit.memory_notes || '');
    setPhotos(saved);
    setLayouts(visit.memory_photo_settings ?? {});
    setEditing(true);
  };

  const cancel = async () => {
    await Promise.all(photos.filter((p) => !saved.includes(p)).map((p) => removeMeetingPhoto(p).catch(() => {})));
    setEditing(false);
  };

  const pick = async () => {
    if (selecting.current) return;
    const remaining = MAX_MEMORY_PHOTOS - photos.length;
    if (remaining <= 0) return toast.error(`Puoi caricare al massimo ${MAX_MEMORY_PHOTOS} foto`);
    selecting.current = true;
    const urls: string[] = [];
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: remaining > 1, selectionLimit: remaining, quality: 0.7 });
      if (res.canceled || !mounted.current) return;
      setUploading(true);
      for (const asset of res.assets.slice(0, remaining)) {
        urls.push(await uploadMeetingPhoto(visit.id, asset, () => mounted.current));
        if (!mounted.current) throw new Error('Caricamento annullato');
      }
      setPhotos((prev) => [...prev, ...urls].slice(0, MAX_MEMORY_PHOTOS));
      setPhotoQueue(urls);
    } catch (e: any) {
      // A later file may fail after earlier pairs were uploaded. None of those
      // URLs reached the editor yet, so compensate only this selection's files.
      await Promise.allSettled(urls.map(removeMeetingPhoto));
      if (mounted.current) toast.error("Impossibile caricare la foto: " + (e?.message || e));
    } finally {
      selecting.current = false;
      if (mounted.current) setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const settings = Object.fromEntries(Object.entries(layouts).filter(([uri]) => photos.includes(uri)));
    const { error } = await trackResult(() => supabase.from('visits').update({ memory_notes: note.trim() || null, memory_photos: photos, memory_photo_settings: settings }).eq('id', visit.id));
    if (error) {
      setSaving(false);
      return toast.error("Impossibile salvare il ricordo: " + error.message);
    }
    await Promise.all(saved.filter((p) => !photos.includes(p)).map((p) => removeMeetingPhoto(p).catch(() => {})));
    setSaving(false);
    setEditing(false);
    toast.success('Ricordo salvato');
    onChanged();
  };

  const shown = editing ? photos : saved;
  const shownLayouts = editing ? layouts : visit.memory_photo_settings;
  const empty = !visit.memory_notes && saved.length === 0 && !editing;

  return (
    <View style={{ gap: s.lg }}>
      {doneWishes.length > 0 && (
        <Card>
          <T v="title" style={{ marginBottom: 6 }}>Desideri realizzati</T>
          {doneWishes.map((w) => (
            <View key={w} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 32 }}>
              <Icon name="check" size={18} color={c.success} />
              <T>{w}</T>
            </View>
          ))}
        </Card>
      )}

      {empty ? (
        <Card>
          <EmptyState
            icon="camera"
            title="Nessun ricordo ancora"
            hint={`Aggiungi fino a ${MAX_MEMORY_PHOTOS} foto e un pensiero su questo incontro.`}
            action={<Button label="Aggiungi ricordo" icon="plus" onPress={start} />}
          />
        </Card>
      ) : (
        <>
          {shown.length > 0 && (
            <View style={{ width: '100%', maxWidth: 560 }} onLayout={event => {
              const next = event.nativeEvent.layout.width;
              if (next > 0) setGalleryWidth(next);
            }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={galleryWidth + 8} decelerationRate="fast"
              style={{ height: galleryWidth / (ratios[shown[Math.min(photoIndex, shown.length - 1)]] ?? 1), flexGrow: 0 }}
              contentContainerStyle={{ gap: 8, alignItems: 'flex-start' }} scrollEventThrottle={16}
              onScroll={event => setPhotoIndex(Math.max(0, Math.min(shown.length - 1, Math.round(event.nativeEvent.contentOffset.x / (galleryWidth + 8)))))}>
              {shown.map((url) => (
                <View key={url}>
                  <MemoryPhotoFrame uri={url} layout={shownLayouts?.[url]} onAspectRatio={ratio => setRatios(previous => previous[url] === ratio ? previous : { ...previous, [url]: ratio })}
                    style={{ width: galleryWidth, borderRadius: r.lg, backgroundColor: c.surfaceAlt }} />
                  {editing && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Rimuovi foto"
                      onPress={() => setPhotos(photos.filter((p) => p !== url))}
                      style={{ position: 'absolute', top: 10, right: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icon name="trash" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
            </View>
          )}
          {editing && shown.map((url, index) => <Button key={url} variant="secondary" label={`Inquadra foto ${index + 1}`} icon="edit" disabled={uploading || saving} onPress={() => setPhotoQueue([url])} />)}

          {editing ? (
            <Card>
              <View style={{ gap: s.md }}>
                <Input label="Un pensiero su questo incontro" placeholder="Cosa vi porterete dietro..." multiline value={note} onChangeText={setNote} style={{ minHeight: 100, textAlignVertical: 'top' }} />
                <Button
                  label={`Aggiungi foto (${photos.length}/${MAX_MEMORY_PHOTOS})`}
                  icon="camera"
                  variant="secondary"
                  onPress={pick}
                  loading={uploading}
                  disabled={photos.length >= MAX_MEMORY_PHOTOS}
                />
                <View style={{ flexDirection: 'row', gap: s.sm }}>
                  <Button label="Salva ricordo" onPress={save} loading={saving} disabled={uploading} style={{ flex: 2 }} />
                  <Button label="Annulla" variant="secondary" onPress={cancel} disabled={uploading} style={{ flex: 1 }} />
                </View>
              </View>
            </Card>
          ) : (
            <Card>
              {visit.memory_notes ? <T style={{ fontStyle: 'italic' }}>“{visit.memory_notes}”</T> : <T tone="muted">Nessun pensiero scritto.</T>}
              <Button label="Modifica ricordo" icon="edit" variant="secondary" onPress={start} style={{ marginTop: s.md, alignSelf: 'flex-start' }} />
            </Card>
          )}
        </>
      )}
      {photoQueue[0] && <MemoryPhotoEditor key={photoQueue[0]} uri={photoQueue[0]} initial={layouts[photoQueue[0]]}
        onClose={() => setPhotoQueue([])} onConfirm={layout => {
          setLayouts(previous => ({ ...previous, [photoQueue[0]]: layout }));
          setPhotoQueue(previous => previous.slice(1));
        }} />}
    </View>
  );
};
