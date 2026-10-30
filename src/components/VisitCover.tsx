import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { useSignedImage } from '../hooks/useSignedImage';
import { Visit } from '../types/travel';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from '../ui/Icon';
import { T } from '../ui/primitives';
import { MemoryPhotoFrame } from './MemoryPhotoFrame';
interface Props {
  visit: Visit;
  height?: number;
  resizeMode?: 'cover' | 'contain';
}

const COVER_BUCKET = 'visit-covers';

export function VisitCover({ visit, height = 190, resizeMode }: Props) {
  const { c, r, s } = useTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const source = visit.cover_source ?? null;
  const storagePath = visit.cover_storage_path ?? null;

  const privateCover = useSignedImage(COVER_BUCKET, source === 'personal' ? storagePath : null);

  if (source === null && visit.memory_photos?.[0]) {
    return <MemoryPhotoFrame uri={visit.memory_photos[0]} layout={visit.memory_photo_settings?.[visit.memory_photos[0]]}
      style={{ width: '100%', backgroundColor: c.surfaceAlt }} />;
  }

  let imageUri: string | null = null;
  if (source === 'personal') {
    // Il percorso deve corrispondere prima di mostrare un URL già presente nello stato.
    imageUri = privateCover.url;
  } else if (source === 'destination') {
    imageUri = visit.cover_remote_url ?? null;
  }

  if (imageUri && failedUri !== imageUri) {
    if (visit.cover_photo_settings) return <MemoryPhotoFrame uri={source === 'personal' ? `visit-covers:${storagePath}` : imageUri}
      resolvedUri={imageUri} layout={visit.cover_photo_settings} accessibilityLabel={`Copertina dell'incontro ${visit.title}`}
      onError={() => { if (source === 'personal') privateCover.onError(); else setFailedUri(imageUri); }}
      style={{ width: '100%', backgroundColor: c.surfaceAlt }} />;
    return (
      <Image
        source={{ uri: imageUri }}
        resizeMode={resizeMode ?? (source === 'destination' ? 'contain' : 'cover')}
        onError={() => { if (source === 'personal') privateCover.onError(); else setFailedUri(imageUri); }}
        accessibilityLabel={`Copertina dell'incontro ${visit.title}`}
        style={{ width: '100%', height, backgroundColor: c.surfaceAlt }}
      />
    );
  }

  return (
    <View
      style={{
        height,
        backgroundColor: c.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.md,
        padding: s.lg,
        borderRadius: r.md,
      }}
    >
      <Icon name="mapPin" size={36} color={c.primary} />
      <T v="title" numberOfLines={2} style={{ textAlign: 'center' }}>
        {visit.meeting_point || visit.location || 'Il nostro prossimo momento'}
      </T>
    </View>
  );
}
