import React, { useState } from 'react';
import { View } from 'react-native';
import type { Visit } from '../../types/travel';
import { useAppDataFields } from '../../state/AppData';
import { Button, Card, Chip, Input, T } from '../../ui/primitives';
import { BottomSheet } from '../../ui/layout';
import { supabase } from '../../config/supabase';
import { confirmAction } from '../../utils/confirm';
import { useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { JourneyLeg, journeyDistance, MeetingCandidate, MidpointCriterion, rankMeetingCandidates, TRAVEL_MODES, TravelMode } from './model';
import { RoutePlanner } from './RoutePlanner';

export function JourneySection({ visit, onChanged, onSelectMeeting }: {
  visit: Visit; onChanged: () => Promise<unknown>; onSelectMeeting: (name: string, lat: number, lon: number) => Promise<unknown>;
}) {
  const d = useAppDataFields(['names', 'userId', 'partnerId', 'myCity', 'partnerCity']);
  const rows = useFeatureRows<Visit>('visits', { column: 'id', value: visit.id }, '', 1);
  const current = rows.rows[0] ?? visit;
  const { busy, run } = useFeatureAction();
  const [modes, setModes] = useState<TravelMode[] | null>(null);
  const own = modes ?? current.travel_preferences?.[d.userId] ?? [];
  const other = current.travel_preferences?.[d.partnerId] ?? [];
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [values, setValues] = useState<string[]>(Array(6).fill(''));
  const [roundTrip, setRoundTrip] = useState(true);
  const [expectedLegs, setExpectedLegs] = useState<JourneyLeg[]>([]);
  const [criterion, setCriterion] = useState<MidpointCriterion>('time');
  const context = JSON.stringify([current.travel_preferences, d.myCity, d.partnerCity]);
  const [candidates, setCandidates] = useState<{ context: string; rows: MeetingCandidate[] } | null>(null);
  const ranked = rankMeetingCandidates(candidates?.context === context ? candidates.rows : [], criterion);
  const distance = journeyDistance(current);
  const refresh = async () => { await Promise.all([rows.refresh(), onChanged()]); };
  const edit = () => {
    setExpectedLegs(current.journey_plan?.legs ?? []);
    const sums = [0, 0, 0, 0, 0, 0];
    for (const leg of current.journey_plan?.legs ?? []) {
      const group = leg.participants.length === 2 ? 2 : leg.participants[0] === d.userId ? 0 : 1;
      sums[group + (leg.direction === 'back' ? 3 : 0)] += leg.distance_m / 1000;
    }
    setValues(current.journey_plan ? sums.map(String) : Array(6).fill(''));
    setRoundTrip(current.journey_plan ? current.journey_plan.legs.some(l => l.direction === 'back') : true);
    setConfirming(false); setOpen(true);
  };
  const save = () => run(async () => {
    const count = roundTrip ? 6 : 3;
    const nums = values.slice(0, count).map(v => v.trim() ? Number(v.replace(',', '.')) : NaN);
    if (!nums.every(n => Number.isFinite(n) && n >= 0 && n <= 30000)) throw new Error('Compila tutte le distanze. Scrivi 0 soltanto se quella tratta non è stata percorsa.');
    // Keep confirmation in the same sheet: a second web Modal may sit behind it.
    if (!confirming) { setConfirming(true); return; }
    const legs: JourneyLeg[] = nums.map((km, i) => {
      const group = i % 3;
      const chosen = group === 0 ? current.travel_preferences?.[d.userId] : group === 1 ? other : [];
      return { id: `manual-${i}`, from: i < 3 ? group === 2 ? current.meeting_point || 'Punto di incontro' : 'Partenza personale' : group === 2 ? current.location || 'Destinazione' : current.meeting_point || 'Punto di incontro',
        to: i < 3 ? group === 2 ? current.location || 'Destinazione' : current.meeting_point || 'Punto di incontro' : group === 2 ? current.meeting_point || 'Punto di incontro' : 'Partenza personale',
        mode: chosen?.length === 1 ? chosen[0] : chosen?.length ? 'Misto' : 'Non specificato',
        participants: group === 2 ? [d.userId, d.partnerId] : [group === 0 ? d.userId : d.partnerId],
        direction: i < 3 ? 'out' : 'back', distance_m: Math.round(km * 1000), source: 'manual' };
    });
    await featureRpc('save_visit_journey_checked', { p_visit: visit.id, p_expected: expectedLegs, p_legs: legs }); setOpen(false); await refresh();
  });
  const suggest = () => run(async () => {
    const { data, error } = await supabase.functions.invoke('journey-midpoint-motis', { body: { visitId: visit.id } });
    if (error || !Array.isArray(data?.candidates)) throw new Error(data?.error || 'Il servizio dei percorsi non è ancora disponibile. Nessuna stima in linea d’aria viene presentata come percorso reale.');
    setCandidates({ context, rows: data.candidates });
    if (!data.candidates.length) throw new Error('Nessun punto confrontabile con i mezzi scelti. Verificate le partenze e i mezzi di entrambi.');
  });
  return <>
    <RoutePlanner visit={current} userId={d.userId} partnerId={d.partnerId} myCity={d.myCity} onChanged={refresh} />
    <Card><View style={{ gap: 12 }}>
      <T v="title">I tuoi mezzi per raggiungervi</T><T tone="muted">Puoi scegliere più mezzi. Il partner vedrà le tue scelte e potrà modificare soltanto le proprie.</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{TRAVEL_MODES.map(mode => <Chip key={mode} label={mode} selected={own.includes(mode)} onPress={busy ? undefined : () => setModes(own.includes(mode) ? own.filter(m => m !== mode) : [...own, mode])} />)}</View>
      <Button label="Salva i miei mezzi" loading={busy} disabled={modes === null} onPress={() => run(async () => { await featureRpc('set_my_visit_transport', { p_visit: visit.id, p_modes: own }); setCandidates(null); await refresh(); setModes(null); })} />
      <T bold>{d.names[d.partnerId] || 'Partner'}</T><T tone="muted">{other.length ? other.join(' · ') : 'Non ha ancora indicato i propri mezzi.'}</T>
    </View></Card>
    <Card><View style={{ gap: 12 }}><T v="title">Chilometri del percorso</T>
      <T>{distance.totalKm === null ? 'Distanza da completare' : `${distance.totalKm.toLocaleString('it-IT')} km totali`}</T>
      <T tone="muted">{distance.sharedKm === null ? 'Km insieme da verificare: la vecchia distanza generica non permette di ricostruirli.' : `${distance.sharedKm.toLocaleString('it-IT')} km percorsi insieme, contati una sola volta.`}</T>
      {!distance.verified && <T tone="muted">Il totale precedente, quando disponibile, resta una stima di andata e ritorno. Puoi correggere anche gli incontri passati.</T>}
      <Button label="Inserisci o correggi i chilometri" variant="secondary" disabled={rows.loading || !!rows.error || busy} onPress={edit} />
      {rows.error && <><T tone="danger">Percorso non disponibile: riprova prima di modificarlo.</T><Button label="Ricarica il percorso" variant="ghost" onPress={() => rows.refresh()} /></>}
    </View></Card>
    <Card><View style={{ gap: 12 }}><T v="title">Un punto di incontro equilibrato</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Chip label="Tempi simili" selected={criterion === 'time'} onPress={() => setCriterion('time')} /><Chip label="Distanze simili" selected={criterion === 'distance'} onPress={() => setCriterion('distance')} /></View>
      <T tone="muted">Confronta percorsi e mezzi di entrambi fra luoghi raggiungibili. Non è la metà geometrica e non garantisce il punto ottimale fra tutti i luoghi possibili.</T>
      <Button label="Confronta i punti di incontro" loading={busy} disabled={modes !== null} onPress={suggest} />
      {ranked.map((p, i) => <View key={p.id} style={{ gap: 6 }}><T bold>{i === 0 ? 'Consigliato · ' : ''}{p.name}</T><T>Tu: {(p.mine.meters / 1000).toLocaleString('it-IT')} km · {p.mine.minutes ?? '—'} min</T><T>Partner: {(p.partner.meters / 1000).toLocaleString('it-IT')} km · {p.partner.minutes ?? '—'} min</T><Button label={`Usa ${p.name}`} small variant="secondary" disabled={busy} onPress={() => run(async () => {
        if (await confirmAction('Cambia punto di incontro', 'Il percorso già confermato resterà conservato, ma andrà verificato rispetto al nuovo punto. Vuoi continuare?', 'Cambia punto')) await onSelectMeeting(p.name, p.lat, p.lon);
      })} /></View>)}
    </View></Card>
    <BottomSheet visible={open} title={confirming ? 'Conferma i chilometri' : 'Conferma le tratte percorse'} onClose={() => { if (!busy) setOpen(false); }} footer={<><Button label={confirming ? 'Conferma percorso' : 'Salva percorso e aggiorna statistiche'} loading={busy} onPress={save} />{confirming && <Button label="Torna alle distanze" variant="secondary" disabled={busy} onPress={() => setConfirming(false)} />}<Button label="Annulla" variant="ghost" disabled={busy} onPress={() => setOpen(false)} /></>}>
      {confirming ? <T>Questi valori sostituiranno il precedente calcolo dell’incontro anche nelle statistiche e nei nuovi traguardi. Le tratte condivise contano una volta. Totale: {values.slice(0, roundTrip ? 6 : 3).reduce((sum, v) => sum + Number(v.replace(',', '.')), 0).toLocaleString('it-IT')} km.</T> : <>
      <T>Somma tutti i mezzi usati per ciascun tragitto personale. Esempio: 70 km tuoi + 40 del partner + 100 insieme = 210 km di andata.</T>
      <Chip label="Includi il ritorno" selected={roundTrip} onPress={busy ? undefined : () => setRoundTrip(v => !v)} />
      {['Tu → punto di incontro', 'Partner → punto di incontro', 'Percorso insieme · andata', 'Tu → casa', 'Partner → casa', 'Percorso insieme · ritorno'].slice(0, roundTrip ? 6 : 3).map((label, i) => <Input key={i} label={`${label} · km`} keyboardType="decimal-pad" value={values[i]} onChangeText={v => setValues(old => old.map((x, j) => j === i ? v : x))} editable={!busy} />)}
      </>}
      {rows.error && <T tone="danger">{rows.error}</T>}
    </BottomSheet>
  </>;
}
