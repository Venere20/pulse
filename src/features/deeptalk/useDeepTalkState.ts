import { useCallback, useEffect, useRef, useState } from 'react';
import { RowChange, useRealtimeRows } from '../../hooks/useRealtimeRows';
import { reconcileRows } from '../../state/dataStore';
import { featureRpc } from '../useFeatureRows';

export interface DeepTalkMark { week_start: string; q_index: number; user_id: string; deck_id: string; status: string; discussed_at: string | null }
export interface DeepTalkAnswer { week_start: string; q_index: number; user_id: string; body: string; reaction: string | null }
interface Snapshot { week_start: string; revision: number; marks: DeepTalkMark[]; answers: DeepTalkAnswer[] }
interface ViewState { key: string; snapshot: Snapshot | null; error: string | null; loading: boolean }
const EMPTY: never[] = [];
function permittedSnapshot(value: unknown, week: string, users: string[]): value is Snapshot {
  const s = value as Snapshot | null;
  return !!s && s.week_start === week && Number.isSafeInteger(s.revision) && s.revision >= 0 && Array.isArray(s.marks) && Array.isArray(s.answers) &&
    s.marks.every(m => users.includes(m.user_id) && typeof m.week_start === 'string' && Number.isInteger(m.q_index) && m.q_index >= 0 && m.q_index <= 2) &&
    s.answers.every(a => users.includes(a.user_id) && a.week_start === week && typeof a.body === 'string' && Number.isInteger(a.q_index) && a.q_index >= 0 && a.q_index <= 2);
}

/** Private bodies stay only in the focused component, never in shared cache.
 * Public versions invalidate old reads and identify delayed mutation replies. */
export function useDeepTalkState(owner: string, partner: string, week: string, active: boolean) {
  const key = `${owner}:${partner}:${week}`;
  const [view, setView] = useState<ViewState>({ key, snapshot: null, error: null, loading: true });
  const live = useRef<{ key: string; active: boolean } | null>(null);
  const reading = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const mutation = useRef(0);
  const mutating = useRef(false);
  const connection = useRef(0);
  const observed = useRef(new Map<string, number>());
  const confirmed = useRef(new Map<string, number>());
  const dirty = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scopeMatches = useCallback(() => live.current?.key === key && live.current.active, [key]);
  const clearPrivate = useCallback(() => {
    if (!scopeMatches()) return;
    generation.current++; reading.current?.abort();
    setView(previous => previous.key === key && previous.snapshot ? { ...previous, snapshot: { ...previous.snapshot, answers: previous.snapshot.answers.filter(a => a.user_id === owner) } } : previous);
  }, [key, owner, scopeMatches]);
  const apply = useCallback((snapshot: Snapshot) => {
    if (!scopeMatches() || snapshot.revision < Math.max(observed.current.get(week) ?? 0, confirmed.current.get(week) ?? 0)) return false;
    confirmed.current.set(week, snapshot.revision);
    dirty.current.delete(week);
    setView(previous => ({ key, error: null, loading: false, snapshot: {
      ...snapshot,
      marks: reconcileRows(previous.key === key ? previous.snapshot?.marks ?? [] : [], snapshot.marks),
      answers: reconcileRows(previous.key === key ? previous.snapshot?.answers ?? [] : [], snapshot.answers),
    } }));
    return true;
  }, [key, week, scopeMatches]);
  const refresh = useCallback(async () => {
    if (!scopeMatches() || !owner) return;
    reading.current?.abort(); const controller = new AbortController(); reading.current = controller;
    const ticket = ++generation.current;
    setView(previous => previous.key === key ? { ...previous, error: null, loading: !previous.snapshot, snapshot: previous.snapshot ? { ...previous.snapshot, answers: [] } : null } : { key, snapshot: null, error: null, loading: true });
    try {
      const result = await featureRpc<Snapshot>('deep_talk_snapshot', { p_week: week }, false, controller.signal);
      if (!scopeMatches() || controller.signal.aborted || ticket !== generation.current) return;
      if (!permittedSnapshot(result, week, [owner, partner])) throw new Error('Risposte non disponibili: riprova');
      if (apply(result)) dirty.current.clear();
    } catch (error) {
      if (!scopeMatches() || controller.signal.aborted || ticket !== generation.current) return;
      setView(previous => ({ ...previous, key, loading: false, error: error instanceof Error ? error.message : 'Risposte non disponibili' }));
    } finally { if (reading.current === controller) reading.current = null; }
  }, [key, owner, partner, week, scopeMatches, apply]);
  const schedule = useCallback(() => {
    if (!scopeMatches()) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; if (!mutating.current) void refresh(); }, 40);
  }, [scopeMatches, refresh]);
  useEffect(() => {
    const lifecycle = live, reads = reading, counter = generation, mutations = mutation, pending = mutating, timers = timer;
    lifecycle.current = { key, active }; counter.current++; mutations.current++; pending.current = false;
    observed.current.clear(); confirmed.current.clear(); dirty.current.clear();
    if (active) timers.current = setTimeout(() => { void refresh(); }, 0);
    return () => { lifecycle.current = null; counter.current++; mutations.current++; if (timers.current) clearTimeout(timers.current); reads.current?.abort(); };
  }, [key, active, refresh]);
  const onRow = useCallback((event: RowChange) => {
    if (!scopeMatches()) return;
    const changedWeek = String(event.new.week_start ?? event.old.week_start ?? week);
    const revision = Number(event.new.revision);
    if (event.eventType === 'DELETE') { observed.current.clear(); confirmed.current.clear(); }
    else {
      if (!Number.isSafeInteger(revision) || revision < 0) { clearPrivate(); schedule(); return; }
      if (revision <= (confirmed.current.get(changedWeek) ?? -1)) return;
      observed.current.set(changedWeek, Math.max(observed.current.get(changedWeek) ?? 0, revision));
    }
    dirty.current.add(changedWeek); clearPrivate(); schedule();
  }, [week, scopeMatches, clearPrivate, schedule]);
  const onReconnect = useCallback(() => { connection.current++; clearPrivate(); dirty.current.add(week); schedule(); }, [week, clearPrivate, schedule]);
  useRealtimeRows(['deep_talk_versions'], owner, active, onRow, onReconnect);
  const act = useCallback(async (q: number, deck: string, action: string, body?: string) => {
    if (!scopeMatches() || mutating.current) return false;
    const ticket = ++mutation.current, connectedAt = connection.current; mutating.current = true;
    clearPrivate();
    try {
      const result = await featureRpc<Snapshot>('deep_talk_action_state', { p_week: week, p_q: q, p_deck: deck, p_action: action, p_body: body ?? null });
      if (!scopeMatches() || ticket !== mutation.current) return false;
      if (!permittedSnapshot(result, week, [owner, partner])) throw new Error('Stato delle risposte non disponibile');
      const accepted = connectedAt === connection.current && apply(result);
      if (accepted && !dirty.current.size && timer.current) { clearTimeout(timer.current); timer.current = null; }
      else if (!accepted) dirty.current.add(week);
      return true;
    } catch (error) {
      if (scopeMatches() && ticket === mutation.current) { clearPrivate(); dirty.current.add(week); throw error; }
      return false;
    } finally {
      if (ticket === mutation.current) { mutating.current = false; if (dirty.current.size) schedule(); }
    }
  }, [owner, partner, week, scopeMatches, clearPrivate, apply, schedule]);
  const current = view.key === key ? view : null;
  return { marks: current?.snapshot?.marks ?? EMPTY, answers: active ? current?.snapshot?.answers ?? EMPTY : EMPTY,
    error: current?.error ?? null, loading: current?.loading ?? true, refresh, act };
}
