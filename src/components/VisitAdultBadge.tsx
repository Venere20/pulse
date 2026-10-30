import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../ui/primitives';

/** Optional label, rendered only by the meetings list and visit detail. */
export function VisitAdultBadge({ visible }: { visible?: boolean }) {
  const { c, r } = useTheme();
  if (!visible) return null;
  return <View accessibilityLabel="Incontro con etichetta più diciotto" style={{ alignSelf: 'flex-start', borderRadius: r.sm, backgroundColor: c.surfaceAlt, paddingHorizontal: 6, paddingVertical: 3 }}>
    <T v="caption" tone="muted" style={{ fontSize: 11 }}>+18</T>
  </View>;
}
