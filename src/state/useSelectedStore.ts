import { useMemo, useSyncExternalStore } from 'react';
import { DataStore, selectedSnapshot } from './dataStore';
export function useSelectedStore<T, S>(store: DataStore<T>, selector: (value: T) => S): S {
  const snapshot = useMemo(() => selectedSnapshot(store, selector), [store, selector]);
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}
