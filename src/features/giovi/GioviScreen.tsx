import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../state/Auth';
import { useScreenActive } from '../../hooks/useActivity';
import { useTheme } from '../../theme/ThemeProvider';
import { Screen, Header } from '../../ui/layout';
import { Button, Card, Input, T } from '../../ui/primitives';
import { confirmAction } from '../../utils/confirm';

interface Pearl { id: string; title: string; body: string; version: number }
interface Reply { ok: boolean; configured?: boolean; entries?: Pearl[]; error?: string; code?: string }

export function GioviScreen() {
  const { s } = useTheme();
  const { profile } = useAuth();
  const active = useScreenActive();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [entries, setEntries] = useState<Pearl[]>([]);
  const [editing, setEditing] = useState<Pearl | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const secret = useRef('');
  const epoch = useRef(0);
  const running = useRef(false);
  const expiry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    epoch.current++;
    secret.current = '';
    running.current = false;
    if (expiry.current) clearTimeout(expiry.current);
    setUnlocked(false); setEntries([]); setEditing(null); setTitle(''); setBody('');
    setPassword(''); setConfirmation(''); setChanging(false); setBusy(false); setError(''); setNotice('');
  }, []);

  const status = useCallback(async () => {
    const generation = epoch.current;
    const { data, error: failure } = await supabase.rpc('giovi_access', { p_action: 'status' });
    if (generation !== epoch.current) return;
    if (failure) { setError('Impossibile aprire la sezione. Verifica la connessione e riprova.'); return; }
    setConfigured(Boolean((data as Reply)?.configured));
  }, []);

  useEffect(() => {
    const generation = epoch.current;
    if (active && profile?.id) {
      void supabase.rpc('giovi_access', { p_action: 'status' }).then(({ data, error: failure }) => {
        if (generation !== epoch.current) return;
        if (failure) setError('Impossibile aprire la sezione. Verifica la connessione e riprova.');
        else setConfigured(Boolean((data as Reply)?.configured));
      });
    }
    return lock;
  }, [active, profile?.id, lock]);

  const request = async (action: string, values: Record<string, unknown> = {}) => {
    if (running.current || !active) return;
    running.current = true; setBusy(true); setError(''); setNotice('');
    const generation = epoch.current;
    try {
      const candidate = action === 'setup' ? password : action === 'open' ? secret.current || password : secret.current;
      const { data, error: failure } = await supabase.rpc('giovi_access', { p_action: action, p_password: candidate, ...values });
      if (generation !== epoch.current) return;
      if (failure) throw new Error(failure.message);
      const reply = data as Reply;
      if (!reply?.ok) {
        if (reply.code === 'configured') { setConfigured(true); setConfirmation(''); }
        if (reply.code === 'password' || reply.code === 'locked' || reply.code === 'unconfigured') {
          lock();
          if (reply.code === 'unconfigured') setConfigured(false);
        }
        setError(reply?.error || 'Operazione non riuscita.');
        return;
      }
      if (action === 'password') {
        lock(); setNotice('Password aggiornata. Condividila con il partner e accedi di nuovo.'); return;
      }
      secret.current = candidate;
      setEntries(reply.entries ?? []); setConfigured(true); setUnlocked(true);
      setPassword(''); setConfirmation(''); setEditing(null); setTitle(''); setBody('');
      if (expiry.current) clearTimeout(expiry.current);
      expiry.current = setTimeout(lock, 10 * 60 * 1000);
      if (action === 'save') setNotice('Perla salvata.');
      if (action === 'delete') setNotice('Perla eliminata.');
    } catch (failure) {
      if (generation === epoch.current) setError(failure instanceof Error ? failure.message : 'Operazione non riuscita.');
    } finally {
      if (generation === epoch.current) { running.current = false; setBusy(false); }
    }
  };
  const validPassword = password.length >= 8 && password === confirmation;
  const back = () => { lock(); if (router.canGoBack()) router.back(); else router.replace('/settings'); };
  const remove = async (entry: Pearl) => {
    const generation = epoch.current;
    const confirmed = await confirmAction('Elimina perla', 'La perla verrà eliminata per entrambi. Continuare?', 'Elimina');
    if (confirmed && generation === epoch.current) await request('delete', { p_id: entry.id, p_version: entry.version });
  };
  const reload = async () => {
    const generation = epoch.current;
    if ((title || body) && !await confirmAction('Ricarica le perle', 'Le modifiche non salvate verranno scartate. Continuare?', 'Ricarica')) return;
    if (generation === epoch.current) await request('open');
  };

  return <Screen showSaveFeedback={false} header={<Header title="Perle di Giovi" onBack={back} />}>
    {error ? <Card><T tone="danger" accessibilityLiveRegion="polite">{error}</T>{configured === null && <Button label="Riprova" onPress={() => void status()} />}</Card> : null}
    {notice ? <T tone="success" accessibilityLiveRegion="polite">{notice}</T> : null}
    {!active ? null : !unlocked ? <Card><View style={{ gap: s.md }}>
      <T v="title">{configured === false ? 'Scegliete la vostra password' : 'Uno spazio solo vostro'}</T>
      <T tone="muted">Una password condivisa protegge i testi di entrambi. È distinta dalla password del tuo account.</T>
      {configured === null ? <T tone="muted">Caricamento…</T> : <>
        <Input label={configured ? 'Password condivisa' : 'Nuova password (almeno 8 caratteri)'} secureTextEntry autoCapitalize="none" autoCorrect={false} value={password} onChangeText={setPassword} editable={!busy} />
        {!configured && <Input label="Ripeti la password" secureTextEntry autoCapitalize="none" autoCorrect={false} value={confirmation} onChangeText={setConfirmation} editable={!busy} />}
        {!configured && <T tone="muted">Conservatela con cura: senza la password non è possibile recuperare i testi cifrati.</T>}
        <Button label={configured ? 'Apri le perle' : 'Crea lo spazio protetto'} icon="lock" loading={busy} disabled={configured ? !password : !validPassword} onPress={() => void request(configured ? 'open' : 'setup')} />
      </>}
    </View></Card> : <>
      <T tone="muted">Scrivete qui le vostre perle. L’accesso si blocca uscendo dalla sezione, passando in background o dopo 10 minuti dall’ultima operazione.</T>
      <View style={{ gap: s.sm }}><Button label="Blocca lo spazio" icon="lock" variant="secondary" onPress={lock} /><Button label="Ricarica le perle" variant="ghost" disabled={busy} onPress={() => void reload()} /></View>
      <Card><View style={{ gap: s.md }}>
        <T v="title">{editing ? 'Modifica perla' : 'Aggiungi una perla'}</T>
        <Input label="Titolo" placeholder="Un titolo per questa perla" value={title} onChangeText={setTitle} maxLength={80} editable={!busy} />
        <Input label="La vostra perla" placeholder="Scrivete quello che volete conservare…" value={body} onChangeText={setBody} multiline maxLength={6000} style={{ minHeight: 150, textAlignVertical: 'top' }} editable={!busy} />
        <T tone="faint">{body.length}/6000</T>
        <Button label="Salva perla" loading={busy} disabled={!title.trim()} onPress={() => void request('save', { p_title: title, p_body: body, p_id: editing?.id ?? null, p_version: editing?.version ?? null })} />
        {editing && <Button label="Annulla modifica" variant="ghost" disabled={busy} onPress={() => { setEditing(null); setTitle(''); setBody(''); }} />}
      </View></Card>
      {!entries.length && <T tone="muted">Non ci sono ancora perle. Scrivete la prima qui sopra.</T>}
      {entries.map(entry => <Card key={entry.id}><View style={{ gap: s.md }}>
        <T v="title">{entry.title}</T><T>{entry.body || 'Nessun testo aggiunto.'}</T>
        <Button label={`Modifica: ${entry.title}`} variant="secondary" disabled={busy} onPress={() => { setEditing(entry); setTitle(entry.title); setBody(entry.body); setError(''); setNotice(''); }} />
        <Button label={`Elimina: ${entry.title}`} variant="ghost" disabled={busy} onPress={() => void remove(entry)} />
      </View></Card>)}
      <Card><View style={{ gap: s.md }}>
        <Button label={changing ? 'Annulla cambio password' : 'Cambia password condivisa'} variant="secondary" disabled={busy} onPress={() => { setChanging(!changing); setPassword(''); setConfirmation(''); }} />
        {changing && <><Input label="Nuova password (almeno 8 caratteri)" secureTextEntry autoCapitalize="none" autoCorrect={false} value={password} onChangeText={setPassword} editable={!busy} /><Input label="Ripeti la nuova password" secureTextEntry autoCapitalize="none" autoCorrect={false} value={confirmation} onChangeText={setConfirmation} editable={!busy} /><T tone="muted">Dopo il cambio entrambi dovrete usare la nuova password.</T><Button label="Conferma nuova password" disabled={!validPassword} loading={busy} onPress={() => void request('password', { p_new_password: password })} /></>}
      </View></Card>
    </>}
  </Screen>;
}
