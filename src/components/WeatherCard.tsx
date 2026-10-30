import React from 'react';
import { View } from 'react-native';
import { WeatherResult } from '../utils/weather';
import { Card, Skeleton, T } from '../ui/primitives';
import { Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  weather: WeatherResult | null;
  loading: boolean;
}

export const WeatherCard: React.FC<Props> = ({ weather, loading }) => {
  const { s } = useTheme();
  if (loading) return <Skeleton height={96} />;
  if (!weather) return null;

  if (!weather.ok) {
    const msg =
      weather.reason === 'too_far'
        ? 'Le previsioni compaiono quando mancano meno di 16 giorni.'
        : weather.reason === 'past'
        ? 'Incontro già passato.'
        : 'Meteo non disponibile al momento.';
    return (
      <Card>
        <T v="title">Meteo</T>
        <T tone="muted">{msg}</T>
      </Card>
    );
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.md }}>
        <Text style={{ fontSize: 44 }}>{weather.icon}</Text>
        <View style={{ flex: 1 }}>
          <T v="h2">{weather.avgTemp}°C medi</T>
          <T tone="muted">
            Min {weather.minTemp}° · Max {weather.maxTemp}° · Pioggia {weather.rainChance}%
          </T>
        </View>
      </View>
      <T style={{ marginTop: s.md }}>👕 {weather.clothing}</T>
    </Card>
  );
};
