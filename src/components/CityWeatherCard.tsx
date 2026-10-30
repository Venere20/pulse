import { useCityWeather } from '../hooks/useCityWeather';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Card, T, Row } from '../ui/primitives';
import { useTheme } from '../theme/ThemeProvider';
import { CityWeather, fetchCityWeather } from '../utils/weather';

interface Props {
  myCity?: string | null;
  partnerCity?: string | null;
}

const CityColumn: React.FC<{ label: string; city: string; w: CityWeather }> = ({ label, city, w }) => {
  const { c, r, s } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        backgroundColor: c.surfaceAlt,
        borderRadius: r.md,
        padding: s.md,
        gap: 2,
      }}
    >
      <T tone="muted">{label}</T>
      <T bold numberOfLines={1}>{city}</T>
      <T v="h1">{w.icon} {w.temp}°</T>
      <T tone="muted">Percepita {w.feelsLike}°</T>
      <T tone="faint">{w.todayMin}° / {w.todayMax}° · pioggia {w.rainChance}%</T>
    </View>
  );
};

/** Differenza di temperatura tra le due città, in una frase. */
const diffText = (my: CityWeather, partner: CityWeather, myCity: string, partnerCity: string): string => {
  const diff = my.temp - partner.temp;
  if (Math.abs(diff) <= 1) return 'Stessa temperatura, più o meno 🌡️';
  return diff > 0
    ? `A ${myCity} fa ${diff}° in più che a ${partnerCity}`
    : `A ${partnerCity} fa ${Math.abs(diff)}° in più che a ${myCity}`;
};

export const CityWeatherCard: React.FC<Props> = ({ myCity, partnerCity }) => {
  const { s } = useTheme();
  const {mine,theirs,loading}=useCityWeather(myCity,partnerCity);

  // Senza le due città, o se il meteo non è disponibile (offline), la card semplicemente non compare.
  if (!myCity || !partnerCity) return null;

  if (loading) {
    return (
      <Card>
        <T tone="muted">Carico il meteo delle vostre città…</T>
      </Card>
    );
  }

  if (!mine || !theirs) return null;

  return (
    <Card>
      <T v="title" style={{ marginBottom: s.md }}>Che tempo fa adesso</T>
      <Row gap={s.md}>
        <CityColumn label="Tu" city={myCity} w={mine} />
        <CityColumn label="Partner" city={partnerCity} w={theirs} />
      </Row>
      <T tone="muted" style={{ textAlign: 'center', marginTop: s.md }}>
        {diffText(mine, theirs, myCity, partnerCity)}
      </T>
    </Card>
  );
};
