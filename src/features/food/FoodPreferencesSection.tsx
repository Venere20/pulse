import React, { useState } from 'react';
import { View } from 'react-native';
import { supabase } from '../../config/supabase';
import { useAppDataFields } from '../../state/AppData';
import { trackResult } from '../../services/saveState';
import { Button, Card, Chip, Input, SectionTitle, T } from '../../ui/primitives';
import { useToast } from '../../ui/Toast';
import { useFeatureRows } from '../useFeatureRows';
import { useFeatureAction } from '../FeatureFrame';

const FIELDS = [
  { key: 'allergies', label: 'Allergie e intolleranze', placeholder: 'Ingredienti da evitare ed eventuali precauzioni. Se non ne hai, puoi scriverlo qui.' },
  { key: 'diet', label: 'Come mangio', placeholder: 'Es. nessuna preferenza particolare, vegetariano, vegano, senza glutine…' },
  { key: 'likes', label: 'Mi piace', placeholder: 'Cibi, cucine e piatti che ami.' },
  { key: 'dislikes', label: 'Non mi piace', placeholder: 'Ingredienti e piatti che non gradisci.' },
  { key: 'drinks', label: 'Bevande', placeholder: 'Le tue preferenze su caffè, tè e altre bevande.' },
  { key: 'exceptions', label: 'Eccezioni', placeholder: 'Es. non mi piace il pomodoro crudo, ma mangio il sugo.' },
] as const;
type Values = Record<(typeof FIELDS)[number]['key'], string>;
type FoodRow = Values & { id: string };

function FoodPreferencesDetails() {
  const { userId, partnerId, names } = useAppDataFields(['userId', 'partnerId', 'names']);
  const data = useFeatureRows<FoodRow>('food_preferences', undefined, '', 2);
  const { busy, run } = useFeatureAction();
  const toast = useToast();
  const [partner, setPartner] = useState(false);
  const [draft, setDraft] = useState<Values | null>(null);
  const row = data.rows.find(value => value.id === (partner ? partnerId : userId));
  const editing = !partner && draft !== null;
  const edit = () => setDraft(Object.fromEntries(FIELDS.map(field => [field.key, row?.[field.key] ?? ''])) as Values);
  const save = () => {
    if (!draft || busy) return;
    const values = Object.fromEntries(FIELDS.map(field => [field.key, draft[field.key].trim()])) as Values;
    void run(async () => {
      const result = await trackResult(() => supabase.from('food_preferences').upsert({ id: userId, ...values }, { onConflict: 'id' }).select('*').single());
      if (result.error) throw new Error(result.error.message);
      data.updateRows(rows => [...rows.filter(value => value.id !== userId), result.data as FoodRow]);
      setDraft(null);
      toast.success('Preferenze alimentari salvate');
    });
  };
  return <View style={{ gap: 16 }}>
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      <Chip label="Le mie" selected={!partner} onPress={() => { if (!busy) setPartner(false); }} />
      <Chip label="Del partner" selected={partner} onPress={() => { if (!busy) setPartner(true); }} />
    </View>
    <T bold>{partner ? `Le preferenze di ${names[partnerId] || 'chi ami'}` : 'Le tue preferenze'}</T>
    <T tone="muted">{partner ? 'Puoi leggere questa scheda. Solo il partner può modificarla.' : 'Puoi modificare la tua scheda. Il partner può leggerla.'}</T>
    {data.error ? <><T tone="danger">Non riesco a caricare le preferenze alimentari.</T><Button label="Riprova" variant="secondary" onPress={() => { void data.refresh(); }} /></>
      : !data.hasSnapshot ? <T tone="muted">Caricamento…</T>
      : <>
        {FIELDS.map(field => editing ? <Input key={field.key} label={field.label} accessibilityLabel={field.label} placeholder={field.placeholder}
          value={draft[field.key]} onChangeText={text => setDraft(value => value ? { ...value, [field.key]: text } : value)}
          multiline maxLength={1000} editable={!busy} textAlignVertical="top" style={{ minHeight: 88 }} />
          : <View key={field.key} style={{ gap: 4 }}><T bold>{field.label}</T><T tone={row?.[field.key] ? 'default' : 'muted'}>{row?.[field.key] || 'Non ancora compilato'}</T></View>)}
        {!partner && (editing ? <View style={{ gap: 8 }}>
          <Button label="Salva preferenze alimentari" loading={busy} onPress={save} />
          <Button label="Annulla modifiche" variant="ghost" disabled={busy} onPress={() => setDraft(null)} />
        </View> : <Button label="Modifica le mie preferenze" variant="secondary" onPress={edit} />)}
      </>}
  </View>;
}

export function FoodPreferencesSection() {
  const { userId } = useAppDataFields(['userId']);
  const [open, setOpen] = useState(false);
  return <Card>
    <SectionTitle title="Preferenze alimentari" />
    {open ? <FoodPreferencesDetails key={userId} /> : <View style={{ gap: 12 }}>
      <T tone="muted">I vostri gusti, le esigenze alimentari e le eccezioni, in due schede personali condivise.</T>
      <Button label="Apri preferenze alimentari" variant="secondary" onPress={() => setOpen(true)} />
    </View>}
  </Card>;
}
