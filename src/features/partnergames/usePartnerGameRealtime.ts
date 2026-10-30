import { useEffect } from 'react';
import { supabase } from '../../config/supabase';
import type { PartnerGameKey } from './usePartnerGame';

/** Apply authorized Postgres rows immediately, without a debounce + reread.
 * Reconnection and deletion still require a fresh authoritative snapshot. */
export function usePartnerGameRealtime(game: PartnerGameKey, userId: string, active: boolean,
  onRow: (row: unknown) => void, refresh: () => Promise<void>) {
  useEffect(() => {
    if (!active || !userId) return;
    let disposed = false;
    const channel = supabase.channel(`partner-${game}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_games', filter: `game=eq.${game}` }, payload => {
        if (disposed) return;
        if (payload.eventType === 'DELETE') { void refresh(); return; }
        onRow(payload.new);
      })
      .subscribe(status => { if (!disposed && status === 'SUBSCRIBED') void refresh(); });
    return () => { disposed = true; void supabase.removeChannel(channel); };
  }, [game, userId, active, onRow, refresh]);
}
