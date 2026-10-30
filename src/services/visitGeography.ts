import type { Visit } from '../types/travel';
import { getCityCoordinates } from '../utils/geo';
import { computeVisitLegs } from '../utils/routing';
import { throwIfAborted } from '../utils/abort';

export async function visitGeographyPatch(visit: Visit, myCity: string, partnerCity: string, signal: AbortSignal): Promise<Record<string, number>> {
  throwIfAborted(signal);
  const place = visit.meeting_point || visit.location;
  if (!place) return {};
  const patch: Record<string, number> = {};
  let coords = visit.meeting_lat != null && visit.meeting_lon != null ? { lat: visit.meeting_lat, lon: visit.meeting_lon } : null;
  if (!coords) {
    coords = await getCityCoordinates(place, signal);
    throwIfAborted(signal);
    if (coords) { patch.meeting_lat = coords.lat; patch.meeting_lon = coords.lon; }
  }
  if (coords && !visit.journey_plan && !visit.journey_totals && visit.travel_km == null && myCity && partnerCity) {
    const legs = await computeVisitLegs(myCity, partnerCity, place, coords, signal);
    throwIfAborted(signal);
    if (legs.totalKm != null) patch.travel_km = legs.totalKm;
  }
  return patch;
}
