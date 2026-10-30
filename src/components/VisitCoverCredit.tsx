import React from 'react';
import { Linking, TouchableOpacity, View } from 'react-native';
import { Visit } from '../types/travel';
import { T } from '../ui/primitives';
import { useTheme } from '../theme/ThemeProvider';

export interface CoverCredit {
  photographer?: string;
  photographer_url?: string;
  unsplash_url?: string;
}

export function unsplashCreditUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'unsplash.com' || url.username || url.password) return null;
    url.searchParams.set('utm_source', 'pulse');
    url.searchParams.set('utm_medium', 'referral');
    return url.toString();
  } catch { return null; }
}

export function VisitCoverCredit({ visit, credit, compact = false }: { visit?: Visit; credit?: CoverCredit; compact?: boolean }) {
  const { s } = useTheme();
  let attribution = credit;
  if (!attribution && visit?.cover_source === 'destination' && visit.cover_attribution) {
    try {
      const parsed: unknown = JSON.parse(visit.cover_attribution);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) attribution = parsed as CoverCredit;
    } catch { /* Invalid legacy attribution must not break the meeting. */ }
  }
  if (!attribution) return null;
  const name = typeof attribution.photographer === 'string' ? attribution.photographer : 'un autore';
  const authorUrl = unsplashCreditUrl(attribution.photographer_url);
  const photoUrl = unsplashCreditUrl(attribution.unsplash_url);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: s.xs }}>
      {!compact && <T tone="muted" v="caption">Foto di</T>}
      <TouchableOpacity accessibilityRole="link" accessibilityLabel={`Autore: ${name}`} disabled={!authorUrl}
        onPress={(event) => { event.stopPropagation(); if (authorUrl) void Linking.openURL(authorUrl).catch(() => {}); }}
        style={{ minHeight: 44, maxWidth: '100%', justifyContent: 'center' }}>
        <T tone="primary" v="caption" numberOfLines={compact ? 2 : undefined} style={compact ? { fontSize: 10 } : undefined}>{name}</T>
      </TouchableOpacity>
      {!compact && <T tone="muted" v="caption">su</T>}
      <TouchableOpacity accessibilityRole="link" accessibilityLabel="Fotografia su Unsplash" disabled={!photoUrl}
        onPress={(event) => { event.stopPropagation(); if (photoUrl) void Linking.openURL(photoUrl).catch(() => {}); }}
        style={{ minHeight: 44, maxWidth: '100%', justifyContent: 'center' }}>
        <T tone="primary" v="caption" style={compact ? { fontSize: 10 } : undefined}>Unsplash ↗</T>
      </TouchableOpacity>
    </View>
  );
}
