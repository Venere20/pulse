import { useCallback, useEffect, useState } from 'react';
import { useAppDataFields } from '../../state/AppData';
import { draftStorage } from '../../services/drafts/storage';
import { updateProtection } from '../updates/updateProtection';
export function useLocalGame<T>(name: string, initial: () => T, valid: (value: unknown) => value is T, migrate?: (value: unknown) => T | null) {
  const { userId } = useAppDataFields(['userId']); const key = `solo:${userId}:${name}`;
  const [state, setState] = useState<T>(() => {
    try { const raw = draftStorage.getItem(key); if (raw) { const value: unknown = JSON.parse(raw); if (valid(value)) return value; const upgraded = migrate?.(value); if (upgraded && valid(upgraded)) return upgraded; } } catch { /* Use a fresh game if storage is unavailable. */ }
    return initial();
  });
  const [storageError, setStorageError] = useState(false);
  // Action games checkpoint sparsely and on pause, rather than writing each frame.
  // This also works from unmount cleanup, where React state updates are ignored.
  const checkpoint = useCallback((value: T) => {
    try { draftStorage.setItem(key, JSON.stringify(value)); setStorageError(false); return true; }
    catch { setStorageError(true); return false; }
  }, [key]);
  useEffect(() => {
    const release = updateProtection.hold();
    const timer = setTimeout(() => { try { draftStorage.setItem(key, JSON.stringify(state)); setStorageError(false); release(); } catch { setStorageError(true); } }, 0);
    return () => { clearTimeout(timer); release(); };
  }, [key, state]);
  return { state, setState, storageError, checkpoint };
}
export function useSoloRecord(name: string, lower = false) {
  const local = useLocalGame<number | null>('record:' + name, () => null, (v): v is number | null => v === null || (Number.isSafeInteger(v) && (v as number) >= 0));
  const setState = local.setState;
  const record = useCallback((value: number) => setState(old => old === null ? value : lower ? Math.min(old, value) : Math.max(old, value)), [setState, lower]);
  return { best: local.state, record, storageError: local.storageError };
}
