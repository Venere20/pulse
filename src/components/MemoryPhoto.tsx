import React, { useState } from 'react';
import { Image, ImageProps, Platform, StyleSheet, View } from 'react-native';
import { useScreenActive } from '../hooks/useActivity';
import { useSignedImage } from '../hooks/useSignedImage';
import { memoryPhotoStoragePath } from '../services/memoryPhotos';
import { memoryPreviewUrl } from '../services/memoryPhotoPaths';

type Props = Omit<ImageProps, 'source'> & { uri: string; preferPreview?: boolean; adaptive?: boolean; onAspectRatio?: (ratio: number) => void };
const photoRatios = new Map<string, number>();
function PhotoSource({ uri, preferPreview = false, adaptive = false, onAspectRatio, onLoad, onError, ...props }: Props) {
  const [measured, setMeasured] = useState<{ uri: string; ratio: number } | null>(null);
  const ratio = measured?.uri === uri ? measured.ratio : photoRatios.get(uri) ?? 1;
  const style = adaptive ? { ...StyleSheet.flatten(props.style), height: undefined, aspectRatio: ratio } : props.style;
  const preview = preferPreview ? memoryPreviewUrl(uri) : null;
  const [failedPreview, setFailedPreview] = useState<string | null>(null);
  const thumbnail = useSignedImage('meetings', preview && preview !== failedPreview ? memoryPhotoStoragePath(preview) : null);
  const usePreview = !!preview && preview !== failedPreview && !thumbnail.error;
  const original = useSignedImage('meetings', usePreview ? null : memoryPhotoStoragePath(uri));
  const selected = usePreview ? preview : uri;
  const signed = usePreview ? thumbnail : original;
  // Disposable local demo fixture; never allow an external fallback in production.
  const demo = Platform.OS === 'web' && typeof location !== 'undefined'
    && ['127.0.0.1', 'localhost'].includes(location.hostname) && selected.startsWith('/__demo/');
  const url = demo ? selected : signed.url;
  return url ? <Image {...props} style={style} source={{ uri: url }} onLoad={event => {
    // React Native provides source dimensions; react-native-web forwards the
    // browser image load event instead.
    const loaded = event.nativeEvent as typeof event.nativeEvent & { target?: { naturalWidth: number; naturalHeight: number } };
    const width = loaded.source?.width ?? loaded.target?.naturalWidth ?? 0;
    const height = loaded.source?.height ?? loaded.target?.naturalHeight ?? 0;
    if (adaptive && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      const next = width / height;
      photoRatios.set(uri, next);
      if (photoRatios.size > 128) photoRatios.delete(photoRatios.keys().next().value!);
      setMeasured(previous => previous?.uri === uri && previous.ratio === next ? previous : { uri, ratio: next });
      onAspectRatio?.(next);
    }
    onLoad?.(event);
  }} onError={event => {
    signed.onError();
    if (preview && selected === preview) setFailedPreview(preview);
    else onError?.(event);
  }} /> : <View style={style} accessibilityLabel={signed.error ? 'Foto non disponibile' : 'Caricamento foto'} />;
}

/** Legacy references and new uploads both require an authorized signature. */
export function MemoryPhoto(props: Props) {
  const active = useScreenActive();
  return active ? <PhotoSource {...props} /> : <View style={props.style} />;
}
