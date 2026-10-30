import { APP_TABLES, AppTable, appReadPlan } from './appReadPlan';
import { throwIfAborted } from '../utils/abort';
import { createDataStore, DataStore, reconcileRows, sameJSON } from './dataStore';
import { journeyDistance } from '../features/journeys/model';
import { VISIT_SUMMARY_COLUMNS } from '../services/readProjections';
import { useSelectedStore } from './useSelectedStore';
import { useAppForeground } from '../hooks/useActivity';
import { trackResult } from '../services/saveState';
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from './Auth';
import { Visit, Expense, Settlement, DailyAnswer, VisitBucketLink } from '../types/travel';
import { BucketItem } from '../types/bucket';
import { PulseLog } from '../types/pulse';
import { UserStatus, isUserStatus } from '../types/status';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { RowChange, useRealtimeRows } from '../hooks/useRealtimeRows';
import { isChoiceRow, mergeChoiceRows } from './gameRows';
import { readPagedRows } from '../services/pagedRows';
import { visitGeographyPatch } from '../services/visitGeography';
import { dateOnly, localDateStr } from '../utils/dates';
import { useToast } from '../ui/Toast';
import { syncVisitReminders } from '../services/notification';
import { activateLocalReminders, deactivateLocalReminders } from '../services/localReminderSession';
import { romeDay,togetherState } from '../utils/together';
import { isVisitConcluded as isConcluded } from '../utils/visitLifecycle';

export interface AppData {
  userId: string;
  partnerId: string;
  loaded: boolean;
  loadError: string | null;
  today: string;
  visits: Visit[];
  expenses: Expense[];
  settlements: Settlement[];
  bucket: BucketItem[];
  visitBucket: VisitBucketLink[];
  answers: DailyAnswer[];
  myCity: string;
  partnerCity: string;
  myStatus: UserStatus | null;
  partnerStatus: UserStatus | null;
  names: Record<string, string>;
  lastPartnerPulse: PulseLog | null;
  partnerPulseReplied: boolean;
  pulsesToday: number;
  totalTravelKm: number;
  refresh: (tables?: readonly AppTable[]) => Promise<void>;
  changeMyStatus: (s: UserStatus | null, minutes?:number) => Promise<void>;
  acceptDailyAnswer: (answer: DailyAnswer) => void;
}

const Ctx = createContext<DataStore<AppData> | null>(null);
const identity = (value: AppData) => value;
export function useAppDataFields<K extends keyof AppData>(fields: readonly K[]): Pick<AppData, K> {
  const store = useContext(Ctx); if (!store) throw new Error('useAppData fuori da AppDataProvider');
  const key = fields.join(',');
  const selector = useMemo(() => { const keys = key.split(',') as K[]; return (value: AppData) => Object.fromEntries(keys.map(name => [name, value[name]])) as Pick<AppData, K>; }, [key]);
  return useSelectedStore(store, selector);
}
export function useAppData() {
  const store = useContext(Ctx); if (!store) throw new Error('useAppData fuori da AppDataProvider');
  return useSelectedStore(store, identity);
}

export { isVisitConcluded as isConcluded } from '../utils/visitLifecycle';

const ScopedAppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useToast();
  const foreground = useAppForeground();
  // L'identità arriva dall'account con cui si è effettuato l'accesso (non dalla piattaforma del dispositivo).
  // Questo provider viene montato solo dopo il login, quindi il profilo c'è sempre.
  const { profile } = useAuth();
  const userId = profile?.id ?? '';
  const partnerId = profile?.partnerId ?? '';
  useLayoutEffect(() => {
    activateLocalReminders(userId);
    return () => deactivateLocalReminders();
  }, [userId]);

  // La data corrente è uno stato: se l'app resta aperta a cavallo della mezzanotte, giorno, domande e incontri si aggiornano
  const [today, setToday] = useState(()=>romeDay(Date.now()));
  const [clock,setClock]=useState(()=>Date.now());
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string|null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [bucket, setBucket] = useState<BucketItem[]>([]);
  const [visitBucket, setVisitBucket] = useState<VisitBucketLink[]>([]);
  const [answers, setAnswers] = useState<DailyAnswer[]>([]);
  const [myCity, setMyCity] = useState('');
  const [partnerCity, setPartnerCity] = useState('');
  const [myStatus, setMyStatus] = useState<UserStatus | null>(null);
  const [partnerStatus, setPartnerStatus] = useState<UserStatus | null>(null);
  const [statusExpiry,setStatusExpiry]=useState<{mine:number;partner:number}>({mine:Infinity,partner:Infinity});
  const [names, setNames] = useState<Record<string, string>>({});
  const [lastPartnerPulse, setLastPartnerPulse] = useState<PulseLog | null>(null);
  const [partnerPulseReplied, setPartnerPulseReplied] = useState(false);
  const [pulsesToday, setPulsesToday] = useState(0);

  const tried = useRef<Set<string>>(new Set());
  const refreshing = useRef(false);
  const readRequest = useRef<AbortController | null>(null);
  const queued = useRef(new Set<AppTable>());
  const snapshots = useRef<Record<string, any[]>>({});
  const answerVersion = useRef(0);
  const answerEvents = useRef(new Map<string, { version: number; answer: DailyAnswer }>());
  const liveOwner = useRef<string | null>(null);
  useEffect(() => { liveOwner.current = userId; return () => { liveOwner.current = null; }; }, [userId]);
  const initialized = useRef(false);
  const waiting = useRef<(() => void)[]>([]);
  const refreshAgain=useRef<(tables?: readonly AppTable[])=>Promise<void>>(async()=>{});

  const refresh = useCallback(async (tables?: readonly AppTable[]) => {
    const needed = appReadPlan(tables, initialized.current);
    if (!foreground) return;
    // Evita fetch sovrapposti: se arriva un evento mentre carichiamo, ne rifacciamo uno solo alla fine
    if (refreshing.current) {
      needed.forEach(table => queued.current.add(table));
      await new Promise<void>(resolve => waiting.current.push(resolve));
      return;
    }
    refreshing.current = true;
    const controller = new AbortController(); readRequest.current = controller;
    try {
      const readingAnswersAt = answerVersion.current;
      const today = romeDay(Date.now());
      const results = await Promise.all(needed.map(async table => {
        const keys = table === 'visit_bucket_items' ? ['visit_id', 'bucket_item_id'] : table === 'couple_settings' ? ['user_id'] : ['id'];
        const result = await readPagedRows((from, to) => {
          let query = supabase.from(table).select(table === 'users' ? 'id,name,current_status,status_expires_at' : table === 'visits' ? VISIT_SUMMARY_COLUMNS : '*');
          if (table === 'visits') query = query.order('start_date', { ascending: true });
          if (table === 'bucket_list' || table === 'pulse_logs') query = query.order('created_at', { ascending: false });
          for (const key of keys) query = query.order(key);
          return query.range(from, to).abortSignal(controller.signal);
        }, controller.signal, keys, table === 'pulse_logs' ? 100 : Infinity);
        return { table, ...result };
      }));
      throwIfAborted(controller.signal);
      const failure = results.find(result => result.error)?.error;
      if (failure) throw new Error(failure.message);
      for (const result of results) {
        let rows: unknown[] = result.data ?? [];
        if (result.table === 'daily_answers') {
          // Preserve the history read from the server while applying only events
          // received since that read began; an old snapshot cannot erase a choice.
          for (const event of answerEvents.current.values()) if (event.version > readingAnswersAt) rows = mergeChoiceRows(rows as DailyAnswer[], event.answer);
          answerEvents.current.clear();
        }
        snapshots.current[result.table] = rows;
      }
      const read = (table: AppTable) => ({ data: needed.includes(table) ? snapshots.current[table] : null });
      const vRes=read('visits'), eRes=read('trip_expenses'), sRes=read('settlements'), bRes=read('bucket_list'), vbRes=read('visit_bucket_items'), cRes=read('couple_settings'), uRes=read('users'), pRes=read('pulse_logs'), aRes=read('daily_answers');

      let my = '';
      let partner = '';
      if (cRes.data) {
        const mine = cRes.data.find((s: any) => s.user_id === userId);
        const other = cRes.data.find((s: any) => s.user_id !== userId);
        my = mine?.city || '';
        partner = other?.city || '';
        setMyCity(my);
        setPartnerCity(partner);
      }
      if (eRes.data) setExpenses(previous => reconcileRows(previous, eRes.data as Expense[]));
      if (sRes.data) setSettlements(previous => reconcileRows(previous, sRes.data as Settlement[]));
      if (bRes.data) setBucket(previous => reconcileRows(previous, bRes.data as BucketItem[]));
      const links = (snapshots.current.visit_bucket_items || []) as VisitBucketLink[];
      if (vbRes.data) setVisitBucket(previous => reconcileRows(previous, links));
      if (aRes.data) setAnswers(previous => reconcileRows(previous, aRes.data as DailyAnswer[]));

      if (uRes.data) {
        const nm: Record<string, string> = {};
        uRes.data.forEach((u: any) => {
          if (u.name) nm[u.id] = u.name;
        });
        setNames(previous => sameJSON(previous, nm) ? previous : nm);
        const me = uRes.data.find((u: any) => u.id === userId);
        const other = uRes.data.find((u: any) => u.id === partnerId);
        const active=(u:any)=>u&&(!u.status_expires_at||Date.parse(u.status_expires_at)>Date.now())&&isUserStatus(u.current_status)?u.current_status:null;
        setMyStatus(active(me));
        setPartnerStatus(active(other));
        setStatusExpiry({mine:me?.status_expires_at?Date.parse(me.status_expires_at):Infinity,partner:other?.status_expires_at?Date.parse(other.status_expires_at):Infinity});
      }

      if (pRes.data) {
        const pulses = pRes.data as PulseLog[];
        const fromPartner = pulses.filter((p) => p.sender_id === partnerId);
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        setLastPartnerPulse(previous => sameJSON(previous, fromPartner[0] || null) ? previous : fromPartner[0] || null);
        setPulsesToday(fromPartner.filter((p) => new Date(p.created_at) >= start).length);
        setPartnerPulseReplied(
          !!fromPartner[0] && pulses.some((p) => p.sender_id === userId && p.reply_to === fromPartner[0].id)
        );
      }

      if (vRes.data) {
        // visits.start_date/end_date sono timestamptz: nell'app usiamo date YYYY-MM-DD
        let list = (vRes.data as Visit[]).map((v) => ({
          ...v,
          start_date: dateOnly(v.start_date),
          end_date: dateOnly(v.end_date),
        }));

        // Incontro terminato → "Concluso" + desideri collegati spuntati nella bucket list
        const toConclude = list.filter((v) => v.timing_mode !== 'manual' && v.end_date < today && v.status !== 'concluded');
        if (toConclude.length) {
          const ids = toConclude.map((v) => v.id);
          list = list.map((v) => (ids.includes(v.id) ? { ...v, status: 'concluded' as const } : v));
          await supabase.from('visits').update({ status: 'concluded' }).in('id', ids).eq('timing_mode', 'scheduled');
          throwIfAborted(controller.signal);
          const bucketIds = links.filter((l) => ids.includes(l.visit_id)).map((l) => l.bucket_item_id);
          if (bucketIds.length) {
            const result = await supabase.from('bucket_list').update({ is_completed: true }).in('id', bucketIds);
            throwIfAborted(controller.signal);
            if (result.error) throw new Error(result.error.message);
            const completed = (snapshots.current.bucket_list || []).map(item => bucketIds.includes(item.id) ? { ...item, is_completed: true } : item) as BucketItem[];
            snapshots.current.bucket_list = completed;
            setBucket(previous => reconcileRows(previous, completed));
          }
        }
        setVisits(previous => reconcileRows(previous, list));

      }
      throwIfAborted(controller.signal);
      initialized.current = true;
      setLoaded(true);
      setLoadError(null);
    } catch (e) {
      if (controller.signal.aborted) return;
      console.error('Errore caricamento dati:', e);
      setLoadError(e instanceof Error?e.message:'Impossibile caricare i dati');
      setLoaded(true);
    } finally {
      if (readRequest.current === controller) readRequest.current = null;
      refreshing.current = false;
      if (queued.current.size) {
        const batch = [...queued.current]; queued.current.clear();
        await refreshAgain.current(batch);
      } else {
        const callbacks = waiting.current.splice(0); callbacks.forEach(resolve => resolve());
      }
    }
  }, [userId, partnerId, foreground]);
  useEffect(()=>{refreshAgain.current=refresh;},[refresh]);

  useEffect(() => {
    const initial=setTimeout(()=>{void refresh();},0);
    const reads = readRequest;
    const pending = queued.current;
    return()=>{ clearTimeout(initial); pending.clear(); reads.current?.abort(); };
  }, [refresh]);

  // Controllo del cambio di giorno (una volta al minuto): ricarica i dati quando la data cambia
  useEffect(() => {
    if (!foreground) return;
    const id = setInterval(() => {
      const instant=Date.now();setClock(instant);
      const now = romeDay(instant);
      setToday((prev) => (prev === now ? prev : now));
    }, 60000);
    return () => clearInterval(id);
  }, [foreground]);

  const firstDay = useRef(true);
  useEffect(() => {
    if (firstDay.current) {
      firstDay.current = false;
      return;
    }
    void refreshAgain.current();
  }, [today]);
  // Sincronizzazione in tempo reale col partner
  useRealtimeRefresh(
    APP_TABLES.filter(table => table !== 'daily_answers'),
    (changed) => { void refresh(changed as AppTable[] | undefined); }
  );
  const acceptDailyAnswer = useCallback((answer: DailyAnswer) => {
    if (liveOwner.current !== userId || !foreground || typeof answer?.id !== 'string' || !isChoiceRow(answer, [userId, partnerId]) || answer.choice > 3) return;
    answerVersion.current++;
    answerEvents.current.set(`${answer.day.slice(0, 10)}:${answer.user_id}`, { version: answerVersion.current, answer });
    const next = mergeChoiceRows((snapshots.current.daily_answers ?? []) as DailyAnswer[], answer);
    snapshots.current.daily_answers = next;
    setAnswers(previous => reconcileRows(previous, next));
  }, [userId, partnerId, foreground]);
  const onDailyRow = useCallback((event: RowChange) => {
    if (event.eventType === 'DELETE') { void refresh(['daily_answers']); return; }
    acceptDailyAnswer(event.new as unknown as DailyAnswer);
  }, [acceptDailyAnswer, refresh]);
  const onDailyReconnect = useCallback(() => { void refresh(['daily_answers']); }, [refresh]);
  useRealtimeRows(['daily_answers'], userId, foreground, onDailyRow, onDailyReconnect);

  useEffect(() => {
    if (!loaded || loadError) return;
    syncVisitReminders(visits, visitId => bucket.filter(item => !item.is_completed &&
      visitBucket.some(link => link.visit_id === visitId && link.bucket_item_id === item.id))
      .map(item => item.title).slice(0, 2), today);
  }, [visits, bucket, visitBucket, today, loaded, loadError]);

  // Geography enriches the loaded visits independently of the initial read.
  // A slow/offline external service must never keep the application loading.
  useEffect(() => {
    if (!loaded || !foreground || !userId || !partnerId) return;
    const controller = new AbortController();
    const attempts = tried;
    const started = new Set<string>();
    const missing = visits.filter(v => (v.meeting_point || v.location) &&
      (v.meeting_lat == null || v.meeting_lon == null || v.travel_km == null) && !attempts.current.has(v.id)).slice(0, 3);
    void (async () => {
      for (const visit of missing) {
        if (controller.signal.aborted) return;
        attempts.current.add(visit.id); started.add(visit.id);
        try {
          const patch = await visitGeographyPatch(visit, myCity, partnerCity, controller.signal);
          throwIfAborted(controller.signal);
          if (Object.keys(patch).length) {
            // Do not abort a write whose server outcome may already be committed.
            let write = supabase.from('visits').update(patch).eq('id', visit.id);
            // A place edited while the geocoder was running must not receive
            // coordinates/distances computed for the old place.
            for (const field of ['location', 'meeting_point', 'meeting_lat', 'meeting_lon', 'travel_km'] as const) {
              const value = visit[field];
              write = value == null ? write.is(field, null) : write.eq(field, value);
            }
            const { error, data } = await write.select('id');
            if (error) throw new Error(error.message);
            if (!controller.signal.aborted && data?.length) {
              setVisits(previous => previous.map(current => current.id === visit.id &&
                (current.meeting_point || current.location) === (visit.meeting_point || visit.location)
                ? { ...current, ...patch } : current));
            }
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          console.warn('Geografia incontro non disponibile:', error);
        }
      }
    })();
    return () => { controller.abort(); for (const id of started) attempts.current.delete(id); };
  }, [visits, myCity, partnerCity, loaded, foreground, userId, partnerId]);

  const changeMyStatus = useCallback(
    async (status: UserStatus | null, minutes?:number) => {
      const previous = myStatus;
      setMyStatus(status); // aggiornamento ottimistico
      const { error } = await trackResult(() => supabase.rpc('set_my_status',{p_status:status,p_minutes:minutes??null}));
      if (error) {
        setMyStatus(previous);
        toast.error('Impossibile aggiornare lo stato: ' + error.message);
      }
      else await refresh(['users']);
    },
    [myStatus, toast, refresh]
  );

  const totalTravelKm = useMemo(
    () => visits.filter((v) => isConcluded(v, today)).reduce((s, v) => s + (journeyDistance(v).totalKm ?? 0), 0),
    [visits, today]
  );

  const value = useMemo<AppData>(() => ({
    userId,
    partnerId,
    loaded,
    loadError,
    today,
    visits,
    expenses,
    settlements,
    bucket,
    visitBucket,
    answers,
    myCity,
    partnerCity,
    myStatus:(clock<statusExpiry.mine?myStatus:null)??(togetherState(visits,null,clock).active?'together':null),
    partnerStatus:(clock<statusExpiry.partner?partnerStatus:null)??(togetherState(visits,null,clock).active?'together':null),
    names,
    lastPartnerPulse,
    partnerPulseReplied,
    pulsesToday,
    totalTravelKm,
    refresh,
    changeMyStatus,
    acceptDailyAnswer,
  }), [userId, partnerId, loaded, loadError, today, visits, expenses, settlements, bucket, visitBucket, answers, myCity, partnerCity, clock, statusExpiry, myStatus, partnerStatus, names, lastPartnerPulse, partnerPulseReplied, pulsesToday, totalTravelKm, refresh, changeMyStatus, acceptDailyAnswer]);

  // createDataStore only retains the snapshot; it never invokes refresh or reads
  // the refs captured by that callback. The refs rule treats those closures as refs.
  // eslint-disable-next-line react-hooks/refs
  const [store] = useState(() => createDataStore(value));
  useLayoutEffect(() => { store.publish(value); }, [store, value]);
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
};

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  // A profile/pair switch remounts the store, cached rows and queued reads.
  return <ScopedAppDataProvider key={`${profile?.id ?? ''}:${profile?.partnerId ?? ''}`}>{children}</ScopedAppDataProvider>;
};
