import { trackResult } from '../services/saveState';
import React, { useMemo, useState } from 'react';
import { TouchableOpacity, View, Platform } from 'react-native';
import { supabase } from '../config/supabase';
import { useAppDataFields } from '../state/AppData';
import { useGames } from '../state/Games';
import { WYR } from '../data/wyrQuestions';
import { computeWyrStats, wyrForDay } from '../utils/wyr';
import { addDaysStr, formatDateIt } from '../utils/dates';
import { Screen, Header } from '../ui/layout';
import { Button, Card, T, Row } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../theme/tokens';

export const WyrScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {

  const { c, r, s } = useTheme();
  const toast = useToast();
  const d = useAppDataFields(['partnerId', 'today', 'userId']);
  const g = useGames();
  const q = useMemo(() => wyrForDay(d.today), [d.today]);
  const [picked, setPicked] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const mine = g.wyrAnswers.find((a) => a.day.slice(0, 10) === d.today && a.user_id === d.userId);
  const theirs = g.wyrAnswers.find((a) => a.day.slice(0, 10) === d.today && a.user_id === d.partnerId);
  const unlocked = !!mine && !!theirs;
  const stats = useMemo(() => computeWyrStats(g.wyrAnswers, d.userId, d.partnerId), [g.wyrAnswers, d.userId, d.partnerId]);

  const submit = async () => {
    if (picked == null) return;
    setSaving(true);
    const { data, error } = await trackResult(() => supabase
      .from('wyr_answers')
      .insert([{ day: d.today, question_id: q.id, user_id: d.userId, choice: picked }]).select('*'));
    setSaving(false);
    if (error) return toast.error('Risposta non salvata: ' + error.message);
    toast.success('Risposta inviata');
    if (data?.[0]) g.acceptWyr(data[0]);
    else void g.refresh(['wyr_answers']);
  };

  // Ultimi giorni in cui avete risposto entrambi
  const history = useMemo(() => {
    const rows: { day: string; a: string; b: string; meChoice: number; partnerChoice: number }[] = [];
    for (let i = 1; i <= 21 && rows.length < 5; i++) {
      const day = addDaysStr(d.today, -i);
      const x = g.wyrAnswers.find((v) => v.day.slice(0, 10) === day && v.user_id === d.userId);
      const y = g.wyrAnswers.find((v) => v.day.slice(0, 10) === day && v.user_id === d.partnerId);
      if (x && y && WYR[x.question_id]) {
        rows.push({ day, a: WYR[x.question_id].a, b: WYR[x.question_id].b, meChoice: x.choice, partnerChoice: y.choice });
      }
    }
    return rows;
  }, [g.wyrAnswers, d.today, d.userId, d.partnerId]);

  const options = [q.a, q.b];

  return (
    <Screen header={<Header title="Preferisci…?" subtitle="Una scelta al giorno, in due" onBack={onBack} />}>
      {!g.available && g.loaded ? (
        <Card>
          <T tone="muted">Il gioco non è disponibile al momento. Riprova più tardi.</T>
        </Card>
      ) : (
        <>
          <Card accent>
            <Row gap={s.lg} style={{ justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <T v="h1" tone="primary">{stats.percent}%</T>
                <T tone="muted">sintonia</T>
              </View>
              <View style={{ alignItems: 'center' }}>
                <T v="h1">{stats.matches}/{stats.days}</T>
                <T tone="muted">scelte uguali</T>
              </View>
            </Row>
          </Card>

          <Card>
            <T v="h2" accessibilityRole="header">Cosa preferisci?</T>

            <View style={{ gap: s.sm, marginTop: s.lg }}>
              {options.map((text, i) => {
                const chosenByMe = mine ? mine.choice === i : picked === i;
                const chosenByPartner = unlocked && theirs!.choice === i;
                const both = chosenByMe && chosenByPartner;
                return (
                  <TouchableOpacity
                    key={i}
                    accessibilityRole="button"
                    accessibilityLabel={`Opzione ${i === 0 ? 'A' : 'B'}: ${text}`}
                    accessibilityState={{ selected: chosenByMe, disabled: !!mine }}
                    {...(Platform.OS === 'web' ? { 'aria-pressed': chosenByMe, 'aria-disabled': !!mine } : {})}
                    disabled={!!mine}
                    activeOpacity={0.85}
                    onPress={() => setPicked(i)}
                    style={{
                      minHeight: MIN_TOUCH + 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: s.md,
                      paddingHorizontal: s.md,
                      paddingVertical: s.sm,
                      borderRadius: r.md,
                      borderWidth: 2,
                      borderColor: both ? c.success : chosenByMe ? c.primary : c.border,
                      backgroundColor: both ? c.success + '22' : chosenByMe ? c.primarySoft : c.surfaceAlt,
                    }}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: chosenByMe ? c.primary : c.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: c.border,
                      }}
                    >
                      <T bold tone={chosenByMe ? 'onPrimary' : 'muted'}>{i === 0 ? 'A' : 'B'}</T>
                    </View>
                    <T style={{ flex: 1 }} bold={chosenByMe}>{text}</T>
                    {unlocked && chosenByMe && <T tone="primary" bold>Tu</T>}
                    {chosenByPartner && <T tone="muted" bold>Partner</T>}
                  </TouchableOpacity>
                );
              })}
            </View>

            {!mine && (
              <Button label="Conferma scelta" icon="check" onPress={submit} loading={saving} disabled={picked == null} style={{ marginTop: s.lg }} />
            )}

            {mine && !theirs && (
              <View style={{ marginTop: s.lg, backgroundColor: c.surfaceAlt, borderRadius: r.md, padding: s.md }}>
                <Row gap={s.sm}>
                  <Icon name="lock" size={20} color={c.textMuted} />
                  <T style={{ flex: 1 }}>Scelta inviata. Il confronto si sblocca quando risponde anche il partner.</T>
                </Row>
              </View>
            )}

            {unlocked && (
              <View style={{ marginTop: s.lg, backgroundColor: c.primarySoft, borderRadius: r.md, padding: s.md }}>
                <T bold>
                  {mine!.choice === theirs!.choice
                    ? 'Stessa scelta! Siete in sintonia 💞'
                    : "Scelte diverse: raccontatevi il perché 😄"}
                </T>
              </View>
            )}
          </Card>

          {history.length > 0 && (
            <Card>
              <T v="title" style={{ marginBottom: s.sm }}>Ultime scelte</T>
              {history.map((h) => (
                <View key={h.day} style={{ paddingVertical: s.sm, borderBottomWidth: 1, borderBottomColor: c.border, gap: 2 }}>
                  <T tone="muted">{formatDateIt(h.day)}</T>
                  <T numberOfLines={2}>{h.a} oppure {h.b}</T>
                  <T tone={h.meChoice === h.partnerChoice ? 'success' : 'muted'} bold>
                    Tu: {h.meChoice === 0 ? 'A' : 'B'} · Partner: {h.partnerChoice === 0 ? 'A' : 'B'}
                    {h.meChoice === h.partnerChoice ? ' 💞' : ''}
                  </T>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
};
