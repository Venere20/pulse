import { useCallback, useSyncExternalStore } from 'react';
import { useAppDataFields } from '../../state/AppData';
import { createDraftStore, draftKey } from '../../services/drafts/core';
import { draftStorage } from '../../services/drafts/storage';
export const drafts = createDraftStore(draftStorage);
export function useDraftField<T>(scope: string, field: string, initial: T): [T, (value: T | ((current: T) => T)) => void] {
  const { userId } = useAppDataFields(['userId']); const key = draftKey(userId, scope, field);
  const value = useSyncExternalStore(drafts.subscribe, () => drafts.get(key, initial), () => initial);
  const set = useCallback((next: T | ((current: T) => T)) => { drafts.set(key, typeof next === 'function' ? (next as (current: T) => T)(drafts.get(key, initial)) : next); }, [key, initial]);
  return [value, set];
}
