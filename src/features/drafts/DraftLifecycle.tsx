import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { drafts } from './useDraftField';
export function DraftLifecycle() {
  useEffect(() => {
    const app = AppState.addEventListener('change', state => { if (state !== 'active') drafts.flush(); });
    const flush = () => drafts.flush();
    if (Platform.OS === 'web') window.addEventListener('pagehide', flush);
    return () => { app.remove(); if (Platform.OS === 'web') window.removeEventListener('pagehide', flush); drafts.flush(); };
  }, []);
  return null;
}
