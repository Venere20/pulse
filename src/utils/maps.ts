import { Linking, Platform } from 'react-native';

/** Apre le indicazioni stradali verso la destinazione nell'app Mappe del dispositivo (o in Google Maps su web). */
export const openDirections = (destination: string, coords?: { lat: number; lon: number } | null) => {
  const web = coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lon}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  const enc = encodeURIComponent(destination);
  const native = Platform.select({
    ios: coords ? `maps://app?daddr=${coords.lat},${coords.lon}` : `maps://app?daddr=${enc}`,
    android: coords ? `google.navigation:q=${coords.lat},${coords.lon}` : `google.navigation:q=${enc}`,
    default: web,
  });
  return Linking.openURL(native || web).catch(() => Linking.openURL(web));
};
