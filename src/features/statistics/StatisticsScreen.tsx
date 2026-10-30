import { countLabel } from '../../utils/italian';
import { DateField } from '../../ui/DateField';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useAppDataFields } from '../../state/AppData';
import { Button, Card, Chip, Input, T, ProgressBar } from '../../ui/primitives';
import { computeStats, StatsPeriod } from '../../utils/statistics';
import { actualVisitDates } from '../../utils/visitLifecycle';
import { confirmAction } from '../../utils/confirm';
import { FeatureFrame, useFeatureAction } from '../FeatureFrame';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
// Indicative product assumptions from docs/Idee/09_dashboard_statistiche.md.
// They are deliberately labelled estimates, not measured carbon emissions.
const factors: Record<string, number> = { treno: 0.04, bus: 0.09, auto: 0.17, aereo: 0.18, traghetto: 0.12, aliscafo: 0.15 };
interface Call {
    id: string;
    owner_id: string;
    day: string;
    minutes: number;
    note: string | null;
}
export function StatisticsScreen() {

    const d = useAppDataFields(['expenses', 'names', 'today', 'userId', 'visits']);
    const [period, setPeriod] = useState<StatsPeriod>('all');
    const stats = computeStats(d.visits, d.expenses, d.today, period);
    const calls = useFeatureRows<Call>('call_log');
    const { busy, run } = useFeatureAction();
    const [day, setDay] = useState(d.today);
    const [minutes, setMinutes] = useState('30');
    const [note, setNote] = useState('');
    const [edit, setEdit] = useState<string | null>(null);
    const years = Array.from(new Set(d.visits.map(actualVisitDates).map(v => Number(v.start_date.slice(0, 4))))).sort((a, b) => b - a);
    const validCalls = calls.rows.filter(c => period === 'all' || (period === 'last12' ? Date.parse(c.day) >= Date.parse(d.today) - 365 * 86400000 : Number(c.day.slice(0, 4)) === period));
    const co2 = stats.selected.reduce((sum, v) => { const factor = factors[v.transport?.toLowerCase() ?? '']; return sum + (factor !== undefined && !v.journey_totals && v.travel_km != null ? Number(v.travel_km) * 2 * factor : 0); }, 0);
    const covered = stats.selected.filter(v => !v.journey_totals && v.travel_km != null && factors[v.transport?.toLowerCase() ?? ''] !== undefined).length;
    const maxMonth = Math.max(1, ...stats.months.map(m => m.count));
    return <FeatureFrame title="La nostra storia in numeri">
  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><Chip label="Da sempre" selected={period === 'all'} onPress={() => setPeriod('all')}/><Chip label="Ultimi 12 mesi" selected={period === 'last12'} onPress={() => setPeriod('last12')}/>{years.map(y => <Chip key={y} label={String(y)} selected={period === y} onPress={() => setPeriod(y)}/>)}</View>
  <Card><T v="h2">{countLabel(stats.visits, 'incontro', 'incontri')} · {countLabel(stats.days, 'giorno insieme', 'giorni insieme')}</T><T tone="muted">Solo incontri conclusi. I giorni sovrapposti si contano una volta.</T>{stats.timedVisits > 0 && <><T>Tempo effettivo registrato: {Math.floor(stats.togetherMinutes / 60)} h {stats.togetherMinutes % 60} min</T><T tone="muted">Calcolato su {countLabel(stats.timedVisits, 'incontro con inizio e fine effettivi.', 'incontri con inizio e fine effettivi.')} Gli intervalli sovrapposti si contano una volta.</T></>}<T>Attesa media: {countLabel(Math.round(stats.averageWait), 'giorno', 'giorni')} · più lunga: {countLabel(stats.longestWait, 'giorno', 'giorni')}</T></Card>
  <Card><T v="h2">{Math.round(stats.travelKm).toLocaleString('it-IT')} km</T><T tone="muted">Tratte confermate contate una sola volta, con andata e ritorno separati. Per gli incontri senza percorso confermato resta la precedente stima A/R. {countLabel(stats.missingKm, 'incontro senza distanza.', 'incontri senza distanza.')}</T><T>{stats.sharedTravelKm.toLocaleString('it-IT')} km percorsi insieme</T><T tone="muted">{stats.unverifiedShared} incontri con km condivisi da verificare: le distanze generiche non sono considerate km insieme.</T><T>CO₂ indicativa sulle stime precedenti: {Math.round(co2)} kg su {countLabel(covered, 'incontro', 'incontri')}</T><T tone="muted">Fattori indicativi del progetto, per persona e km. Distanze stradali, occupazione dei mezzi e tratte aeree possono rendere la stima poco rappresentativa; non misura le emissioni reali.</T></Card>
  <Card><T v="title">Incontri negli ultimi 12 mesi</T>{stats.months.map(m => <View key={m.month} style={{ gap: 4, marginVertical: 5 }} accessible accessibilityLabel={`${m.month}: ${countLabel(m.count, 'incontro', 'incontri')}`}><T>{m.month} · {m.count}</T><ProgressBar value={m.count / maxMonth}/></View>)}</Card>
  <Card><T v="h2">{stats.spent.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</T><T tone="muted">Spese degli incontri selezionati; quelle senza incontro sono incluse se la data coincide, una sola volta.</T>{Object.entries(stats.byCategory).map(([cat, sum]) => <View key={cat} style={{ marginTop: 8 }}><T>{cat}: {sum.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</T><ProgressBar value={stats.spent ? sum / stats.spent : 0}/></View>)}{Object.entries(stats.byPayer).map(([id, sum]) => <T key={id}>{d.names[id] ?? 'Partner'} ha pagato {sum.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</T>)}</Card>
  <Card><T v="title">Chiamate · {countLabel(validCalls.reduce((sum, c) => sum + c.minutes, 0), 'minuto', 'minuti')}</T><T tone="muted">Registro manuale. Per evitare doppioni, registra ogni chiamata una sola volta.</T>{calls.error && <T tone="danger">{calls.error}</T>}
   <DateField label="Giorno della chiamata" value={day} onChange={setDay} maxDate={d.today} disabled={busy} /><Input label="Minuti · 1–720" value={minutes} onChangeText={setMinutes} keyboardType="number-pad"/><Input label="Nota facoltativa" value={note} onChangeText={setNote} maxLength={120}/>
   <Button label={edit ? "Salva modifiche" : 'Registra chiamata'} loading={busy} onPress={() => run(async () => { const value = Number(minutes); if (!Number.isInteger(value) || value < 1 || value > 720)
        throw new Error('Durata da 1 a 720 minuti'); if (calls.rows.some(c => c.id !== edit && c.day === day && Math.abs(c.minutes - value) <= 5) && !await confirmAction('Chiamata simile già presente', 'È una chiamata diversa?', 'Registra comunque'))
        return; await featureRpc('call_log_action', { p_action: edit ? 'edit' : 'add', p_id: edit, p_day: day, p_minutes: value, p_note: note }); setEdit(null); setNote(''); }, calls.refresh)}/>
   {validCalls.slice(0, 30).map(c => <View key={c.id} style={{ marginTop: 12 }}><T>{c.day} · {c.minutes} min · {d.names[c.owner_id] ?? 'Partner'}</T><T tone="muted">{c.note}</T>{c.owner_id === d.userId && <View style={{ flexDirection: 'row', gap: 8 }}><Button small variant="ghost" label="Modifica" onPress={() => { setEdit(c.id); setDay(c.day); setMinutes(String(c.minutes)); setNote(c.note ?? ''); }}/><Button small variant="ghost" label="Elimina" disabled={busy} onPress={() => run(() => featureRpc('call_log_action', { p_action: 'delete', p_id: c.id }), calls.refresh)}/></View>}</View>)}
  </Card>
 </FeatureFrame>;
}
