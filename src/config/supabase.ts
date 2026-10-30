import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { nativeAuthStorage } from './authStorage';
import { recoveryDelay } from '../utils/recovery';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'configure-your-public-key';

// Login: su web la sessione sta in localStorage (predefinito), su app nativa in un file (vedi authStorage.ts).
// detectSessionInUrl serve solo su web: legge i link di conferma email e di recupero password.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { reconnectAfterMs: (attempt) => recoveryDelay(attempt) },
  auth: {
    ...(Platform.OS !== 'web' ? { storage: nativeAuthStorage } : {}),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

/** @deprecated Con il login l'identità arriva dall'account (useAuth().profile): restano solo come dati di riferimento. */
export const USER_IDS = {
  ANDROID: '7cc9c2ed-8bb5-4bad-9d35-2649e73c321c',
  WEB: '42cf0722-7bd8-4377-b788-794b2ff80226',
};

// Nomi mostrati nel report PDF (personalizzali).
export const USER_NAMES: Record<string, string> = {
  [USER_IDS.ANDROID]: 'Partner (Android)',
  [USER_IDS.WEB]: 'Partner (Web)',
};

export const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_KEY || '';
