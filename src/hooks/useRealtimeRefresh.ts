import { useEffect, useRef, useState } from 'react';
import { supabase } from '../config/supabase';
import { useScreenActive } from './useActivity';
import { useAuth } from '../state/Auth';
import { featureReadCache } from '../services/featureReadCache';
import { createRealtimeRefreshRegistry } from '../services/realtimeRefreshRegistry';

const registry = createRealtimeRefreshRegistry({
  channel: name => supabase.channel(name),
  removeChannel: channel => supabase.removeChannel(channel as ReturnType<typeof supabase.channel>),
}, (owner, table) => featureReadCache.invalidate(owner, table));

/**
 * Sottoscrive i cambiamenti Postgres (Supabase Realtime) delle tabelle indicate
 * e richiama `onChange` (con debounce) ad ogni evento: niente pull-to-refresh.
 */
export function useRealtimeRefresh(tables: string[], onChange: (changed?: readonly string[]) => void) {
  const active = useScreenActive();
  const owner = useAuth().profile?.id ?? '';
  const [connectedKey, setConnectedKey] = useState('');
  const cbRef = useRef(onChange);
  useEffect(()=>{cbRef.current=onChange;},[onChange]);
  const key = [...new Set(tables)].sort().join(',');
  const identity = JSON.stringify([owner, key]);

  useEffect(() => {
    if (!active || !key || !owner) return;
    return registry.subscribe(owner, key.split(','), names => cbRef.current(names), connected => setConnectedKey(connected ? identity : ''));
  }, [key, active, owner, identity]);
  return active && connectedKey === identity;
}
