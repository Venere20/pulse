import { featureReadCache, readKey } from '../services/featureReadCache';
import { FEATURE_PROJECTIONS } from '../services/readProjections';
import { throwIfAborted } from '../utils/abort';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../config/supabase';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { trackResult } from '../services/saveState';
import { useScreenActive } from '../hooks/useActivity';
import { useAuth } from '../state/Auth';
import { transientReadFailure } from '../utils/recovery';
const EMPTY_ROWS: never[] = [];
export async function featureRpc<T = unknown>(name: string, args: Record<string, unknown> = {}, trackSave = true, signal?: AbortSignal): Promise<T> {
    if (trackSave && signal) throw new Error('Non annullare automaticamente un salvataggio');
    const action = () => { const query = supabase.rpc(name, args); return signal ? query.abortSignal(signal) : query; };
    const { data, error } = await (trackSave ? trackResult(action) : action());
    if (error)
        throw new Error(error.message);
    return data as T;
}
/** Each screen owns its data; discard late responses after unmount or a refetch. */
export function useFeatureRows<T>(table: string, filter?: {
    column: string;
    value: string | null;
}, order = 'created_at', maxRows = Infinity, realtime = true, enabled = true) {
    const { profile } = useAuth();
    const owner = profile?.id ?? '';
    const column = filter && (filter.value === null || filter.value) ? filter.column : undefined;
    const value = column ? filter?.value : undefined;
    const spec = { owner, table, column, value, order, maxRows };
    const key = readKey(spec);
    const [stored, setStored] = useState<{ key: string; rows: T[] }>(() => ({ key, rows: featureReadCache.peek<T>(spec) ?? [] }));
    const [error, setError] = useState<string | null>(null);
    const [errorCode, setErrorCode] = useState<string | null>(null);
    const [confirmedKey, setConfirmedKey] = useState<string | null>(() => featureReadCache.peek<T>(spec) ? key : null);
    const [loading, setLoading] = useState(true);
    const screenActive = useScreenActive();
    const active = screenActive && enabled;
    const activeRef = useRef(active);
    useEffect(() => { activeRef.current = active; }, [active]);
    const generation = useRef(0);
    const request = useRef<AbortController | null>(null);
    const liveKey = useRef<string | null>(null);
    useEffect(() => { liveKey.current = key; return () => { liveKey.current = null; }; }, [key]);
    const health = useRef({ failures: 0, retryable: false });
    const readHealth = useCallback(() => ({ ...health.current, busy: request.current !== null }), []);
    const refresh = useCallback(async (fresh = true) => {
        if (!activeRef.current || !owner) return;
        request.current?.abort();
        const controller = new AbortController(); request.current = controller;
        const ticket = ++generation.current;
        try {
            const rows = await featureReadCache.get<T>({ owner, table, column, value, order, maxRows }, async signal => {
            const collected: T[] = [];
            for (let offset = 0;; offset += 500) {
                let query = supabase.from(table).select(FEATURE_PROJECTIONS[table] ?? '*');
                if (column && value !== undefined)
                    query = value === null ? query.is(column, null) : query.eq(column, value);
                if (order)
                    query = query.order(order, { ascending: false });
                const keys: Record<string, string[]> = { date_votes: ['option_id', 'user_id'], date_proposal_wishes: ['proposal_id', 'bucket_item_id'], deep_talk_marks: ['week_start', 'q_index', 'user_id'], fridge_reactions: ['note_id', 'user_id'], packing_progress: ['visit_id', 'owner_id'], badge_awards: ['badge_id'], badge_reads: ['user_id'], feature_preferences: ['user_id'], fridge_reads: ['user_id'] };
                for (const key of keys[table] ?? ['id'])
                    if (key !== order) query = query.order(key);
                const result = await query.range(offset, Math.min(offset + 499, maxRows - 1)).abortSignal(signal);
                throwIfAborted(signal);
                if (result.error)
                    throw Object.assign(new Error(result.error.message), { status: result.status, code: result.error.code });
                collected.push(...(result.data as T[]));
                if (result.data.length < 500 || offset + 500 >= maxRows)
                    break;
            }
            return collected;
            }, controller.signal, fresh);
            if (controller.signal.aborted || ticket !== generation.current) return;
            setError(null);
            setErrorCode(null);
            setConfirmedKey(key);
            health.current = { failures: 0, retryable: false };
            setStored(previous => previous.key === key && previous.rows === rows ? previous : { key, rows });
        }
        catch (e) {
            if (!controller.signal.aborted && ticket === generation.current && (e as { name?: string })?.name !== 'AbortError') {
                health.current = { failures: health.current.failures + 1, retryable: transientReadFailure(e) };
                setError(e instanceof Error ? e.message : 'Dati non disponibili');
                setErrorCode((e as { code?: string })?.code ?? null);
            }
        }
        finally {
            if (!controller.signal.aborted && ticket === generation.current)
                setLoading(false);
            if (request.current === controller) request.current = null;
        }
    }, [table, column, value, order, maxRows, owner, key]);
    useEffect(() => { const counter = generation; const reads = request; if (!active) { counter.current++; reads.current?.abort(); return; } const initial = setTimeout(() => { void refresh(false); }, 0); return () => { clearTimeout(initial); counter.current++; reads.current?.abort(); }; }, [refresh, active]);
    const updateRows = useCallback((change: (rows: T[]) => T[]) => {
        if (!activeRef.current || !owner || liveKey.current !== key) return;
        const rows = featureReadCache.update<T>({ owner, table, column, value, order, maxRows }, change);
        setStored(previous => previous.key === key && previous.rows === rows ? previous : { key, rows });
        health.current = { failures: 0, retryable: false };
        setError(null); setErrorCode(null); setConfirmedKey(key); setLoading(false);
        // A row event received during the first load is only a partial snapshot.
        // Revalidate the whole query so existing history is not lost.
        if (!featureReadCache.complete({ owner, table, column, value, order, maxRows })) void refresh(true);
    }, [owner, table, column, value, order, maxRows, key, refresh]);
    const realtimeConnected = useRealtimeRefresh(realtime && enabled ? [table] : [], () => { void refresh(true); });
    return { rows: stored.key === key ? stored.rows : EMPTY_ROWS, error, errorCode, hasSnapshot: confirmedKey === key, loading, refresh, readHealth, updateRows, realtimeConnected };
}
