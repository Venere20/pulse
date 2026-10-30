export function isMapPointMessage(value: unknown): value is { type: 'POINT_SELECTED'; lat: number; lon: number } {
  if (!value || typeof value !== 'object') return false;
  const point = value as Record<string, unknown>;
  return point.type === 'POINT_SELECTED' && typeof point.lat === 'number' && typeof point.lon === 'number'
    && Number.isFinite(point.lat) && Number.isFinite(point.lon)
    && point.lat >= -90 && point.lat <= 90 && point.lon >= -180 && point.lon <= 180;
}
