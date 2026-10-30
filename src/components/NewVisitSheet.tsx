import { trackResult } from '../services/saveState';
import { useDraftField } from '../features/drafts/useDraftField';
import { SaveFeedback } from '../features/saving/SaveFeedback';
import { confirmAction } from '../utils/confirm';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { supabase } from '../config/supabase';
import { Visit } from '../types/travel';
import { useAppDataFields } from '../state/AppData';
import { MonthCalendar } from './MonthCalendar';
import { Button, Chip, Input, T, Row } from '../ui/primitives';
import { BottomSheet } from '../ui/layout';
import { useToast } from '../ui/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { formatDateIt } from '../utils/dates';
import { visitDateError } from '../utils/newVisit';
import { TRAVEL_MODES } from '../features/journeys/model';
import * as NotificationService from '../services/notification';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (visitId: string) => void;
}

const TRANSPORTS = TRAVEL_MODES;

/** Creazione incontro in tre passi: Dove → Quando → Come. */
export const NewVisitSheet: React.FC<Props> = ({ visible, onClose, onCreated }) => {
  const { s } = useTheme();
  const toast = useToast();
  const { userId, bucket, visits, refresh, today } = useAppDataFields(['bucket', 'refresh', 'userId', 'visits', 'today']);
  const [concluded, setConcluded] = useDraftField('new-visit', 'concluded', false);
  const [step, setStep] = useDraftField('new-visit', 'step', 0);
  const [title, setTitle] = useDraftField('new-visit', 'title', '');
  const [place, setPlace] = useDraftField('new-visit', 'place', '');
  const [wishes, setWishes] = useDraftField<string[]>('new-visit', 'wishes', []);
  const [start, setStart] = useDraftField<string | null>('new-visit', 'start', null);
  const [end, setEnd] = useDraftField<string | null>('new-visit', 'end', null);
  const [arrival, setArrival] = useDraftField('new-visit', 'arrival', '');
  const [hotel, setHotel] = useDraftField('new-visit', 'hotel', '');
  const [transport, setTransport] = useDraftField('new-visit', 'transport', '');
  const [notes, setNotes] = useDraftField('new-visit', 'notes', '');
  const [isAdult, setIsAdult] = useDraftField('new-visit', 'isAdult', false);
  const [saving, setSaving] = useState(false);

  const openWishes = useMemo(() => bucket.filter((b) => !b.is_completed), [bucket]);

  const reset = () => {
    setStep(0);
    setConcluded(false);
    setTitle('');
    setPlace('');
    setWishes([]);
    setStart(null);
    setEnd(null);
    setArrival('');
    setHotel('');
    setTransport('');
    setNotes('');
    setIsAdult(false);
  };

  const close = () => {
    onClose();
  };

  const pickDay = (day: string) => {
    if (!start || end) {
      setStart(day);
      setEnd(null);
    } else if (day >= start) {
      setEnd(day);
    } else {
      setStart(day);
    }
  };

  const next = () => {
    if (step === 0 && !title.trim()) return toast.error("Dai un titolo all'incontro");
    const dateError = visitDateError(start, end, concluded, today);
    if (step === 1 && dateError) return toast.error(dateError);
    setStep(step + 1);
  };

  const save = async () => {
    if (saving) return;
    if (!title.trim()) return toast.error("Dai un titolo all'incontro");
    const dateError = visitDateError(start, end, concluded, today);
    if (dateError || !start) return toast.error(dateError || 'Scegli le date dell’incontro');
    setSaving(true);
    const { data, error } = await trackResult(() => supabase
      .from('visits')
      .insert([
        {
          title: title.trim(),
          start_date: start,
          end_date: end || start,
          location: place.trim() || null,
          arrival_time: arrival.trim() || null,
          hotel: hotel.trim() || null,
          transport: transport || null,
          notes: notes.trim() || null,
          created_by: userId,
          status: concluded ? 'concluded' : 'planned',
          is_adult: isAdult,
        },
      ])
      .select()
      .single());

    if (error || !data) {
      setSaving(false);
      return toast.error('Errore creazione: ' + (error?.message || 'sconosciuto'));
    }
    if (wishes.length) {
      const { error: linkErr } = await trackResult(() => supabase
        .from('visit_bucket_items')
        .insert(wishes.map((id) => ({ visit_id: data.id, bucket_item_id: id }))));
      if (linkErr) toast.error("Incontro creato, ma non è stato possibile collegare i desideri: " + linkErr.message);
      else if (concluded) {
        const { error: completedErr } = await trackResult(() => supabase.from('bucket_list').update({ is_completed: true }).in('id', wishes));
        if (completedErr) toast.error('Incontro salvato, ma i desideri collegati non sono stati segnati come realizzati.');
      }
    }
    try { if (!concluded) {
      const wishTitles = bucket.filter((b) => wishes.includes(b.id)).map((b) => b.title).slice(0, 2);
      await NotificationService.scheduleVisitReminder(
        { ...(data as Visit), start_date: start, end_date: end || start },
        wishTitles
      ); }
    } catch (e) {}
    setSaving(false);
    toast.success('Incontro creato');
    const id = data.id as string;
    reset();
    await refresh(concluded && wishes.length ? ['visits', 'bucket_list'] : ['visits']);
    onCreated(id);
  };

  const footer = (
    <Row gap={s.sm}>
      {step > 0 ? <Button label="Indietro" variant="secondary" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
      {step < 2 ? (
        <Button label="Avanti" onPress={next} style={{ flex: 2 }} />
      ) : (
        <Button label={concluded ? 'Aggiungi incontro concluso' : 'Crea incontro'} icon="check" onPress={save} loading={saving} style={{ flex: 2 }} />
      )}
    </Row>
  );

  const titles = ['Dove', 'Quando', 'Come'];

  return (
    <BottomSheet visible={visible} title={`Nuovo incontro · ${titles[step]} (${step + 1}/3)`} onClose={close} footer={footer}>
      <SaveFeedback />
      <T v="caption" tone="muted">Puoi chiudere e riprendere il modulo: la bozza resta su questo dispositivo.</T>
      <Button label="Scarta questa bozza" variant="ghost" disabled={saving} onPress={async () => { if (await confirmAction('Scarta bozza', 'Vuoi svuotare il modulo del nuovo incontro?', 'Scarta')) { reset(); onClose(); } }} />
      {step === 0 && (
        <>
          <T bold>Che incontro vuoi aggiungere?</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
            <Chip label="Da organizzare" selected={!concluded} onPress={() => { if (concluded) { setConcluded(false); setStart(null); setEnd(null); } }} />
            <Chip label="Già concluso" selected={concluded} onPress={() => { if (!concluded) { setConcluded(true); setStart(null); setEnd(null); } }} />
          </View>
          {concluded && <T tone="muted">Aggiungi un incontro già vissuto: lo troverai nei Ricordi e potrai completarlo con foto e pensieri.</T>}
          <Input label="Titolo" placeholder="Es. Weekend a Roma" value={title} onChangeText={setTitle} />
          <Input label="Luogo o città" placeholder="Es. Roma" value={place} onChangeText={setPlace} />
          <T tone="muted">Desideri da realizzare insieme</T>
          {openWishes.length === 0 ? (
            <T tone="faint">Non ci sono desideri da realizzare. Aggiungine nella sezione Desideri.</T>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
              {openWishes.map((b) => (
                <Chip
                  key={b.id}
                  label={b.title}
                  icon={wishes.includes(b.id) ? 'check' : undefined}
                  selected={wishes.includes(b.id)}
                  onPress={() => setWishes((w) => (w.includes(b.id) ? w.filter((x) => x !== b.id) : [...w, b.id]))}
                />
              ))}
            </View>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <T tone="muted">
            {start ? `Dal ${formatDateIt(start)} al ${formatDateIt(end || start)}` : 'Tocca il giorno di arrivo, poi quello di partenza'}
          </T>
          <MonthCalendar visits={visits} range={{ start, end }} onPickDay={pickDay} allowPast={concluded} maxDate={concluded ? today : undefined} />
        </>
      )}

      {step === 2 && (
        <>
          <Input label="Orario di arrivo (facoltativo)" placeholder="Es. 18:30" keyboardType="numbers-and-punctuation" value={arrival} onChangeText={setArrival} />
          <Input label="Alloggio" placeholder="Es. B&B Centro" value={hotel} onChangeText={setHotel} />
          <T tone="muted">Come vi spostate</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
            {TRANSPORTS.map((t) => (
              <Chip key={t} label={t} selected={transport === t} onPress={() => setTransport(transport === t ? '' : t)} />
            ))}
          </View>
          <Input label="Note" placeholder="Qualsiasi cosa da ricordare" multiline value={notes} onChangeText={setNotes} style={{ minHeight: 80, textAlignVertical: 'top' }} />
          <Chip label="Etichetta +18" selected={isAdult} onPress={() => setIsAdult(value => !value)} />
        </>
      )}
    </BottomSheet>
  );
};
