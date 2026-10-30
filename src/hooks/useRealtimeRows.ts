import { useEffect } from 'react';
import { supabase } from '../config/supabase';

export interface RowChange { table: string; eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: Record<string, unknown>; old: Record<string, unknown> }
/** Public rows may update the UI directly. Private/conditional rows still need
 * an authorized read; this hook does not grant access or cache their bodies. */
export function useRealtimeRows(tables: readonly string[], owner: string, active: boolean,
  onRow: (change: RowChange) => void, onReconnect: () => void) {
  const key = tables.join(',');
  useEffect(() => {
    if (!active || !owner || !key) return;
    let disposed = false;
    const channel = supabase.channel(`rows-${key}-${Math.random().toString(36).slice(2, 8)}`);
    for (const table of key.split(',')) channel.on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
      if (!disposed) onRow(payload as RowChange);
    });
    channel.subscribe(status => { if (!disposed && status === 'SUBSCRIBED') onReconnect(); });
    return () => { disposed = true; void supabase.removeChannel(channel); };
  }, [key, owner, active, onRow, onReconnect]);
}
