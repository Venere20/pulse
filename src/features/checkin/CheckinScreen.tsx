import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Header } from '../../ui/layout';
import { useTheme } from '../../theme/ThemeProvider';
import { useInsets } from '../../ui/safeArea';
import { useAppDataFields } from '../../state/AppData';
import { Button, Card, Chip, Input, T } from '../../ui/primitives';
import { DateField } from '../../ui/DateField';
import { FeatureFrame, useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { confirmAction } from '../../utils/confirm';
import { useScreenActive } from '../../hooks/useActivity';
import { syncCheckinReminder } from './reminders';
import { arrivalAt, canExtendCheckin, defaultCheckinGrace, SavedRoute, sortedRoutes, validateJourney } from './model';

export interface Checkin {
  id: string; user_id: string; label: string; note: string | null;
  status: string; due_at: string; created_at: string; extensions: number;
  grace_minutes: number; departed_at?: string; origin?: string; flow_version?: number;
}
type RouteDraft = Omit<SavedRoute, 'id' | 'user_id'>;
const EMPTY: RouteDraft = { name: '', icon: '🏠', origin: '', destination: '', minutes: 30, grace_minutes: 10, note: '', quick_start: false, favorite: false, position: 0 };
const time = (date: number | string) => new Date(date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function CheckinScreen() {
  const active = useScreenActive();
  const d = useAppDataFields(['names', 'userId']);
  const data = useFeatureRows<Checkin>('safe_checkins');
  const routes = useFeatureRows<SavedRoute>('checkin_routes');
  const preferences = useFeatureRows<{ checkin_grace_minutes: number }>('feature_preferences', { column: 'user_id', value: d.userId }, '');
  const { busy, run } = useFeatureAction();
  const [draft, setDraft] = useState<RouteDraft>({ ...EMPTY });
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [options, setOptions] = useState(false);
  const [customDeparture, setCustomDeparture] = useState(false);
  const [day, setDay] = useState(() => localDay(new Date()));
  const [hour, setHour] = useState(() => time(Date.now()));
  const [now, setNow] = useState(Date.now);
  const { c, r, s } = useTheme();
  const insets = useInsets();
  const [routesOpen, setRoutesOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const mine = data.rows.find(c => c.user_id === d.userId && ['active', 'alerted'].includes(c.status));
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  const patch = <K extends keyof RouteDraft>(key: K, value: RouteDraft[K]) => setDraft(prev => ({ ...prev, [key]: value }));
  const departure = (at: number) => {
    if (!customDeparture) return at;
    if (!/^\d{2}:\d{2}$/.test(hour) || Number(hour.slice(0, 2)) > 23 || Number(hour.slice(3)) > 59) throw new Error('Inserisci un orario valido: HH:MM.');
    return new Date(`${day}T${hour}:00`).getTime();
  };
  let preview = 'Controlla l’orario';
  try { preview = time(arrivalAt(departure(now), draft.minutes).getTime()); } catch { /* Input validated on submit. */ }
  const refresh = async () => { await Promise.all([data.refresh(), routes.refresh()]); };
  const begin = (route: RouteDraft, immediate = false) => run(async () => {
    const at = Date.now();
    const departed = immediate ? at : departure(at);
    validateJourney(route.minutes, route.grace_minutes, departed, at);
    if (!route.destination.trim()) throw new Error('Indica la destinazione.');
    const reachable = await featureRpc<boolean>('checkin_partner_reachable');
    if (!reachable && !await confirmAction('Partner non raggiungibile', 'Il partner non ha notifiche attive su un dispositivo. L’avviso potrebbe non arrivare. Vuoi continuare?', 'Avvia comunque')) return;
    await featureRpc('start_checkin_v2', { p_label: route.destination, p_note: route.note, p_minutes: route.minutes, p_departed_at: new Date(departed).toISOString(), p_grace: route.grace_minutes, p_origin: route.origin, p_allow_unreachable: !reachable });
    setForm(false);
  }, data.refresh);
  const open = (route?: SavedRoute, duplicate = false) => {
    setDraft(route ? { ...route, name: duplicate ? `${route.name.slice(0, 50)} · copia` : route.name } : { ...EMPTY, grace_minutes: defaultCheckinGrace(preferences.rows[0]?.checkin_grace_minutes) });
    setEditing(duplicate ? null : route?.id ?? null);
    setCustomDeparture(false); setForm(true); setOptions(false);
  };
  const update = (c: Checkin, action: string, extra?: number) => run(() => featureRpc('update_checkin_v2', { p_id: c.id, p_action: action, p_minutes: extra ?? null }), data.refresh);
  // V2.2 presentation shared by Android and the web/PWA.
  if ((Platform.OS === 'android' || Platform.OS === 'web') && !data.loading && !data.error) {
    const partnerCheckins = data.rows.filter(item => ['active', 'alerted'].includes(item.status) && item.user_id !== d.userId);
    const awaitingDeparture = !!mine?.departed_at && Date.parse(mine.departed_at) > now;
    const history = data.rows.filter(item => !['active', 'alerted'].includes(item.status)).slice(0, 15);
    const historyStatus = (status: string) => status === 'arrived' ? 'Arrivato/a' : status === 'resolved' ? 'Risolto' : status === 'cancelled' ? 'Annullato' : 'Scaduto';
    const warningTime = (() => {
      try { return time(arrivalAt(departure(now), draft.minutes + draft.grace_minutes).getTime()); }
      catch { return '—'; }
    })();
    const canStart = !!draft.destination.trim() && Number.isInteger(draft.minutes) && draft.minutes >= 5 && draft.minutes <= 720 && Number.isInteger(draft.grace_minutes) && draft.grace_minutes >= 5 && draft.grace_minutes <= 30;
    const closeForm = () => { setForm(false); setOptions(false); setNoteOpen(false); };
    const deleteRoute = (route: SavedRoute) => run(async () => {
      if (await confirmAction('Elimina tragitto', `Eliminare «${route.name}»? I check-in già avviati restano invariati.`, 'Elimina')) {
        await featureRpc('delete_checkin_route', { p_id: route.id });
        if (editing === route.id) { setEditing(null); setForm(false); }
      }
    }, routes.refresh);
    const saveRoute = () => run(async () => {
      const at = Date.now(); validateJourney(draft.minutes, draft.grace_minutes, at, at);
      if (!Number.isInteger(draft.position) || draft.position < 0 || draft.position > 9999) throw new Error('Ordine: da 0 a 9999.');
      const route = { ...draft, name: draft.name.trim() || draft.destination.trim() };
      const id = await featureRpc<string>('save_checkin_route', { p_route: route, p_id: editing });
      setEditing(id); setDraft(route); setOptions(false); setForm(false); setRoutesOpen(true);
    }, routes.refresh);
    const cancelCheckin = (item: Checkin) => run(async () => {
      if (await confirmAction('Annulla check-in', 'Il viaggio verrà chiuso senza confermare l’arrivo. Avviseremo il partner.', 'Annulla check-in')) await featureRpc('update_checkin_v2', { p_id: item.id, p_action: 'cancel' });
    }, data.refresh);
    const resolveCheckin = (item: Checkin) => run(async () => {
      if (await confirmAction('Conferma contatto', 'Hai verificato che il partner stia bene?', 'Sì, tutto bene')) await featureRpc('update_checkin_v2', { p_id: item.id, p_action: 'resolve' });
    }, data.refresh);
    const startNew = () => { open(); setNoteOpen(false); setRoutesOpen(false); };
    const scrollContent = <>
      <T v="caption" tone="muted">🔒 Nessuna posizione condivisa</T>

      {mine && <View style={{ backgroundColor: mine.status === 'alerted' ? c.dangerSoft : c.surfaceAlt, borderWidth: 1, borderColor: mine.status === 'alerted' ? c.danger : c.primary, borderRadius: r.lg, padding: s.lg, gap: s.md }}>
        <T v="caption" bold tone={mine.status === 'alerted' ? 'danger' : 'primary'}>{mine.status === 'alerted' ? '⚠️ ARRIVO NON CONFERMATO' : awaitingDeparture ? '◷ PARTENZA PREVISTA' : now >= Date.parse(mine.due_at) ? '◷ ARRIVO PREVISTO RAGGIUNTO' : '● VIAGGIO IN CORSO'}</T>
        <View style={{ gap: s.xs }}><T tone="muted">Stai andando a</T><T v="h2">{mine.label}</T></View>
        {!!mine.note && <T tone="muted">{mine.note}</T>}
        <View style={{ flexDirection: 'row', gap: s.sm }}>
          <View style={{ flex: 1, backgroundColor: c.surface, padding: s.md, borderRadius: r.md, gap: s.xs }}><T v="caption" tone="muted">ARRIVO PREVISTO</T><T v="h2">{time(mine.due_at)}</T></View>
          <View style={{ flex: 1, backgroundColor: c.surface, padding: s.md, borderRadius: r.md, gap: s.xs }}><T v="caption" tone="muted">MARGINE</T><T v="h2">{mine.grace_minutes} min</T></View>
        </View>
        <T tone={mine.status === 'alerted' ? 'danger' : 'muted'}>{mine.status === 'alerted' ? 'L’arrivo non è stato confermato. Puoi ancora confermare o aggiungere tempo.' : awaitingDeparture ? `Partenza prevista: ${new Date(mine.departed_at!).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}. Il promemoria arriverà all’orario di arrivo previsto.` : now >= Date.parse(mine.due_at) ? 'È il momento di confermare l’arrivo o aggiungere tempo.' : `Arrivo tra ${Math.ceil((Date.parse(mine.due_at) - now) / 60000)} minuti.`}</T>
        <T v="caption" tone="muted">Le notifiche sono richieste dal cloud; la consegna dipende da rete e permessi.</T>
      </View>}

      {mine && <View style={{ gap: s.md }}>
        <Card><View style={{ gap: s.md }}>
          <T v="title">Serve più tempo?</T><T tone="muted">Aggiorna l’arrivo previsto senza avviare un nuovo viaggio.</T>
          <View style={{ flexDirection: 'row', gap: s.sm, flexWrap: 'wrap' }}>{[15, 30, 60].map(value => <View key={value} style={{ flexGrow: 1, flexBasis: 80 }}><Button label={`+${value} min`} variant="secondary" small disabled={busy || !canExtendCheckin(mine, value, now)} onPress={() => update(mine, 'extend', value)} /></View>)}</View>
          <T v="caption" tone="muted">Proroghe utilizzate: {mine.extensions}/5</T>
          {mine.extensions >= 5 ? <T v="caption" tone="muted">Hai utilizzato tutte le cinque proroghe.</T> : ![15, 30, 60].some(value => canExtendCheckin(mine, value, now)) && <T v="caption" tone="muted">Non puoi aggiungere altro tempo: la durata massima è di 12 ore dalla partenza.</T>}
        </View></Card>
        <Button label="Annulla questo viaggio" variant="ghost" disabled={busy} onPress={() => cancelCheckin(mine)} />
      </View>}

      {partnerCheckins.map(item => <View key={item.id} style={{ backgroundColor: item.status === 'alerted' ? c.dangerSoft : c.surface, borderColor: item.status === 'alerted' ? c.danger : c.border, borderWidth: 1, borderRadius: r.lg, padding: s.lg, gap: s.md }}>
        <T v="caption" bold tone={item.status === 'alerted' ? 'danger' : 'primary'}>{item.status === 'alerted' ? '⚠️ CHECK-IN DEL PARTNER' : 'VIAGGIO DEL PARTNER'}</T>
        <T v="title">{d.names[item.user_id] ?? 'Partner'} · {item.label}</T>
        {!!item.note && <T>{item.note}</T>}
        <T tone="muted">Arrivo previsto {time(item.due_at)} · margine {item.grace_minutes} min</T>
        {item.status === 'alerted' ? <><T tone="danger">Il partner non ha ancora confermato l’arrivo.</T><Button label="Ho verificato: tutto bene" disabled={busy} onPress={() => resolveCheckin(item)} /></> : <T tone="muted">{item.departed_at && Date.parse(item.departed_at) > now ? `Partenza prevista: ${new Date(item.departed_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}` : 'Check-in in corso.'}</T>}
      </View>)}

      {!mine && !form && <>
        <View style={{ gap: s.xs }}><T v="h2">Dove stai andando?</T><T tone="muted">Prepara il prossimo viaggio in pochi tocchi.</T></View>
        <Button label="Nuovo tragitto o viaggio singolo" disabled={busy || preferences.loading || !!preferences.error} onPress={startNew} />
        {preferences.error && <><T tone="danger">Non riesco a leggere il tuo margine predefinito.</T><Button label="Riprova preferenze" variant="ghost" onPress={() => void preferences.refresh()} /></>}
        <Card><View style={{ gap: s.md }}>
          <Button label={routesOpen ? 'Nascondi i tuoi tragitti' : `I tuoi tragitti (${routes.rows.length})`} variant="secondary" onPress={() => setRoutesOpen(value => !value)} />
          {routes.error && <T tone="danger">{routes.error}</T>}
          {routesOpen && <>
            {routes.loading && <T tone="muted">Caricamento dei tragitti…</T>}
            {!routes.loading && !routes.error && !routes.rows.length && <T tone="muted">Non hai ancora tragitti salvati. Puoi creare un viaggio singolo oppure salvare un percorso abituale.</T>}
            {sortedRoutes(routes.rows).map(route => <View key={route.id} style={{ backgroundColor: c.surfaceAlt, borderRadius: r.md, padding: s.md, gap: s.sm }}>
              <T bold>{route.icon} {route.name}{route.favorite ? ' ★' : ''}</T>
              <T v="caption" tone="muted">{route.origin ? `${route.origin} → ` : ''}{route.destination} · {route.minutes} min · margine {route.grace_minutes} min</T>
              <Button label={route.quick_start ? 'Parti ora' : 'Scegli questo tragitto'} disabled={busy} onPress={() => { if (route.quick_start) { void begin(route, true); } else { open(route); setNoteOpen(!!route.note); } }} />
              <View style={{ flexDirection: 'row', gap: s.xs, flexWrap: 'wrap' }}>
                <Button label="Modifica" small variant="ghost" disabled={busy} onPress={() => { open(route); setNoteOpen(!!route.note); }} />
                <Button label="Duplica" small variant="ghost" disabled={busy} onPress={() => { open(route, true); setNoteOpen(!!route.note); }} />
                <Button label="Elimina" small variant="ghost" disabled={busy} onPress={() => deleteRoute(route)} />
              </View>
            </View>)}
          </>}
        </View></Card>
      </>}

      {!mine && form && <>
        <Card><View style={{ gap: s.lg }}>
          <View style={{ gap: s.xs }}><T v="title">{editing ? 'Personalizza il tragitto' : 'Nuovo viaggio'}</T><T tone="muted">Imposta destinazione, durata e partenza.</T></View>
          <Input label="Destinazione" placeholder="Dove vai?" value={draft.destination} onChangeText={value => patch('destination', value)} maxLength={60} />
          <View style={{ gap: s.sm }}>
            <T bold>Durata prevista</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>{[15, 30, 60, 120].map(value => <Chip key={value} label={`${value} min`} selected={draft.minutes === value} onPress={() => patch('minutes', value)} />)}</View>
            <Input label="Oppure inserisci i minuti (5–720)" keyboardType="number-pad" value={String(draft.minutes || '')} onChangeText={value => patch('minutes', Number(value))} />
          </View>
          <View style={{ gap: s.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: s.sm }}>
              <View style={{ flex: 1 }}><T bold>Partenza</T><T v="caption" tone="muted">{customDeparture ? `${day} · ${hour}` : `Adesso · ${time(now)}`}</T></View>
              <Button label={customDeparture ? 'Usa ora attuale' : 'Modifica'} variant="ghost" small disabled={busy} onPress={() => { setDay(localDay(new Date())); setHour(time(Date.now())); setCustomDeparture(value => !value); }} />
            </View>
            {customDeparture && <><DateField label="Giorno di partenza" value={day} onChange={setDay} minDate={localDay(new Date(now - 12 * 3600000))} maxDate={localDay(new Date(now + 24 * 3600000))} /><Input label="Ora di partenza (HH:MM)" value={hour} onChangeText={setHour} maxLength={5} placeholder="18:30" /><T v="caption" tone="muted">Puoi partire nelle prossime 24 ore o indicare una partenza nelle ultime 12 ore, con arrivo ancora futuro.</T></>}
          </View>
        </View></Card>

        <View style={{ padding: s.lg, gap: s.md, borderWidth: 1, borderColor: c.primary, borderRadius: r.lg, backgroundColor: c.surfaceAlt }}>
          <T v="caption" tone="primary" bold>ARRIVO PREVISTO</T><T v="display">{preview}</T>
          <View style={{ height: 1, backgroundColor: c.border }} />
          <T bold>Margine prima di avvisare entrambi</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>{[5, 10, 15, 30].map(value => <Chip key={value} label={`${value} min`} selected={draft.grace_minutes === value} onPress={() => patch('grace_minutes', value)} />)}</View>
          <T v="caption" tone="muted">Promemoria previsto alle {preview}. Senza conferma o aggiornamento, l’avviso verrà richiesto indicativamente dopo le {warningTime}.</T>
        </View>

        <Card><View style={{ gap: s.md }}>
          <Button label={noteOpen ? 'Nascondi nota' : draft.note ? 'Modifica nota' : 'Aggiungi una nota facoltativa'} variant="secondary" onPress={() => setNoteOpen(value => !value)} />
          {noteOpen && <Input label="Nota sul viaggio" value={draft.note} onChangeText={value => patch('note', value)} maxLength={200} multiline />}
          {!noteOpen && !!draft.note && <T v="caption" tone="muted" numberOfLines={2}>{draft.note}</T>}
        </View></Card>

        <Card><View style={{ gap: s.md }}>
          <Button label={options ? 'Chiudi preferenze' : 'Salva o modifica le preferenze'} variant="secondary" disabled={busy} onPress={() => setOptions(value => !value)} />
          {options && <>
            <Input label="Nome del tragitto" placeholder={draft.destination.trim() || 'Facoltativo: useremo la destinazione'} value={draft.name} onChangeText={value => patch('name', value)} maxLength={60} />
            <Input label="Partenza facoltativa" value={draft.origin} onChangeText={value => patch('origin', value)} maxLength={100} />
            <Input label="Icona o emoji" value={draft.icon} onChangeText={value => patch('icon', value)} maxLength={16} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>{['🏠', '💼', '🚉', '⛴️', '❤️', '🎓'].map(icon => <Chip key={icon} label={icon} selected={draft.icon === icon} onPress={() => patch('icon', icon)} />)}</View>
            <Chip label={draft.quick_start ? 'Avvio immediato: sì' : 'Avvio con riepilogo'} selected={draft.quick_start} onPress={() => patch('quick_start', !draft.quick_start)} />
            <Chip label={draft.favorite ? 'Preferito ★' : 'Aggiungi ai preferiti'} selected={draft.favorite} onPress={() => patch('favorite', !draft.favorite)} />
            <Input label="Ordine nell’elenco (0–9999)" keyboardType="number-pad" value={String(draft.position)} onChangeText={value => patch('position', Number(value))} />
            <T v="caption" tone="muted">Il nome è facoltativo. Salva il tragitto per conservare anche la scelta dei preferiti.</T>
            <Button label={editing ? 'Salva modifiche al tragitto' : 'Salva tragitto'} disabled={busy || !draft.destination.trim()} onPress={() => void saveRoute()} />
          </>}
        </View></Card>
        <T v="caption" tone="muted">Le modifiche valgono solo per questo viaggio finché non salvi il tragitto.</T>
        <Button label="Chiudi preparazione" variant="ghost" disabled={busy} onPress={closeForm} />
      </>}

      <Card><View style={{ gap: s.md }}>
        <Button label={helpOpen ? 'Nascondi informazioni sugli avvisi' : 'Come funzionano gli avvisi'} variant="secondary" onPress={() => setHelpOpen(value => !value)} />
        {helpOpen && <>
          <T>All’arrivo previsto ricevi un promemoria. Se non confermi o aggiorni entro il margine, Pulse richiede le notifiche previste dal flusso V2.</T>
          <T tone="muted">Nessun banner nella Home. Le notifiche richiedono rete, permessi e un dispositivo compatibile.</T>
          <T tone="muted">Questo check-in non sostituisce un servizio di emergenza. In caso di pericolo chiama il 112.</T>
          <Button label="Prova una notifica sul mio dispositivo" variant="ghost" disabled={busy} onPress={() => run(() => featureRpc('test_checkin_notification'))} />
        </>}
      </View></Card>
      <Card><View style={{ gap: s.md }}>
        <Button label={historyOpen ? 'Nascondi ultimi check-in' : `Ultimi check-in (${history.length})`} variant="secondary" onPress={() => setHistoryOpen(value => !value)} />
        {historyOpen && <>
          {!history.length && <T tone="muted">Nessun check-in concluso.</T>}
          {history.map(item => <View key={item.id} style={{ paddingVertical: s.sm, borderBottomWidth: 1, borderBottomColor: c.border, gap: s.xs }}><T bold>{item.label}</T><T v="caption" tone="muted">{new Date(item.created_at).toLocaleDateString('it-IT')} · {historyStatus(item.status)}</T></View>)}
        </>}
      </View></Card>
    </>;

    const footer = mine ? <Button label="Sono arrivato/a" loading={busy} disabled={busy} onPress={() => update(mine, 'arrived')} /> : form ? <Button label="Avvia questo viaggio" loading={busy} disabled={busy || !canStart} onPress={() => begin(draft)} /> : null;
    return <Screen scroll={false} header={<Header title="Check-in di arrivo" onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} />} contentStyle={{ padding: 0, paddingBottom: 0, gap: 0 }}>
      <View style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: 620, alignSelf: 'center' }}>
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: s.lg, paddingBottom: s.xl, gap: s.md }}>{scrollContent}</ScrollView>
        {!!footer && <View style={{ backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: s.lg, paddingTop: s.sm, paddingBottom: Math.max(s.md, insets.bottom) }}>{footer}</View>}
      </View>
    </Screen>;
  }

  return <FeatureFrame title="Check-in di arrivo" error={data.error || routes.error} loading={data.loading || routes.loading} onRefresh={refresh}>
    <T tone="muted">Un tocco per partire, un tocco per dire che sei arrivato/a. Nessuna posizione condivisa.</T>
    {data.rows.filter(c => ['active', 'alerted'].includes(c.status)).map(c => <Card key={c.id} accent>
      <T v="title">{c.user_id === d.userId ? 'Il tuo viaggio' : d.names[c.user_id] || 'Partner'} · {c.label}</T>
      {!!c.origin && <T tone="muted">Da {c.origin}</T>}{!!c.note && <T>{c.note}</T>}
      <T tone={c.status === 'alerted' ? 'danger' : 'primary'}>{c.status === 'alerted' ? 'Arrivo non confermato · notifica richiesta a entrambi' : now >= Date.parse(c.due_at) ? 'È il momento di confermare l’arrivo' : `Arrivo tra ${Math.ceil((Date.parse(c.due_at) - now) / 60000)} min`}</T>
      <T tone="muted">Arrivo previsto {time(c.due_at)} · margine {c.grace_minutes} min</T>
      {c.user_id === d.userId ? <>
        <Button label="Sono arrivato/a" disabled={busy} onPress={() => update(c, 'arrived')} />
        <T>Sono in ritardo: aggiungi tempo</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[15, 30, 60].map(m => <Button key={m} small variant="secondary" label={`+${m} min`} disabled={busy || !canExtendCheckin(c, m, now)} onPress={() => update(c, 'extend', m)} />)}</View>
        <Button label="Annulla check-in" variant="ghost" disabled={busy} onPress={() => run(async () => {
          if (await confirmAction('Annulla check-in', 'Il viaggio verrà chiuso senza confermare l’arrivo. Avviseremo il partner.', 'Annulla check-in')) await featureRpc('update_checkin_v2', { p_id: c.id, p_action: 'cancel' });
        }, data.refresh)} />
      </> : c.status === 'alerted' && <Button label="Ho verificato: tutto bene" disabled={busy} onPress={() => run(async () => {
        if (await confirmAction('Conferma contatto', 'Hai verificato che il partner stia bene?', 'Sì, tutto bene')) await featureRpc('update_checkin_v2', { p_id: c.id, p_action: 'resolve' });
      }, data.refresh)} />}
    </Card>)}
    {!mine && <>
      <T v="title">I tuoi tragitti</T>
      {!routes.rows.length && <T tone="muted">Salva i percorsi abituali: le prossime volte non dovrai ricompilarli.</T>}
      {sortedRoutes(routes.rows).map(route => <Card key={route.id}>
        <T bold>{route.icon} {route.name}{route.favorite ? ' ★' : ''}</T>
        <T tone="muted">{route.origin ? `${route.origin} → ` : ''}{route.destination} · {route.minutes} min · margine {route.grace_minutes} min</T>
        <Button label={route.quick_start ? 'Parti ora' : 'Scegli questo tragitto'} disabled={busy} onPress={() => route.quick_start ? begin(route, true) : open(route)} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button small label="Modifica" variant="ghost" disabled={busy} onPress={() => open(route)} />
          <Button small label="Duplica" variant="ghost" disabled={busy} onPress={() => open(route, true)} />
          <Button small label="Elimina" variant="ghost" disabled={busy} onPress={() => run(async () => {
            if (await confirmAction('Elimina tragitto', `Eliminare «${route.name}»? I check-in già avviati restano invariati.`, 'Elimina')) {
              await featureRpc('delete_checkin_route', { p_id: route.id });
              if (editing === route.id) { setEditing(null); setForm(false); }
            }
          }, routes.refresh)} />
        </View>
      </Card>)}
      <Button label="Nuovo tragitto o viaggio singolo" variant="secondary" disabled={busy || preferences.loading || !!preferences.error} onPress={() => open()} />
      {form && <Card>
        <T v="title">{editing ? 'Personalizza il tragitto' : 'Dove vai?'}</T>
        <Input label="Destinazione" value={draft.destination} onChangeText={v => patch('destination', v)} maxLength={60} />
        <Input label="Durata abituale in minuti (5–720)" keyboardType="number-pad" value={String(draft.minutes || '')} onChangeText={v => patch('minutes', Number(v))} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[15, 30, 60, 120].map(m => <Chip key={m} label={`${m} min`} selected={draft.minutes === m} onPress={() => patch('minutes', m)} />)}</View>
        <T>Partenza {customDeparture ? `${day} · ${hour}` : `adesso · ${time(now)}`}</T>
        <Button small variant="ghost" label={customDeparture ? 'Usa l’ora attuale' : 'Modifica la partenza'} disabled={busy} onPress={() => {
          setDay(localDay(new Date())); setHour(time(Date.now())); setCustomDeparture(v => !v);
        }} />
        {customDeparture && <><DateField label="Giorno di partenza" value={day} onChange={setDay} minDate={localDay(new Date(now - 12 * 3600000))} maxDate={localDay(new Date(now + 24 * 3600000))} /><Input label="Ora di partenza (HH:MM, ora del dispositivo)" value={hour} onChangeText={setHour} maxLength={5} placeholder="18:30" /></>}
        <T bold>Arrivo previsto: {preview}</T>
        <T>Margine prima di avvisare entrambi</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[5, 10, 15, 30].map(m => <Chip key={m} label={`${m} min`} selected={draft.grace_minutes === m} onPress={() => patch('grace_minutes', m)} />)}</View>
        <Input label="Nota facoltativa" value={draft.note} onChangeText={v => patch('note', v)} maxLength={200} multiline />
        <Button label="Avvia questo viaggio" disabled={busy || !draft.destination.trim()} loading={busy} onPress={() => begin(draft)} />
        <T tone="muted">Le modifiche valgono solo per questo viaggio finché non salvi il tragitto.</T>
        <Button variant="ghost" label={options ? 'Chiudi preferenze del tragitto' : 'Salva o modifica le preferenze'} disabled={busy} onPress={() => setOptions(v => !v)} />
        {options && <>
          <Input label="Nome del tragitto" placeholder={draft.destination.trim() || 'Facoltativo: useremo la destinazione'} value={draft.name} onChangeText={v => patch('name', v)} maxLength={60} />
          <Input label="Partenza facoltativa" value={draft.origin} onChangeText={v => patch('origin', v)} maxLength={100} />
          <Input label="Icona o emoji" value={draft.icon} onChangeText={v => patch('icon', v)} maxLength={16} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['🏠', '💼', '🚉', '⛴️', '❤️', '🎓'].map(icon => <Chip key={icon} label={icon} selected={draft.icon === icon} onPress={() => patch('icon', icon)} />)}</View>
          <Chip label={draft.quick_start ? 'Avvio immediato: sì' : 'Avvio con riepilogo'} selected={draft.quick_start} onPress={() => patch('quick_start', !draft.quick_start)} />
          <Chip label={draft.favorite ? 'Preferito ★' : 'Aggiungi ai preferiti'} selected={draft.favorite} onPress={() => patch('favorite', !draft.favorite)} />
          <Input label="Ordine nell’elenco (0–9999)" keyboardType="number-pad" value={String(draft.position)} onChangeText={v => patch('position', Number(v))} />
          <Button label={editing ? 'Salva modifiche al tragitto' : 'Salva tragitto'} disabled={busy || !draft.destination.trim()} onPress={() => run(async () => {
            const at = Date.now(); validateJourney(draft.minutes, draft.grace_minutes, at, at);
            if (!Number.isInteger(draft.position) || draft.position < 0 || draft.position > 9999) throw new Error('Ordine: da 0 a 9999.');
            const route = { ...draft, name: draft.name.trim() || draft.destination.trim() };
            const id = await featureRpc<string>('save_checkin_route', { p_route: route, p_id: editing });
            setEditing(id); setDraft(route); setOptions(false); setForm(false); setRoutesOpen(true);
          }, routes.refresh)} />
        </>}
        <Button label="Chiudi" variant="ghost" disabled={busy} onPress={() => setForm(false)} />
      </Card>}
    </>}
    <Card>
      <T bold>Come funzionano gli avvisi</T>
      <T>All’arrivo previsto ricevi un promemoria. Se non confermi o aggiorni entro il margine, Pulse avvisa entrambi. Nessun banner nella Home.</T>
      <T tone="muted">Le notifiche richiedono rete e permessi attivi. Il check-in non è un servizio di emergenza: in caso di pericolo chiama il 112.</T>
      <Button variant="ghost" label="Prova una notifica sul mio dispositivo" disabled={busy} onPress={() => run(() => featureRpc('test_checkin_notification'))} />
    </Card>
    <T v="title">Ultimi check-in</T>
    {data.rows.filter(c => !['active', 'alerted'].includes(c.status)).slice(0, 15).map(c => <Card key={c.id}><T>{c.label} · {c.status === 'arrived' ? 'Arrivato/a' : c.status === 'resolved' ? 'Risolto' : c.status === 'cancelled' ? 'Annullato' : 'Scaduto'}</T><T tone="muted">{new Date(c.created_at).toLocaleDateString('it-IT')}</T></Card>)}
  </FeatureFrame>;
}

// Keep reminder synchronization, without rendering a Home banner.
export function CheckinReminderSync() {
  const { userId } = useAppDataFields(['userId']);
  const data = useFeatureRows<Checkin>('safe_checkins');
  const mine = data.rows.find(c => c.user_id === userId && c.status === 'active');
  useEffect(() => { void syncCheckinReminder(mine ?? null); }, [mine]);
  return null;
}
