import { featureReadCache } from '../services/featureReadCache';
import { signedImages } from '../services/signedImages';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { clearPushRegistration } from '../services/notification';
import { checkEmailDeliverable, normalizeEmail, validateEmailSyntax } from '../utils/emailCheck';
import { validatePassword } from '../utils/password';

export interface Profile {
  id: string;
  name: string;
  partnerId: string;
}

export interface ProfileOption {
  id: string;
  name: string;
}

export type AuthGate = 'loading' | 'signedOut' | 'needsProfile' | 'recovery' | 'error' | 'ready';

interface AuthData {
  gate: AuthGate;
  email: string | null;
  profile: Profile | null;
  setupError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null; unconfirmed: boolean }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  resendConfirmation: (email: string) => Promise<string | null>;
  sendPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  listProfiles: () => Promise<ProfileOption[]>;
  claimProfile: (profileId: string) => Promise<string | null>;
  retryProfile: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthData | null>(null);

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fuori da AuthProvider');
  return v;
};

type AuthErr = { message?: string; code?: string; status?: number } | null | undefined;

/** Traduce gli errori di Supabase Auth in messaggi comprensibili. */
export const friendlyAuthError = (err: AuthErr): string => {
  if (!err) return 'Si è verificato un errore imprevisto.';
  const msg = (err.message || '').toLowerCase();
  const code = err.code || '';
  if (msg.includes('invalid login credentials') || code === 'invalid_credentials') return "Indirizzo email o password non corretti.";
  if (msg.includes('email not confirmed') || code === 'email_not_confirmed') {
    return 'Devi prima confermare l\'indirizzo email: apri il link che ti abbiamo inviato (controlla anche lo spam).';
  }
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || msg.includes('rate limit') || err.status === 429) {
    return 'Troppe richieste ravvicinate: riprova tra qualche minuto.';
  }
  if (msg.includes('database error saving new user')) {
    return 'Registrazione non consentita: l\'indirizzo non è autorizzato oppure è un\'email temporanea.';
  }
  if (msg.includes('already registered') || code === 'user_already_exists') return 'Esiste già un account con questa email: prova ad accedere.';
  if (code === 'weak_password' || (msg.includes('password') && (msg.includes('weak') || msg.includes('should contain')))) {
    return 'Password troppo debole: servono almeno 8 caratteri con maiuscola, minuscola, numero e simbolo.';
  }
  if (code === 'same_password' || msg.includes('different from the old password')) return 'La nuova password deve essere diversa da quella precedente.';
  if (code === 'signup_disabled' || msg.includes('signups not allowed')) return 'Al momento non è possibile creare un account.';
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('fetch failed')) {
    return 'Connessione non disponibile: controlla internet e riprova.';
  }
  return err.message || 'Errore imprevisto.';
};

// Dopo il clic sul link nell'email si torna alla web app (su app nativa vale l'indirizzo impostato su Supabase)
const redirectUrl = (): string | undefined =>
  Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;

type ProfileState = 'idle' | 'loading' | 'none' | 'ready' | 'error';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initDone, setInitDone] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileState, setProfileState] = useState<ProfileState>('idle');
  const [profileUid,setProfileUid]=useState<string|null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const profileRef = useRef<Profile | null>(null);
  useEffect(()=>{profileRef.current=profile;},[profile]);

  // Sessione: lettura iniziale + aggiornamenti (login, logout, rinnovo del token, link di recupero password)
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session ?? null);
      setInitDone(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') { signedImages.clear(); featureReadCache.clear(); }
      setSession(next ?? null);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // App nativa: il rinnovo automatico del token va fermato quando l'app è in background
  useEffect(() => {
    if (Platform.OS === 'web') return;
    supabase.auth.startAutoRefresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      sub.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  // Profilo collegato all'account (la riga di public.users con i dati della coppia)
  const uid = session?.user?.id ?? null;
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    void (async()=>{
    await Promise.resolve();
    if(!alive)return;
    if (!uid) {
      setProfile(null);
      setProfileState('idle');
      setSetupError(null);
      return;
    }
    setProfileState('loading');
      const { data, error } = await supabase.rpc('get_my_profile').abortSignal(controller.signal);
      if (!alive) return;
      if (error) {
        setSetupError(
          error.code === 'PGRST202' || error.code === '42883'
            ? 'Il servizio di accesso non è disponibile al momento. Riprova più tardi.'
            : friendlyAuthError(error)
        );
        setProfileState('error');
        return;
      }
      setSetupError(null);
      setProfileUid(uid);
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.id) {
        setProfile({ id: row.id, name: row.name || '', partnerId: row.partner_id || '' });
        setProfileState('ready');
      } else {
        setProfile(null);
        setProfileState('none');
      }
    })();
    return () => {
      alive = false; controller.abort();
    };
  }, [uid, retryTick]);

  const gate: AuthGate = !initDone
    ? 'loading'
    : !session
    ? 'signedOut'
    : recovery
    ? 'recovery'
    : profileState === 'error'
    ? 'error'
    : profileState === 'none'
    ? 'needsProfile'
    : profileState === 'ready' && profile && profileUid===uid
    ? 'ready'
    : 'loading';

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
    if (!error) return { error: null, unconfirmed: false };
    const unconfirmed = error.code === 'email_not_confirmed' || (error.message || '').toLowerCase().includes('email not confirmed');
    return { error: friendlyAuthError(error), unconfirmed };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    // Gli stessi controlli della schermata, ripetuti qui: la funzione non si fida di chi la chiama
    const syntax = validateEmailSyntax(email);
    if (!syntax.ok) return { error: syntax.message, needsConfirmation: false };
    const pwError = validatePassword(password, syntax.email);
    if (pwError) return { error: pwError, needsConfirmation: false };

    const deliverable = await checkEmailDeliverable(syntax.domain);
    if (deliverable === 'no-mail') {
      return {
        error: `Il dominio "${syntax.domain}" non risulta in grado di ricevere email: controlla di aver scritto bene l'indirizzo.`,
        needsConfirmation: false,
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email: syntax.email,
      password,
      options: { emailRedirectTo: redirectUrl() },
    });
    if (error) return { error: friendlyAuthError(error), needsConfirmation: false };

    if (data.session) {
      // Con la conferma email attiva Supabase NON restituisce una sessione alla registrazione.
      // Se la restituisce, il progetto accetta indirizzi non verificati: non lo permettiamo.
      await supabase.auth.signOut({ scope: 'local' });
      return {
        error:
          'Al momento non è possibile verificare il tuo indirizzo email. La registrazione non è stata completata: riprova più tardi.',
        needsConfirmation: false,
      };
    }
    return { error: null, needsConfirmation: true };
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizeEmail(email),
      options: { emailRedirectTo: redirectUrl() },
    });
    return error ? friendlyAuthError(error) : null;
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo: redirectUrl() });
    return error ? friendlyAuthError(error) : null;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const email = (await supabase.auth.getUser()).data.user?.email ?? undefined;
    const pwError = validatePassword(password, email);
    if (pwError) return pwError;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return friendlyAuthError(error);
    setRecovery(false);
    return null;
  }, []);

  const listProfiles = useCallback(async (): Promise<ProfileOption[]> => {
    const { data, error } = await supabase.rpc('list_unclaimed_profiles');
    if (error) throw new Error(friendlyAuthError(error));
    return ((data || []) as { id: string; name: string }[]).map((r) => ({ id: r.id, name: r.name || 'Senza nome' }));
  }, []);

  const claimProfile = useCallback(async (profileId: string) => {
    const { error } = await supabase.rpc('claim_profile', { p_profile_id: profileId });
    if (error) return friendlyAuthError(error);
    setRetryTick((t) => t + 1);
    return null;
  }, []);

  const retryProfile = useCallback(() => setRetryTick((t) => t + 1), []);

  const signOut = useCallback(async () => {
    const p = profileRef.current;
    // Questo dispositivo non deve più ricevere le notifiche di questo account
    try {
      if (p) await clearPushRegistration(p.id);
    } catch (e) {}
    // scope "local": si esce solo da questo dispositivo, le altre sessioni restano valide
    const {error}=await supabase.auth.signOut({ scope: 'local' });
    if(error)throw error;
  }, []);

  const value: AuthData = {
    gate,
    email: session?.user?.email ?? null,
    profile,
    setupError,
    signIn,
    signUp,
    resendConfirmation,
    sendPasswordReset,
    updatePassword,
    listProfiles,
    claimProfile,
    retryProfile,
    signOut,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
