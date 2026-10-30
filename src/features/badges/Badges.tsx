import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useAppDataFields } from '../../state/AppData';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { BottomSheet } from '../../ui/layout';
import { Button, T } from '../../ui/primitives';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { BadgeAward, BadgeDef, badgeMetrics } from './metrics';
import { useAppForeground } from '../../hooks/useActivity';
import { romeMoment } from '../../utils/together';
type Metrics = ReturnType<typeof badgeMetrics>;
interface State {
    defs: BadgeDef[];
    awards: BadgeAward[];
    metrics: Metrics;
    unseen: BadgeAward[];
    error: string | null;
    loading: boolean;
    refresh: () => Promise<void>;
    markSeen: () => Promise<void>;
    enabled: boolean;
    serverDay: string | null;
}
const Context = createContext<State | null>(null);
export function useBadges() { const value = useContext(Context); if (!value)
    throw new Error('BadgesProvider mancante'); return value; }
export function BadgesProvider({ children }: {
    children: React.ReactNode;
}) {

    const d = useAppDataFields(['answers', 'bucket', 'loaded', 'settlements', 'today', 'userId', 'visits']);
    const foreground = useAppForeground();
    const [serverClock, setServerClock] = useState<{ day: string; instant: number; receivedAt: number } | null>(null);
    const serverDay = serverClock?.day ?? null;
    const defs = useFeatureRows<BadgeDef>('badge_defs', undefined, 'sort', Infinity, false);
    const awards = useFeatureRows<BadgeAward>('badge_awards', undefined, 'awarded_at');
    const reads = useFeatureRows<{
        last_seen_at: string;
    }>('badge_reads', { column: 'user_id', value: d.userId }, '');
    const prefs = useFeatureRows<{
        badges_enabled: boolean;
    }>('feature_preferences', { column: 'user_id', value: d.userId }, '');
    const refreshDefs = defs.refresh;
    const refreshAwards = awards.refresh;
    const refreshReads = reads.refresh;
    const refreshPrefs = prefs.refresh;
    const [pulses, setPulses] = useState<{
        day: string;
        count: number;
        sender_ids?: string[];
    }[]>([]);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dismissed, setDismissed] = useState('');
    const loadHistory = useCallback(async () => { try {
        const history = await featureRpc<{
            day: string;
            count: number;
            sender_ids?: string[];
            server_day?: string;
            server_now?: string;
        }[]>('badge_pulse_history', {}, false);
        const clock = history.find(row => row.server_day && row.server_now);
        if (clock && /^\d{4}-\d{2}-\d{2}$/.test(clock.server_day!) && Number.isFinite(Date.parse(clock.server_now!)))
            setServerClock({ day: clock.server_day!, instant: Date.parse(clock.server_now!), receivedAt: performance.now() });
        setPulses(history);
        setHistoryLoaded(true);
        setError(null);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Conteggi non disponibili');
    } }, []);
    useEffect(() => { if (!foreground) return; const initial = setTimeout(() => { void loadHistory(); }, 0); return () => clearTimeout(initial); }, [loadHistory, foreground]);
    useEffect(() => {
        if (!foreground || !serverClock) return;
        const nextDay = new Date(Date.parse(serverClock.day + 'T12:00:00Z') + 86400000).toISOString().slice(0,10);
        const remaining = romeMoment(nextDay, '00:00') - serverClock.instant - Math.max(0, performance.now() - serverClock.receivedAt);
        const timer = setTimeout(() => { void loadHistory(); }, Math.max(1000, remaining + 250));
        return () => clearTimeout(timer);
    }, [foreground, serverClock, loadHistory]);
    useRealtimeRefresh(['pulse_logs'], loadHistory);
    const metrics = useMemo(() => badgeMetrics(d.visits, d.settlements, d.answers, d.bucket, pulses, d.today, serverDay ?? '0000-01-01'), [d.visits, d.settlements, d.answers, d.bucket, pulses, d.today, serverDay]);
    const refresh = useCallback(async () => { await Promise.all([refreshDefs(), refreshAwards(), refreshReads(), refreshPrefs(), loadHistory()]); }, [refreshDefs, refreshAwards, refreshReads, refreshPrefs, loadHistory]);
    useEffect(() => {
        if (!d.loaded || !historyLoaded || defs.loading || awards.loading || defs.error || awards.error)
            return;
        const pending = defs.rows.flatMap(def => { if (!def.metric || !def.threshold)
            return []; const day = metrics.earned(def.metric, Number(def.threshold)); return day ? [{ badge_id: def.id, earned_on: day }] : []; })
            .concat(metrics.secrets).filter(item => !awards.rows.some(a => a.badge_id === item.badge_id));
        if (!pending.length)
            return;
        let alive = true;
        void featureRpc('award_badges', { p_awards: pending.slice(0, 30) }, false).then(() => { if (alive)
            void refreshAwards(); }).catch(e => { if (alive)
            setError(e.message); });
        return () => { alive = false; };
    }, [d.loaded, historyLoaded, defs.loading, defs.error, defs.rows, awards.loading, awards.error, awards.rows, refreshAwards, metrics]);
    const lastSeen = reads.rows[0]?.last_seen_at ?? '2000-01-01';
    const unseen = awards.rows.filter(a => a.awarded_at > lastSeen);
    const enabled = prefs.rows[0]?.badges_enabled !== false;
    const signature = unseen.map(a => a.badge_id).sort().join(',');
    const markSeen = async () => { setDismissed(signature); try {
        await featureRpc('mark_badges_seen');
        await refreshReads();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Impossibile aggiornare i traguardi letti');
    } };
    return <Context.Provider value={{ defs: defs.rows, awards: awards.rows, metrics, unseen, error: defs.error ?? awards.error ?? error, loading: defs.loading || awards.loading, refresh, markSeen, enabled, serverDay }}>
  {children}
  <BottomSheet visible={enabled && unseen.length > 0 && dismissed !== signature && !reads.loading && !reads.error && !prefs.loading && !prefs.error} title="Ce l’avete fatta! 🏅" onClose={() => { void markSeen(); }}>
   <T v="h2">{unseen.length === 1 ? 'Un nuovo traguardo insieme' : `${unseen.length} traguardi sbloccati insieme`}</T>
   {unseen.slice(0, 5).map(a => <T key={a.badge_id}>{defs.rows.find(def => def.id === a.badge_id)?.title ?? 'Un traguardo segreto'} · {a.earned_on}</T>)}
   <Button label="Vedi i traguardi" onPress={() => { void markSeen(); router.push('/badge'); }}/><Button variant="ghost" label="Continua" onPress={() => { void markSeen(); }}/>
  </BottomSheet>
 </Context.Provider>;
}
