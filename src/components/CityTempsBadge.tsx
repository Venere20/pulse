import { useCityWeather } from '../hooks/useCityWeather';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { T, Row } from '../ui/primitives';
import { useTheme } from '../theme/ThemeProvider';
import { CityWeather, fetchCityWeather } from '../utils/weather';

interface Props {
  myCity?: string | null;
  partnerCity?: string | null;
}

const REFRESH_MS = 15 * 60 * 1000;

const Line: React.FC<{ city: string; w: CityWeather }> = ({ city, w }) => (
  <Row gap={6} style={{ justifyContent: 'flex-end' }}>
    <T v="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>{city}</T>
    <T accessibilityRole="text">{w.icon}</T>
    <T bold style={{ fontVariant: ['tabular-nums'] }}>{w.temp}°</T>
  </Row>
);

/** Piccola targhetta con la temperatura attuale delle due città: va in alto a destra nella scheda della distanza. */
export const CityTempsBadge: React.FC<Props> = ({ myCity, partnerCity }) => {
  const { c, r, s } = useTheme();
  const {mine,theirs,loading}=useCityWeather(myCity,partnerCity);

  // Senza le due città, o se il meteo non è disponibile, la targhetta non compare
  if (!myCity || !partnerCity || (!mine && !theirs)) return null;

  const label = [mine && `${myCity} ${mine.temp} gradi`, theirs && `${partnerCity} ${theirs.temp} gradi`].filter(Boolean).join(', ');

  return (
    <View
      accessible
      accessibilityLabel={`Temperature attuali: ${label}`}
      style={{
        maxWidth: 170,
        backgroundColor: c.surfaceAlt,
        borderRadius: r.md,
        paddingHorizontal: s.sm,
        paddingVertical: s.xs + 2,
        gap: 2,
      }}
    >
      {mine && <Line city={myCity} w={mine} />}
      {theirs && <Line city={partnerCity} w={theirs} />}
    </View>
  );
};
