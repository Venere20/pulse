import { VisitCover } from './VisitCover';
import { VisitAdultBadge } from './VisitAdultBadge';
import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Visit } from '../types/travel';
import { daysBetween, formatDateIt } from '../utils/dates';
import { fetchTripWeather, WeatherResult } from '../utils/weather';
import { visitColors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Card, T } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { useScreenActive } from '../hooks/useActivity';

interface Props {
  visit: Visit;
  colorIndex: number;
  today: string;
  wishCount: number;
  onPress: () => void;
}

/** Carta compatta: titolo, date, luogo, countdown e meteo. Il resto sta nella schermata di dettaglio. */
export const VisitCard: React.FC<Props> = ({ visit, colorIndex, today, wishCount, onPress }) => {
  const { c, r, s } = useTheme();
  const place = visit.meeting_point || visit.location || '';
  const weatherKey = JSON.stringify([place, visit.start_date, visit.end_date, visit.meeting_lat, visit.meeting_lon]);
  const [storedWeather, setWeather] = useState<{ key: string; result: WeatherResult } | null>(null);
  const weather = storedWeather?.key === weatherKey ? storedWeather.result : null;
  const active = useScreenActive();

  useEffect(() => {
    if (!active) return;
    let alive = true;
    if (!place) return;
    const controller = new AbortController();
    const coords = visit.meeting_lat != null && visit.meeting_lon != null ? { lat: visit.meeting_lat, lon: visit.meeting_lon } : null;
    fetchTripWeather(place, visit.start_date, visit.end_date, coords, controller.signal)
      .then((w) => { if (alive) setWeather({ key: weatherKey, result: w }); })
      .catch(() => { if (alive && !controller.signal.aborted) setWeather({ key: weatherKey, result: { ok: false, reason: 'error' } }); });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [active, place, visit.start_date, visit.end_date, visit.meeting_lat, visit.meeting_lon, weatherKey]);

  const ongoing = visit.status !== 'concluded' && !visit.ended_at && (visit.timing_mode === 'manual' ? !!visit.started_at : visit.start_date <= today && visit.end_date >= today);
  const days = daysBetween(today, visit.start_date);
  const badge = ongoing ? 'In corso' : visit.timing_mode === 'manual' ? 'In attesa' : days === 0 ? 'Oggi' : days === 1 ? 'Domani' : `Tra ${days} giorni`;
  const color = visitColors[colorIndex % visitColors.length];

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${visit.title}, ${badge}. Apri dettagli`}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <Card padded={false}>
        <VisitCover visit={visit} height={150} />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 6, backgroundColor: color }} />
          <View style={{ flex: 1, padding: s.lg, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.sm }}>
              <T v="title" style={{ flex: 1 }} numberOfLines={1}>{visit.title}</T>
              <VisitAdultBadge visible={visit.is_adult} />
              <View style={{ backgroundColor: ongoing ? c.primary : c.surfaceAlt, borderRadius: r.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                <T bold tone={ongoing ? 'onPrimary' : 'default'}>{badge}</T>
              </View>
            </View>
            <T tone="muted">
              {formatDateIt(visit.start_date)}
              {visit.end_date !== visit.start_date ? ` → ${formatDateIt(visit.end_date)}` : ''}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.md, marginTop: 4, flexWrap: 'wrap' }}>
              {place ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="mapPin" size={16} color={c.textMuted} />
                  <T tone="muted" numberOfLines={1}>{place}</T>
                </View>
              ) : (
                <T tone="faint">Punto d&apos;incontro da scegliere</T>
              )}
              {weather && weather.ok && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 16 }}>{weather.icon}</Text>
                  <T tone="muted">{weather.avgTemp}°C</T>
                </View>
              )}
              {wishCount > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="star" size={16} color={c.warning} />
                  <T tone="muted">{wishCount} {wishCount === 1 ? 'desiderio' : 'desideri'}</T>
                </View>
              )}
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};
