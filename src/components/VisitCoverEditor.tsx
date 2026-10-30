import React from 'react';
import type { Visit } from '../types/travel';
import { MemoryPhotoEditor } from './MemoryPhotoEditor';
import { useSignedImage } from '../hooks/useSignedImage';
import { BottomSheet } from '../ui/layout';
import { Button, T } from '../ui/primitives';
import { useFeatureAction } from '../features/FeatureFrame';
import { supabase } from '../config/supabase';
import { trackResult } from '../services/saveState';

/** Same non-destructive crop, movement and rotation as diary/capsules/story. */
export function VisitCoverEditor({ visit, onClose, onChanged }: { visit: Visit; onClose: () => void; onChanged: () => Promise<unknown> }) {
  const signed = useSignedImage('visit-covers', visit.cover_source === 'personal' ? visit.cover_storage_path ?? null : null);
  const { busy, run } = useFeatureAction();
  const memory = !visit.cover_source ? visit.memory_photos?.[0] : null;
  const uri = memory || (visit.cover_source === 'personal' ? `visit-covers:${visit.cover_storage_path}` : visit.cover_remote_url);
  const resolved = visit.cover_source === 'personal' ? signed.url : visit.cover_remote_url;
  if (!uri || (visit.cover_source === 'personal' && !resolved)) return <BottomSheet visible title="Ritaglia la copertina" onClose={onClose} footer={<Button label="Chiudi" variant="ghost" onPress={onClose} />}><T tone="muted">{signed.error ? 'Foto non disponibile. Chiudi e riprova.' : 'Caricamento della foto…'}</T></BottomSheet>;
  return <MemoryPhotoEditor uri={uri} resolvedUri={resolved ?? undefined} onError={visit.cover_source === 'personal' ? signed.onError : undefined}
    initial={memory ? visit.memory_photo_settings?.[memory] : visit.cover_photo_settings ?? undefined}
    onClose={() => { if (!busy) onClose(); }} saveHint="Il ritaglio e la rotazione vengono salvati per entrambi. Il file originale resta disponibile."
    onConfirm={layout => { void run(async () => {
      const patch = memory ? { memory_photo_settings: { ...visit.memory_photo_settings, [memory]: layout } } : { cover_photo_settings: layout };
      let query = supabase.from('visits').update(patch).eq('id', visit.id);
      if (visit.cover_source === 'personal') query = query.eq('cover_storage_path', visit.cover_storage_path);
      else if (visit.cover_source === 'destination') query = query.eq('cover_remote_url', visit.cover_remote_url);
      const { error, data } = await trackResult(() => query.select('id').maybeSingle());
      if (error) throw new Error(error.message);
      if (!data) throw new Error('La copertina è cambiata. Riaprila e riprova.');
      onClose(); await onChanged();
    }); }} />;
}
