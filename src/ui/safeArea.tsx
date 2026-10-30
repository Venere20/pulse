import React from 'react';
import { Platform, StatusBar } from 'react-native';

// react-native-safe-area-context fornisce le misure reali di notch e barre di sistema (anche in modalità edge-to-edge su Android).
// Se non è installato l'app continua a funzionare con valori approssimati.
let mod: any = null;
try {
  mod = require('react-native-safe-area-context');
} catch (e) {
  mod = null;
}

export const hasSafeArea = !!mod?.useSafeAreaInsets;

export const SafeAreaRoot: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  mod?.SafeAreaProvider ? <mod.SafeAreaProvider>{children}</mod.SafeAreaProvider> : <>{children}</>;

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function useInsets(): Insets {
  if (hasSafeArea) return mod.useSafeAreaInsets();
  return { top: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0, bottom: 0, left: 0, right: 0 };
}
