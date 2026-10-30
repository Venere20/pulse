import { useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useScreenActive } from '../../hooks/useActivity';
import { useAppDataFields } from '../../state/AppData';
import { enterGame, sharedGame } from '../../services/gameActivity';

/** A lease survives dropped unload/background messages; each device is independent. */
export function useGamePresence(game: string | null) {
  const { userId } = useAppDataFields(['userId']);
  const active = useScreenActive();
  useEffect(() => {
    if (!active || !userId || !sharedGame(game)) return;
    const leaveLocal = enterGame(game);
    const session = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    let pending = false, stopped = false;
    let tail = Promise.resolve();
    const send = async (present: boolean) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        await supabase.rpc('update_game_presence', { p_game: game, p_session: session, p_active: present, p_profile: userId }).abortSignal(controller.signal);
      } catch { /* Network failures expire the server lease, never surface as saves. */ }
      finally { clearTimeout(timeout); }
    };
    const tick = () => {
      if (pending || stopped) return;
      pending = true;
      tail = send(true).finally(() => { pending = false; });
    };
    tick();
    const heartbeat = setInterval(tick, 30000);
    return () => {
      stopped = true; clearInterval(heartbeat); leaveLocal();
      // Serialize exit after the last heartbeat. Old exits cannot close a new visit.
      void tail.then(() => send(false));
    };
  }, [active, userId, game]);
}
