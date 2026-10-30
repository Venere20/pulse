import { throwIfAborted } from './abort';
import { calculateDistanceKm, getCityCoordinates } from './geo';

export interface RouteInfo {
  km: number;
  minutes: number | null;
  source: 'road' | 'air';
}

type Coord = { lat: number; lon: number };
const routeCache = new Map<string, RouteInfo>();

// OSRM (server demo pubblico): distanza stradale effettiva. Fallback: linea d'aria (Haversine).
export const getRoute = async (from: Coord, to: Coord, signal?: AbortSignal): Promise<RouteInfo> => {
  throwIfAborted(signal);
  const key = `${from.lat.toFixed(4)},${from.lon.toFixed(4)}>${to.lat.toFixed(4)},${to.lon.toFixed(4)}`;
  const cached = routeCache.get(key);
  if (cached) return cached;

  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`,
      { signal: controller.signal }
    );
    if (res.ok) {
      const data = await res.json();
      throwIfAborted(signal);
      const r = data?.routes?.[0];
      if (data?.code === 'Ok' && r) {
        const info: RouteInfo = {
          km: Math.round(r.distance / 1000),
          minutes: Math.round(r.duration / 60),
          source: 'road',
        };
        routeCache.set(key, info);
        return info;
      }
    }
  } catch {
    throwIfAborted(signal);
    // timeout / rete: fallback sotto
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }

  const air: RouteInfo = {
    km: calculateDistanceKm(from.lat, from.lon, to.lat, to.lon),
    minutes: null,
    source: 'air',
  };
  return air; // non in cache: riprova alla prossima richiesta
};

export interface VisitLegs {
  mine: RouteInfo | null;
  partner: RouteInfo | null;
  /** Somma dei due tragitti (solo andata) = km fatti "per vedervi" */
  totalKm: number | null;
}

export const computeVisitLegs = async (
  myCity: string,
  partnerCity: string,
  meetingPoint: string,
  knownMeet?: Coord | null,
  signal?: AbortSignal
): Promise<VisitLegs> => {
  throwIfAborted(signal);
  const meet = knownMeet || (await getCityCoordinates(meetingPoint, signal));
  if (!meet) return { mine: null, partner: null, totalKm: null };

  const [myC, partnerC] = await Promise.all([
    myCity ? getCityCoordinates(myCity, signal) : Promise.resolve(null),
    partnerCity ? getCityCoordinates(partnerCity, signal) : Promise.resolve(null),
  ]);

  const mine = myC ? await getRoute(myC, meet, signal) : null;
  const partner = partnerC ? await getRoute(partnerC, meet, signal) : null;
  const totalKm = mine && partner ? mine.km + partner.km : null;
  return { mine, partner, totalKm };
};

export const formatDuration = (minutes: number | null) => {
  if (minutes == null) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};
