import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase, VAPID_PUBLIC_KEY } from '../config/supabase';
import { suppressGameNotice } from './gameActivity';
import { deactivateLocalReminders, reminderSession, reminderSessionCurrent } from './localReminderSession';

// Setup Foreground Handler
Notifications.setNotificationHandler({
  handleNotification: async notification => {
    const quiet = suppressGameNotice(notification.request.content.data);
    return { shouldShowBanner: !quiet, shouldShowList: !quiet, shouldPlaySound: !quiet, shouldSetBadge: false };
  },
});

// Setup Canale Android a livello globale
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('pulse_alerts', {
    name: 'Avvisi Pulse',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF4D85',
  });
  Notifications.setNotificationChannelAsync('checkin_alerts', {
    name: "Check-in di arrivo", importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0,500,250,500], lightColor: '#FF4D85',
  });
}

// Il token push è uno solo per account: un emulatore collegato allo stesso account sovrascriverebbe quello del telefono vero.
// Di default registriamo solo dispositivi fisici; metti true per provare le push su un emulatore
// (tenendo presente che sostituisce il token del telefono).
export const ALLOW_PUSH_ON_EMULATOR = false;

// Stato di modulo: evita registrazioni doppie e ripetizioni inutili una volta riuscita.
let pushRegistered = false;
let pushRegistering = false;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** true se l'errore dipende dalla rete (offline, DNS non risolto, timeout) e quindi vale la pena riprovare. */
const isNetworkError = (error: unknown): boolean => {
  const msg = String((error as any)?.message ?? error ?? '').toLowerCase();
  return (
    msg.includes('unknownhostexception') ||
    msg.includes('unable to resolve host') ||
    msg.includes('network request failed') ||
    msg.includes('fetch failed') ||
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('failed to connect') ||
    msg.includes('no address associated')
  );
};

// Attese tra i tentativi (ms) quando manca la connessione.
const PUSH_RETRY_DELAYS = [2000, 5000, 15000];

/** Da chiamare al logout o al cambio account: la prossima registrazione riparte da zero. */
export function resetPushRegistration() {
  pushRegistered = false;
  pushRegistering = false;
}

/** Al logout: questo dispositivo non deve più ricevere le notifiche dell'account (best effort). */
export async function clearPushRegistration(userId: string) {
  deactivateLocalReminders();
  if (Platform.OS !== 'web') {
    await Promise.allSettled([
      Notifications.cancelAllScheduledNotificationsAsync(),
      Notifications.dismissAllNotificationsAsync(),
    ]);
  }
  try {
    await supabase.rpc('register_my_push',{p_kind:Platform.OS==='web'?'web':'native'});
  } catch (e) {}
  resetPushRegistration();
}

/**
 * Registra il token push Expo su Supabase.
 * Se la rete non è disponibile (es. `exp.host` non risolvibile) riprova alcune volte senza
 * mostrare l'errore rosso di LogBox; se fallisce comunque, richiamala quando l'app torna in
 * primo piano (vedi App.tsx): una volta riuscita, le chiamate successive non fanno nulla.
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<boolean> {
  if (Platform.OS === 'web' || !userId) return false;
  if (!Device.isDevice && !ALLOW_PUSH_ON_EMULATOR) {
    console.warn('Token push non registrato: emulatore (vedi ALLOW_PUSH_ON_EMULATOR in notification.ts).');
    return false;
  }
  if (pushRegistered) return true;
  if (pushRegistering) return false;
  pushRegistering = true;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return false;

    for (let attempt = 0; attempt <= PUSH_RETRY_DELAYS.length; attempt++) {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'a6ab1982-8aae-441d-a2fd-80b7767d80cd',
        });

        const { error } = await supabase.rpc('register_my_push',{p_kind:'native',p_token:tokenData.data});

        if (error) {
          console.warn('Token push ottenuto ma non salvato su Supabase:', error.message);
          return false;
        }

        pushRegistered = true;
        return true;
      } catch (error) {
        if (isNetworkError(error) && attempt < PUSH_RETRY_DELAYS.length) {
          await sleep(PUSH_RETRY_DELAYS[attempt]);
          continue;
        }
        // warn (non error): evita la schermata rossa di LogBox per un problema di sola connessione
        if (isNetworkError(error)) {
          console.warn('Registrazione token push rimandata: rete non disponibile. Riprovo al prossimo avvio/ritorno in primo piano.');
        } else {
          console.error('Errore registrazione token Android:', error);
        }
        return false;
      }
    }
    return false;
  } finally {
    pushRegistering = false;
  }
}

// ---------- Promemoria incontro 24h prima ----------
// Sull'app nativa i promemoria sono locali e vengono riallineati ad ogni aggiornamento dei dati
// (anche per gli incontri creati dal partner). Per la web app li invia la Edge Function `send-visit-reminders`.
// Se un giorno vuoi mandarli anche al telefono dal server, imposta false qui e SEND_EXPO_PUSH=true sulla funzione.
export const ENABLE_LOCAL_REMINDERS = true;

interface ReminderVisit {
  id: string;
  title: string;
  start_date: string;
  end_date?: string | null;
  arrival_time?: string | null;
  hotel?: string | null;
  location?: string | null;
  status?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
}

function noVisitReminder(visit: ReminderVisit) {
  return visit.status === 'concluded' || !!visit.ended_at || !!visit.started_at;
}

export async function getUpcomingBucketTitles(limit = 2): Promise<string[]> {
  const { data } = await supabase
    .from('bucket_list')
    .select('title')
    .or('is_completed.is.null,is_completed.eq.false')
    .order('created_at', { ascending: true })
    .limit(limit);
  return (data || []).map((r: { title: string }) => r.title);
}

export async function cancelVisitReminder(visitId: string) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`visit-${visitId}`);
  } catch (e) {}
}

const buildReminder = (visit: ReminderVisit, bucketTitles: string[]) => {
  const [y, m, d] = visit.start_date.slice(0, 10).split('-').map(Number);
  const when = new Date(y, m - 1, d - 1, 9, 0, 0);
  const parts: string[] = [];
  if (visit.arrival_time) parts.push(`Arrivo: ${visit.arrival_time}`);
  if (visit.hotel) parts.push(`Alloggio: ${visit.hotel}`);
  if (bucketTitles.length) parts.push(`Desideri: ${bucketTitles.slice(0, 2).join(', ')}`);
  return {
    when,
    title: `❤️ Domani: ${visit.title}`,
    body: parts.length ? parts.join(' · ') : 'Manca un giorno al vostro incontro!',
    start: visit.start_date.slice(0, 10),
  };
};

/** Pianifica (o ripianifica) la notifica locale 24h prima dell'inizio (alle 09:00 del giorno precedente). */
export async function scheduleVisitReminder(visit: ReminderVisit, bucketTitles: string[] = []) {
  if (Platform.OS === 'web' || !ENABLE_LOCAL_REMINDERS) return;
  const ticket = reminderSession();
  if (!reminderSessionCurrent(ticket)) return;
  if (noVisitReminder(visit)) { await cancelVisitReminder(visit.id); return; }

  const r = buildReminder(visit, bucketTitles);
  if (isNaN(r.when.getTime()) || r.when.getTime() <= Date.now()) {
    await cancelVisitReminder(visit.id);
    return;
  }

  try {
    await cancelVisitReminder(visit.id);
    if (!reminderSessionCurrent(ticket)) return;
    await Notifications.scheduleNotificationAsync({
      identifier: `visit-${visit.id}`,
      content: { title: r.title, body: r.body, data: { visitId: visit.id, start: r.start } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.when,
        channelId: 'pulse_alerts',
      },
    });
    if (!reminderSessionCurrent(ticket)) await cancelVisitReminder(visit.id);
  } catch (e) {
    console.error('Errore pianificazione promemoria:', e);
  }
}

/**
 * Riallinea i promemoria locali con gli incontri attuali: pianifica quelli nuovi o cambiati
 * (compresi quelli creati dal partner) e cancella quelli di incontri eliminati o già iniziati.
 */
export async function syncVisitReminders(
  visits: ReminderVisit[],
  wishTitles: (visitId: string) => string[],
  today: string
) {
  if (Platform.OS === 'web' || !ENABLE_LOCAL_REMINDERS) return;
  const ticket = reminderSession();
  if (!reminderSessionCurrent(ticket)) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    if (!reminderSessionCurrent(ticket)) return;
    const wanted = new Set<string>();

    for (const v of visits) {
      if (!reminderSessionCurrent(ticket)) return;
      if (v.start_date.slice(0, 10) <= today || noVisitReminder(v)) continue;
      const r = buildReminder(v, wishTitles(v.id));
      if (isNaN(r.when.getTime()) || r.when.getTime() <= Date.now()) continue;

      const id = `visit-${v.id}`;
      wanted.add(id);
      const existing = scheduled.find((n) => n.identifier === id);
      const same =
        existing &&
        existing.content.title === r.title &&
        existing.content.body === r.body &&
        (existing.content.data as { start?: string } | undefined)?.start === r.start;
      if (!same) await scheduleVisitReminder(v, wishTitles(v.id));
    }

    for (const n of scheduled) {
      if (n.identifier.startsWith('visit-') && !wanted.has(n.identifier)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch (e) {
    console.error('Errore sincronizzazione promemoria:', e);
  }
}

// ---------- Notifiche web (iPhone / browser) ----------
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/** true se siamo su iPhone/iPad nel browser (Safari) e l'app non è ancora stata aggiunta alla schermata Home. */
export function needsIosInstall(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);
  const standalone = (navigator as any).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  return isIos && !standalone;
}

export type WebPushResult = { ok: boolean; message: string };

export async function registerWebPush(userId: string): Promise<WebPushResult> {
  if (Platform.OS !== 'web') return { ok: false, message: 'Solo per la web app' };
  if (!userId) return { ok: false, message: 'Accedi per attivare le notifiche.' };

  if (needsIosInstall()) {
    return {
      ok: false,
      message: 'Su iPhone aggiungi prima l\'app alla schermata Home (Condividi → Aggiungi a Home), poi riapri da lì.',
    };
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { ok: false, message: 'Questo browser non supporta le notifiche push.' };
  }

  try {
    let permission = Notification.permission;
    if (permission !== 'granted') permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, message: 'Permesso notifiche negato: abilitalo dalle impostazioni del browser.' };

    await navigator.serviceWorker.register('/sw.js');
    const registration = await navigator.serviceWorker.ready;

    const wantedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    let subscription = await registration.pushManager.getSubscription();

    // Dopo una rotazione delle chiavi VAPID la vecchia sottoscrizione non è più valida: la rifacciamo da capo.
    if (subscription) {
      const current = subscription.options?.applicationServerKey;
      if (current) {
        const currentBytes = new Uint8Array(current);
        const same = currentBytes.length === wantedKey.length && currentBytes.every((b, i) => b === wantedKey[i]);
        if (!same) {
          await subscription.unsubscribe();
          subscription = null;
        }
      }
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: wantedKey,
      });
    }

    const { error } = await supabase.rpc('register_my_push',{p_kind:'web',p_subscription:subscription.toJSON()});
    if (error) return { ok: false, message: 'Notifiche attivate ma non salvate: ' + error.message };

    return { ok: true, message: 'Notifiche abilitate ❤️' };
  } catch (err: any) {
    console.error('Errore Web Push:', err);
    return { ok: false, message: 'Impossibile abilitare le notifiche: ' + (err?.message || err) };
  }
}
