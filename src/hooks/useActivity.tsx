import React, { createContext, useContext, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { useIsFocused } from 'expo-router';

const FocusContext = createContext(true);
const listeners = new Set<() => void>();
let disconnect: (() => void) | null = null;
function foreground() {
  return (AppState.currentState == null || AppState.currentState === 'active') &&
    (Platform.OS !== 'web' || typeof document === 'undefined' || !document.hidden);
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!disconnect) {
    const emit = () => { for (const fn of listeners) fn(); };
    const app = AppState.addEventListener('change', emit);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', emit);
      disconnect = () => { app.remove(); document.removeEventListener('visibilitychange', emit); };
    } else disconnect = () => app.remove();
  }
  return () => { listeners.delete(listener); if (!listeners.size) { disconnect?.(); disconnect = null; } };
}
export function useAppForeground() { return useSyncExternalStore(subscribe, foreground, () => true); }
export function useScreenActive() { const focused = useContext(FocusContext); const active = useAppForeground(); return focused && active; }
// Root providers remain global; each Stack scene supplies its own focus to all
// hooks beneath it, including components rendered by Slot in the tab layout.
export function ScreenActivity({ children }: { children: React.ReactNode }) {
  const focused = useIsFocused();
  return <FocusContext.Provider value={focused}>{children}</FocusContext.Provider>;
}
