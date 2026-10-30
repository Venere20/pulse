import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View, Platform } from 'react-native';
import { ProfileOption, useAuth } from '../state/Auth';
import { USER_IDS } from '../config/supabase';
import { validateEmailSyntax } from '../utils/emailCheck';
import { passwordRules } from '../utils/password';
import { Screen, Header } from '../ui/layout';
import { Button, Card, Input, T } from '../ui/primitives';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../theme/tokens';

/** Elenco dei requisiti della password: si colora man mano che vengono soddisfatti. */
const PasswordChecklist: React.FC<{ password: string; email?: string }> = ({ password, email }) => {
  const { s } = useTheme();
  const rules = useMemo(() => passwordRules(password, email), [password, email]);
  return (
    <View style={{ gap: 2 }} accessibilityLabel="Requisiti della password">
      {rules.map((r) => (
        <T key={r.id} tone={r.ok ? 'success' : password ? 'danger' : 'faint'} style={{ marginLeft: s.xs }}>
          {r.ok ? '✓' : '○'} {r.label}
        </T>
      ))}
    </View>
  );
};

const TextLink: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => (
  <TouchableOpacity accessibilityRole="button" onPress={onPress} style={{ minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
    <T tone="primary" bold>{label}</T>
  </TouchableOpacity>
);

const ShowToggle: React.FC<{ shown: boolean; onToggle: () => void }> = ({ shown, onToggle }) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={shown ? 'Nascondi password' : 'Mostra password'}
    onPress={onToggle}
    style={{ alignSelf: 'flex-end', minHeight: 32, justifyContent: 'center' }}
  >
    <T tone="muted" bold>{shown ? 'Nascondi password' : 'Mostra password'}</T>
  </TouchableOpacity>
);

type Mode = 'signin' | 'signup' | 'forgot' | 'sent';

export const AuthScreen: React.FC = () => {
  const { s } = useTheme();
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [sentKind, setSentKind] = useState<'signup' | 'reset'>('signup');

  const go = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setEmailError(null);
    setUnconfirmed(false);
    setPassword('');
    setConfirm('');
    setShow(false);
  };

  const checkEmailField = () => {
    if (!email.trim()) return setEmailError(null);
    const r = validateEmailSyntax(email);
    setEmailError(r.ok ? null : r.message);
  };

  const submitSignIn = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) return setError('Inserisci email e password.');
    setBusy(true);
    const res = await auth.signIn(email, password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      setUnconfirmed(res.unconfirmed);
    }
  };

  const submitSignUp = async () => {
    setError(null);
    const syntax = validateEmailSyntax(email);
    if (!syntax.ok) return setError(syntax.message);
    if (!passwordRules(password, syntax.email).every((r) => r.ok)) return setError('La password non rispetta tutti i requisiti elencati.');
    if (password !== confirm) return setError('Le due password non coincidono.');
    setBusy(true);
    const res = await auth.signUp(syntax.email, password);
    setBusy(false);
    if (res.error) return setError(res.error);
    setEmail(syntax.email);
    setSentKind('signup');
    setMode('sent');
    setPassword('');
    setConfirm('');
  };

  const submitForgot = async () => {
    setError(null);
    const syntax = validateEmailSyntax(email);
    if (!syntax.ok) return setError(syntax.message);
    setBusy(true);
    const err = await auth.sendPasswordReset(syntax.email);
    setBusy(false);
    if (err) return setError(err);
    setEmail(syntax.email);
    setSentKind('reset');
    setMode('sent');
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    const err = await auth.resendConfirmation(email);
    setBusy(false);
    if (err) setError(err);
    else setInfo('Email inviata di nuovo: controlla la posta (anche lo spam).');
  };

  const emailInput = (
    <Input
      label="Indirizzo email"
      placeholder="nome@esempio.it"
      value={email}
      onChangeText={(t) => {
        setEmail(t);
        if (emailError) setEmailError(null);
      }}
      onBlur={mode === 'signup' ? checkEmailField : undefined}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="email-address"
      autoComplete="email"
      textContentType="emailAddress"
      returnKeyType="next"
    />
  );

  const subtitle =
    mode === 'signup' ? 'Crea il tuo account' : mode === 'forgot' ? 'Recupera la password' : mode === 'sent' ? 'Controlla la posta' : "Accedi al vostro spazio";

  return (
    <Screen header={<Header title="Pulse" subtitle={subtitle} />}>
      {mode === 'signin' && (
        <Card>
          <View style={{ gap: s.md }}>
            {emailInput}
            <Input
              label="Password"
              placeholder="La tua password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={submitSignIn}
            />
            <ShowToggle shown={show} onToggle={() => setShow(!show)} />
            {error ? <T tone="danger" accessibilityRole="text">{error}</T> : null}
            {info ? <T tone="success">{info}</T> : null}
            <Button label="Accedi" icon="lock" onPress={submitSignIn} loading={busy} />
            {unconfirmed && <Button label="Rimanda l'email di conferma" variant="secondary" onPress={resend} disabled={busy} />}
            <TextLink label="Password dimenticata?" onPress={() => go('forgot')} />
          </View>
        </Card>
      )}

      {mode === 'signup' && (
        <Card>
          <View style={{ gap: s.md }}>
            <T tone="muted">
              Usa un indirizzo email a cui puoi accedere: ti invieremo un link di conferma. Gli indirizzi temporanei non sono ammessi.
            </T>
            {emailInput}
            {emailError ? <T tone="danger">{emailError}</T> : null}
            <Input
              label="Password"
              placeholder="Scegli una password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
            />
            <PasswordChecklist password={password} email={email} />
            <Input
              label="Ripeti la password"
              placeholder="Riscrivila"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={submitSignUp}
            />
            {confirm.length > 0 && confirm !== password ? <T tone="danger">Le due password non coincidono.</T> : null}
            <ShowToggle shown={show} onToggle={() => setShow(!show)} />
            {error ? <T tone="danger">{error}</T> : null}
            <Button label="Crea account" icon="check" onPress={submitSignUp} loading={busy} />
          </View>
        </Card>
      )}

      {mode === 'forgot' && (
        <Card>
          <View style={{ gap: s.md }}>
            <T tone="muted">Scrivi l&apos;email dell&apos;account: ti invieremo un link per scegliere una nuova password.</T>
            {emailInput}
            {error ? <T tone="danger">{error}</T> : null}
            <Button label="Invia il link" icon="check" onPress={submitForgot} loading={busy} />
          </View>
        </Card>
      )}

      {mode === 'sent' && (
        <Card accent>
          <View style={{ gap: s.md }}>
            {sentKind === 'signup' ? (
              <>
                <T v="title">Ti abbiamo scritto 📬</T>
                <T>
                  Abbiamo inviato un link di conferma a <T bold>{email}</T>. Aprilo per confermare che l&apos;indirizzo è tuo, poi torna qui e accedi.
                </T>
                <T tone="muted">L’email non è arrivata? Controlla anche lo spam: la consegna può richiedere qualche minuto.</T>
              </>
            ) : (
              <>
                <T v="title">Controlla la posta 📬</T>
                <T>
                  Se esiste un account con <T bold>{email}</T>, riceverai un link per scegliere una nuova password.
                </T>
              </>
            )}
            {error ? <T tone="danger">{error}</T> : null}
            {info ? <T tone="success">{info}</T> : null}
            <Button label="Vai all'accesso" onPress={() => go('signin')} />
            {sentKind === 'signup' && <Button label="Rimanda l'email" variant="secondary" onPress={resend} loading={busy} />}
          </View>
        </Card>
      )}

      {mode === 'signin' && <TextLink label="Non hai un account? Registrati" onPress={() => go('signup')} />}
      {mode === 'signup' && <TextLink label="Hai già un account? Accedi" onPress={() => go('signin')} />}
      {mode === 'forgot' && <TextLink label="Torna all'accesso" onPress={() => go('signin')} />}
    </Screen>
  );
};

/** Dopo il clic sul link "password dimenticata": scelta della nuova password. */
export const NewPasswordScreen: React.FC = () => {
  const { s } = useTheme();
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!passwordRules(password, auth.email || undefined).every((r) => r.ok)) return setError('La password non rispetta tutti i requisiti elencati.');
    if (password !== confirm) return setError('Le due password non coincidono.');
    setBusy(true);
    const err = await auth.updatePassword(password);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <Screen header={<Header title="Nuova password" subtitle="Scegli la tua nuova password" />}>
      <Card>
        <View style={{ gap: s.md }}>
          <Input
            label="Nuova password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <PasswordChecklist password={password} email={auth.email || undefined} />
          <Input
            label="Ripeti la password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={submit}
          />
          {confirm.length > 0 && confirm !== password ? <T tone="danger">Le due password non coincidono.</T> : null}
          <ShowToggle shown={show} onToggle={() => setShow(!show)} />
          {error ? <T tone="danger">{error}</T> : null}
          <Button label="Salva la nuova password" icon="check" onPress={submit} loading={busy} />
        </View>
      </Card>
    </Screen>
  );
};

/** Primo accesso: l'account va collegato al profilo (e ai dati) di una delle due persone. */
export const ProfilePickerScreen: React.FC = () => {
  const { c, r, s } = useTheme();
  const auth = useAuth();
  const [options, setOptions] = useState<ProfileOption[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    auth
      .listProfiles()
      .then((o) => alive && setOptions(o))
      .catch((e: Error) => {
        if (alive) {
          setOptions([]);
          setError(e.message);
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hint = (id: string) =>
    id === USER_IDS.ANDROID ? 'Profilo usato finora dall\'app Android' : id === USER_IDS.WEB ? 'Profilo usato finora dalla web app' : '';

  const confirm = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const err = await auth.claimProfile(selected);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <Screen header={<Header title="Chi sei?" subtitle={auth.email || undefined} />}>
      <Card>
        <View style={{ gap: s.md }}>
          <T tone="muted">
            Collega questo account al tuo profilo: da ora le tue notifiche, i tuoi dati e le tue spese saranno legati a quest&apos;email. La scelta non si può cambiare dall&apos;app.
          </T>

          {options === null && <ActivityIndicator color={c.primary} />}

          {options?.map((o) => {
            const on = selected === o.id;
            return (
              <TouchableOpacity
                key={o.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                {...(Platform.OS === 'web' ? { 'aria-pressed': on } : {})}
                accessibilityLabel={`Profilo ${o.name}`}
                onPress={() => setSelected(o.id)}
                activeOpacity={0.85}
                style={{
                  minHeight: MIN_TOUCH + 12,
                  justifyContent: 'center',
                  paddingHorizontal: s.md,
                  paddingVertical: s.sm,
                  borderRadius: r.md,
                  borderWidth: 2,
                  borderColor: on ? c.primary : c.border,
                  backgroundColor: on ? c.primarySoft : c.surfaceAlt,
                }}
              >
                <T bold>{o.name}</T>
                {hint(o.id) ? <T tone="muted">{hint(o.id)}</T> : null}
              </TouchableOpacity>
            );
          })}

          {options && options.length === 0 && !error && (
            <T tone="danger">Entrambi i profili sono già collegati a un account. Esci e accedi con uno degli account associati.</T>
          )}
          {error ? <T tone="danger">{error}</T> : null}

          <Button label="Conferma il mio profilo" icon="check" onPress={confirm} loading={busy} disabled={!selected} />
        </View>
      </Card>
      <Button label="Esci" variant="secondary" onPress={() => auth.signOut()} />
    </Screen>
  );
};

export const SetupErrorScreen: React.FC = () => {
  const { s } = useTheme();
  const auth = useAuth();
  return (
    <Screen header={<Header title="Pulse" subtitle="Non riesco a completare l'accesso" />}>
      <Card>
        <View style={{ gap: s.md }}>
          <T>{auth.setupError || 'Si è verificato un problema.'}</T>
          <Button label="Riprova" icon="refresh" onPress={auth.retryProfile} />
          <Button label="Esci" variant="secondary" onPress={() => auth.signOut()} />
        </View>
      </Card>
    </Screen>
  );
};

const Splash: React.FC = () => {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator size="large" color={c.primary} />
    </View>
  );
};

/** Mostra l'app solo ad account verificato e collegato a un profilo; altrimenti la schermata giusta. */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { gate } = useAuth();
  switch (gate) {
    case 'loading':
      return <Splash />;
    case 'signedOut':
      return <AuthScreen />;
    case 'recovery':
      return <NewPasswordScreen />;
    case 'needsProfile':
      return <ProfilePickerScreen />;
    case 'error':
      return <SetupErrorScreen />;
    default:
      return <>{children}</>;
  }
};
