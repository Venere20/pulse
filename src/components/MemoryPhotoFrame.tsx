import React, { useEffect, useState } from 'react';
import { Image, ImageProps, StyleProp, View, ViewStyle } from 'react-native';
import { MemoryPhoto } from './MemoryPhoto';
import { frameRatio, photoImageGeometry, photoLayout, PhotoLayout } from '../features/memories/photoLayout';

const sourceRatios = new Map<string, number>();
export function MemoryPhotoFrame({ uri, layout, preview = false, style, onAspectRatio, onSourceRatio, resolvedUri, onError, accessibilityLabel = 'Foto del ricordo' }: {
  uri: string; layout?: PhotoLayout; preview?: boolean; style?: StyleProp<ViewStyle>;
  onAspectRatio?: (ratio: number) => void; onSourceRatio?: (ratio: number) => void;
  resolvedUri?: string; onError?: ImageProps['onError']; accessibilityLabel?: string;
}) {
  const [measured, setMeasured] = useState<{ uri: string; ratio: number } | null>(null);
  const [width, setWidth] = useState(0);
  const ratio = measured?.uri === uri ? measured.ratio : sourceRatios.get(uri) ?? 1;
  const setting = photoLayout(layout), displayRatio = frameRatio(ratio, setting);
  useEffect(() => { onAspectRatio?.(displayRatio); }, [displayRatio, onAspectRatio]);
  useEffect(() => { if (measured?.uri === uri || sourceRatios.has(uri)) onSourceRatio?.(ratio); }, [measured, uri, ratio, onSourceRatio]);
  const loaded: NonNullable<ImageProps['onLoad']> = event => {
    const source = event.nativeEvent as typeof event.nativeEvent & { target?: { naturalWidth: number; naturalHeight: number } };
    const w = source.source?.width ?? source.target?.naturalWidth ?? 0, h = source.source?.height ?? source.target?.naturalHeight ?? 0;
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      const next = w / h;
      sourceRatios.set(uri, next); if (sourceRatios.size > 128) sourceRatios.delete(sourceRatios.keys().next().value!);
      setMeasured(previous => previous?.uri === uri && previous.ratio === next ? previous : { uri, ratio: next });
    }
  };
  const imageStyle: ImageProps['style'] = width > 0 ? { position: 'absolute', ...photoImageGeometry(width, ratio, setting) } : { width: '100%', height: '100%' };
  return <View accessibilityLabel={accessibilityLabel} style={[style, { aspectRatio: displayRatio, overflow: 'hidden' }]}
    onLayout={event => { if (event.nativeEvent.layout.width > 0) setWidth(event.nativeEvent.layout.width); }}>
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
    {resolvedUri ? <Image source={{ uri: resolvedUri }} onLoad={loaded} onError={onError} resizeMode="contain" style={imageStyle} />
      : <MemoryPhoto uri={uri} preferPreview={preview} onLoad={loaded} onError={onError} resizeMode="contain" style={imageStyle} />}
    </View>
  </View>;
}
