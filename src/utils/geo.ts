import { throwIfAborted } from './abort';
import { nominatimFetch } from './nominatim';

export const calculateDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371;
  const toRad = (angle: number) => (angle * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

export const calculateMidpointCoords = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);
  const rLon1 = toRad(lon1);

  const Bx = Math.cos(rLat2) * Math.cos(dLon);
  const By = Math.cos(rLat2) * Math.sin(dLon);

  const midLat = Math.atan2(
    Math.sin(rLat1) + Math.sin(rLat2),
    Math.sqrt((Math.cos(rLat1) + Bx) ** 2 + By ** 2)
  );
  const midLon = rLon1 + Math.atan2(By, Math.cos(rLat1) + Bx);

  return { lat: toDeg(midLat), lon: toDeg(midLon) };
};

const cityCoordsCache: { [key: string]: { lat: number; lon: number } } = {};

export const getCityCoordinates = async (cityName: string, signal?: AbortSignal) => {
  throwIfAborted(signal);
  if (!cityName || !cityName.trim()) return null;
  const query = cityName.trim();

  if (cityCoordsCache[query]) return cityCoordsCache[query];

  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        query
      )}&count=10&language=it&format=json`,
      { signal }
    );
    if (res.ok) {
      const data = await res.json();
      throwIfAborted(signal);
      if (data.results && data.results.length > 0) {
        const italianResult =
          data.results.find((r: any) => r.country_code === 'IT') || data.results[0];

        const coords = { lat: italianResult.latitude, lon: italianResult.longitude };
        cityCoordsCache[query] = coords;
        return coords;
      }
    }
  } catch { throwIfAborted(signal); }

  try {
    const fallbackRes = await nominatimFetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query
      )}&format=json&limit=5&countrycodes=it`,
      { signal }
    );

    if (fallbackRes.ok) {
      const fallbackData = await fallbackRes.json();
      throwIfAborted(signal);
      if (fallbackData && fallbackData.length > 0) {
        const coords = {
          lat: parseFloat(fallbackData[0].lat),
          lon: parseFloat(fallbackData[0].lon),
        };
        cityCoordsCache[query] = coords;
        return coords;
      }
    }
  } catch { throwIfAborted(signal); }

  return null;
};

// ---------- Reverse geocoding (Nominatim, throttled + cache) ----------
const reverseCache: { [key: string]: any } = {};

export const reverseGeocode = async (lat: number, lon: number, signal?: AbortSignal) => {
  throwIfAborted(signal);
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (reverseCache[key]) return reverseCache[key];
  try {
    const res = await nominatimFetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=it`,
      { signal }
    );
    if (res.ok) {
      const data = await res.json();
      throwIfAborted(signal);
      reverseCache[key] = data;
      return data;
    }
  } catch { throwIfAborted(signal); }
  return null;
};

export const placeNameFromReverse = (data: any, lat: number, lon: number) => {
  if (!data) return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  const addr = data.address || {};
  return (
    addr.amenity ||
    addr.historic ||
    addr.road ||
    addr.square ||
    addr.city ||
    addr.town ||
    addr.village ||
    (data.display_name ? String(data.display_name).split(',')[0] : `${lat.toFixed(4)}, ${lon.toFixed(4)}`)
  );
};

export const cityNameFromReverse = (data: any) => {
  const addr = data?.address || {};
  return addr.city || addr.town || addr.village || addr.municipality || addr.county || 'Punto Intermedio';
};

const midpointCache: { [key: string]: any } = {};

export const getSuggestedMidpoint = async (myCity: string, partnerCity: string, signal?: AbortSignal) => {
  throwIfAborted(signal);
  const cacheKey = `${myCity.trim()}|${partnerCity.trim()}`;
  if (midpointCache[cacheKey]) return midpointCache[cacheKey];

  const coords1 = await getCityCoordinates(myCity, signal);
  const coords2 = await getCityCoordinates(partnerCity, signal);

  if (!coords1 || !coords2) return null;

  const mid = calculateMidpointCoords(coords1.lat, coords1.lon, coords2.lat, coords2.lon);
  const data = await reverseGeocode(mid.lat, mid.lon, signal);
  if (!data) return null;

  const result = {
    cityName: cityNameFromReverse(data),
    lat: mid.lat,
    lon: mid.lon,
    dist1: calculateDistanceKm(coords1.lat, coords1.lon, mid.lat, mid.lon),
    dist2: calculateDistanceKm(coords2.lat, coords2.lon, mid.lat, mid.lon),
  };
  midpointCache[cacheKey] = result;
  return result;
};

// Compatibilità: meteo di un singolo giorno (vedi utils/weather.ts per l'intervallo completo)
export const fetchWeatherForLocation = async (cityName: string, targetDateStr: string) => {
  const coords = await getCityCoordinates(cityName);
  if (!coords) return null;

  try {
    const dateOnly = targetDateStr.split('T')[0];
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=weathercode,temperature_2m_max&timezone=auto&start_date=${dateOnly}&end_date=${dateOnly}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.daily?.weathercode?.[0] !== undefined) {
        return {
          temp: Math.round(data.daily.temperature_2m_max[0]),
          code: data.daily.weathercode[0],
        };
      }
    }
  } catch (err) {}
  return null;
};
