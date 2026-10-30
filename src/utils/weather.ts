import { throwIfAborted } from './abort';
import { getCityCoordinates } from './geo';
import { addDaysStr, daysBetween, localDateStr } from './dates';

export interface TripWeather {
  avgTemp: number;
  minTemp: number;
  maxTemp: number;
  code: number;
  rainChance: number;
  icon: string;
  clothing: string;
}

export type WeatherResult =
  | ({ ok: true } & TripWeather)
  | { ok: false; reason: 'too_far' | 'past' | 'error' };

// Open-Meteo: previsioni disponibili fino a 16 giorni (indice 0..15)
const FORECAST_DAYS = 15;

export const getWeatherIcon = (code: number) => {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code >= 45 && code <= 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 95) return '⛈️';
  return '🌡️';
};

export const getClothingAdvice = (avgTemp: number, rainChance: number, code: number) => {
  let base: string;
  if (avgTemp < 5) base = 'Fa molto freddo: piumino, sciarpa e guanti.';
  else if (avgTemp < 12) base = 'Freddo: giacca pesante e strati caldi.';
  else if (avgTemp < 18) base = 'Fresco: giacca leggera o felpa.';
  else if (avgTemp < 25) base = 'Mite: maglietta e un maglioncino per la sera.';
  else base = 'Caldo: abiti leggeri, occhiali da sole e crema solare.';

  const rainy = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  if (rainChance >= 50 || rainy) base += ' Porta ombrello o k-way.';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) base += ' Possibile neve: scarpe adatte.';
  return base;
};

export interface CityWeather {
  temp: number;
  feelsLike: number;
  code: number;
  icon: string;
  isDay: boolean;
  todayMin: number;
  todayMax: number;
  rainChance: number;
}

// Cache breve: la home si riapre spesso e non serve richiedere il meteo ogni volta.
const CITY_WEATHER_TTL_MS = 15 * 60 * 1000;
const cityWeatherCache = new Map<string, { at: number; value: CityWeather }>();

/** Meteo di adesso + min/max di oggi per una città. Restituisce null se offline o città non trovata. */
export const fetchCityWeather = async (place: string, signal?: AbortSignal): Promise<CityWeather | null> => {
  throwIfAborted(signal);
  const key = place.trim().toLowerCase();
  const cached = cityWeatherCache.get(key);
  if (cached && Date.now() - cached.at < CITY_WEATHER_TTL_MS) return cached.value;

  const coords = await getCityCoordinates(place, signal);
  if (!coords) return null;

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
        `&current=temperature_2m,apparent_temperature,weather_code,is_day` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&timezone=auto&forecast_days=1`,
      { signal }
    );
    if (!res.ok) return null;
    const data = await res.json();
    throwIfAborted(signal);
    const cur = data.current;
    const d = data.daily;
    if (!cur || typeof cur.temperature_2m !== 'number' || !d?.time?.length) return null;

    const code = Number(cur.weather_code);
    const isDay = cur.is_day !== 0;
    // Di notte il sereno diventa una luna
    const icon = !isDay && code <= 2 ? '🌙' : getWeatherIcon(code);
    const value: CityWeather = {
      temp: Math.round(cur.temperature_2m),
      feelsLike: Math.round(cur.apparent_temperature ?? cur.temperature_2m),
      code,
      icon,
      isDay,
      todayMin: Math.round(d.temperature_2m_min[0]),
      todayMax: Math.round(d.temperature_2m_max[0]),
      rainChance: d.precipitation_probability_max?.[0] ?? 0,
    };
    cityWeatherCache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    throwIfAborted(signal);
    return null;
  }
};

export const fetchTripWeather = async (
  place: string,
  startDate: string,
  endDate: string,
  knownCoords?: { lat: number; lon: number } | null,
  signal?: AbortSignal
): Promise<WeatherResult> => {
  throwIfAborted(signal);
  const today = localDateStr();
  const maxDate = addDaysStr(today, FORECAST_DAYS);
  const start = startDate.slice(0, 10);
  const end = endDate.slice(0, 10) || start;

  if (end < today) return { ok: false, reason: 'past' };
  if (start > maxDate) return { ok: false, reason: 'too_far' };

  const from = start < today ? today : start;
  const to = end > maxDate ? maxDate : end;
  if (daysBetween(from, to) < 0) return { ok: false, reason: 'error' };

  const coords = knownCoords || (await getCityCoordinates(place, signal));
  if (!coords) return { ok: false, reason: 'error' };

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&timezone=auto&start_date=${from}&end_date=${to}`,
      { signal }
    );
    if (!res.ok) return { ok: false, reason: 'error' };
    const data = await res.json();
    throwIfAborted(signal);
    const d = data.daily;
    if (!d?.time?.length) return { ok: false, reason: 'error' };

    const n = d.time.length;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    let rain = 0;
    const counts: { [code: number]: number } = {};
    for (let i = 0; i < n; i++) {
      const tmax = d.temperature_2m_max[i];
      const tmin = d.temperature_2m_min[i];
      sum += (tmax + tmin) / 2;
      min = Math.min(min, tmin);
      max = Math.max(max, tmax);
      rain = Math.max(rain, d.precipitation_probability_max?.[i] ?? 0);
      const c = d.weather_code[i];
      counts[c] = (counts[c] || 0) + 1;
    }
    const code = Number(
      Object.keys(counts).sort((a, b) => counts[Number(b)] - counts[Number(a)] || Number(b) - Number(a))[0]
    );
    const avgTemp = Math.round(sum / n);

    return {
      ok: true,
      avgTemp,
      minTemp: Math.round(min),
      maxTemp: Math.round(max),
      code,
      rainChance: rain,
      icon: getWeatherIcon(code),
      clothing: getClothingAdvice(avgTemp, rain, code),
    };
  } catch {
    throwIfAborted(signal);
    return { ok: false, reason: 'error' };
  }
};
