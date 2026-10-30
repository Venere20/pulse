import React from 'react';
import { useSignedImage } from '../hooks/useSignedImage';
import { Button, T } from '../ui/primitives';
import { BottomSheet } from '../ui/layout';
import { PhotoLayout } from '../features/memories/photoLayout';
import { MemoryPhotoFrame } from './MemoryPhotoFrame';
import { MemoryPhotoEditor } from './MemoryPhotoEditor';

type StoredPhotoProps = { bucket: 'capsules' | 'story-photos'; path: string; layout?: PhotoLayout };

/** The stable storage path identifies the layout; only authorized, temporary URLs render it. */
export function StoredPhoto({ bucket, path, layout, label }: StoredPhotoProps & { label: string }) {
  const { url, error, onError } = useSignedImage(bucket, path);
  return url ? <MemoryPhotoFrame uri={`${bucket}:${path}`} resolvedUri={url} layout={layout}
    onError={onError} accessibilityLabel={label} style={{ width: '100%', borderRadius: 16 }} />
    : <T tone="muted">{error ? 'Foto non disponibile' : 'Caricamento foto…'}</T>;
}

export function StoredPhotoEditor({ bucket, path, layout, onClose, onConfirm, saveHint }: StoredPhotoProps & {
  onClose: () => void; onConfirm: (layout: PhotoLayout) => void; saveHint: string;
}) {
  const { url, error, onError } = useSignedImage(bucket, path);
  return url ? <MemoryPhotoEditor uri={`${bucket}:${path}`} resolvedUri={url} onError={onError}
    initial={layout} onClose={onClose} onConfirm={onConfirm} saveHint={saveHint} />
    : <BottomSheet visible title="Inquadra la foto" onClose={onClose}
      footer={<Button label="Chiudi" variant="ghost" onPress={onClose} />}>
      <T tone="muted">{error ? 'Foto non disponibile. Chiudi e riprova.' : 'Caricamento foto…'}</T>
    </BottomSheet>;
}
