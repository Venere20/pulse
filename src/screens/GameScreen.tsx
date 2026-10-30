import { trackResult } from '../services/saveState';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, TouchableOpacity, View, Platform } from 'react-native';
import { supabase } from '../config/supabase';
import { useAppDataFields } from '../state/AppData';
import { TRIVIA } from '../data/triviaQuestions';
import { computeGameStats, optionOrder, questionForDay } from '../utils/trivia';
import { addDaysStr, formatDateIt } from '../utils/dates';
import { Screen, Header } from '../ui/layout';
import { Button, Card, Chip, T, Row } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../theme/tokens';

const LETTERS = ['A', 'B', 'C', 'D'];

export const GameScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {

  const { c, r, s } = useTheme();
  const toast = useToast();
  const d = useAppDataFields(['acceptDailyAnswer', 'answers', 'partnerId', 'refresh', 'today', 'userId']);
  const q = useMemo(() => questionForDay(d.today), [d.today]);
  const order = useMemo(() => optionOrder(q.id), [q.id]);
  const [picked, setPicked] = useState<number | null>(null); // indice originale
  const [saving, setSaving] = useState(false);
  const [reveal] = useState(() => new Animated.Value(0));

  const mine = d.answers.find((a) => a.day.slice(0, 10) === d.today && a.user_id === d.userId);
  const theirs = d.answers.find((a) => a.day.slice(0, 10) === d.today && a.user_id === d.partnerId);
  const unlocked = !!mine && !!theirs;
  const stats = useMemo(() => computeGameStats(d.answers, d.userId, d.partnerId, d.today), [d.answers, d.userId, d.partnerId, d.today]);

  useEffect(() => {
    if (unlocked) {
      reveal.setValue(0);
      Animated.spring(reveal, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    }
  }, [unlocked]);

  const submit = async () => {
    if (picked == null) return;
    setSaving(true);
    const { data, error } = await trackResult(() => supabase
      .from('daily_answers')
      .insert([{ day: d.today, question_id: q.id, user_id: d.userId, choice: picked }]).select('*'));
    setSaving(false);
    if (error) return toast.error('Risposta non salvata: ' + error.message);
    toast.success('Risposta inviata');
    if (data?.[0]) d.acceptDailyAnswer(data[0]);
    else void d.refresh(['daily_answers']);
  };

  // Ultimi giorni già sbloccati
  const history = useMemo(() => {
    const rows: { day: string; qText: string; meOk: boolean; partnerOk: boolean }[] = [];
    for (let i = 1; i <= 14 && rows.length < 5; i++) {
      const day = addDaysStr(d.today, -i);
      const a = d.answers.find((x) => x.day.slice(0, 10) === day && x.user_id === d.userId);
      const b = d.answers.find((x) => x.day.slice(0, 10) === day && x.user_id === d.partnerId);
      if (a && b && TRIVIA[a.question_id]) {
        const t = TRIVIA[a.question_id];
        rows.push({ day, qText: t.q, meOk: a.choice === t.answer, partnerOk: b.choice === t.answer });
      }
    }
    return rows;
  }, [d.answers, d.today, d.userId, d.partnerId]);

  const resultText = () => {
    if (!mine || !theirs) return '';
    const meOk = mine.choice === q.answer;
    const partnerOk = theirs.choice === q.answer;
    if (meOk && partnerOk) return 'Squadra perfetta! Avete indovinato entrambi: bonus +1 a testa 🎉';
    if (meOk) return 'Hai indovinato tu! Il partner ci proverà domani 😉';
    if (partnerOk) return 'Ha indovinato il partner: tocca a te recuperare domani 😅';
    return 'Nessuno dei due: oggi si impara qualcosa di nuovo 🌍';
  };

  return (
    <Screen header={<Header title="Domanda del giorno" subtitle="Cultura generale, in due" onBack={onBack} />}>
      <Card accent>
        <Row gap={s.lg} style={{ justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}>
            <T v="h1" tone="primary">{stats.myPoints}</T>
            <T tone="muted">Tu</T>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Row gap={4}>
              <Icon name="flame" size={22} color={c.warning} />
              <T v="h1">{stats.streak}</T>
            </Row>
            <T tone="muted">{stats.streak === 1 ? 'giorno di fila' : 'giorni di fila'}</T>
          </View>
          <View style={{ alignItems: 'center' }}>
            <T v="h1" tone="primary">{stats.partnerPoints}</T>
            <T tone="muted">Partner</T>
          </View>
        </Row>
        <T tone="faint" style={{ textAlign: 'center', marginTop: s.sm }}>
          +1 per ogni risposta giusta, +1 a testa se indovinate entrambi
        </T>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', marginBottom: s.sm }}>
          <Chip label={q.cat} icon="compass" />
        </View>
        <T v="h2" accessibilityRole="header">{q.q}</T>

        <View style={{ gap: s.sm, marginTop: s.lg }}>
          {order.map((orig, i) => {
            const text = q.options[orig];
            const chosenByMe = mine ? mine.choice === orig : picked === orig;
            const chosenByPartner = unlocked && theirs!.choice === orig;
            const isCorrect = unlocked && q.answer === orig;
            const border = isCorrect ? c.success : chosenByMe ? c.primary : c.border;
            return (
              <TouchableOpacity
                key={orig}
                accessibilityRole="button"
                accessibilityLabel={`Opzione ${LETTERS[i]}: ${text}`}
                accessibilityState={{ selected: chosenByMe, disabled: !!mine }}
                {...(Platform.OS === 'web' ? { 'aria-pressed': chosenByMe, 'aria-disabled': !!mine } : {})}
                disabled={!!mine}
                activeOpacity={0.85}
                onPress={() => setPicked(orig)}
                style={{
                  minHeight: MIN_TOUCH + 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: s.md,
                  paddingHorizontal: s.md,
                  borderRadius: r.md,
                  borderWidth: 2,
                  borderColor: border,
                  backgroundColor: isCorrect ? c.success + '22' : chosenByMe ? c.primarySoft : c.surfaceAlt,
                }}
              >
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: chosenByMe ? c.primary : c.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border }}>
                  <T bold tone={chosenByMe ? 'onPrimary' : 'muted'}>{LETTERS[i]}</T>
                </View>
                <T style={{ flex: 1 }} bold={chosenByMe || isCorrect}>{text}</T>
                {unlocked && chosenByMe && <T tone="primary" bold>Tu</T>}
                {chosenByPartner && <T tone="muted" bold>Partner</T>}
                {isCorrect && <Icon name="check" size={20} color={c.success} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {!mine && (
          <Button label="Conferma risposta" icon="check" onPress={submit} loading={saving} disabled={picked == null} style={{ marginTop: s.lg }} />
        )}

        {mine && !theirs && (
          <View style={{ marginTop: s.lg, backgroundColor: c.surfaceAlt, borderRadius: r.md, padding: s.md }}>
            <Row gap={s.sm}>
              <Icon name="lock" size={20} color={c.textMuted} />
              <T style={{ flex: 1 }}>Risposta inviata. Il risultato si sblocca quando risponde anche il partner.</T>
            </Row>
          </View>
        )}

        {unlocked && (
          <Animated.View
            style={{
              marginTop: s.lg,
              backgroundColor: c.primarySoft,
              borderRadius: r.md,
              padding: s.md,
              opacity: reveal,
              transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
            }}
          >
            <T bold>La risposta giusta: {q.options[q.answer]}</T>
            <T style={{ marginTop: 4 }}>{resultText()}</T>
          </Animated.View>
        )}
      </Card>

      {history.length > 0 && (
        <Card>
          <T v="title" style={{ marginBottom: s.sm }}>Ultime sfide</T>
          {history.map((h) => (
            <View key={h.day} style={{ paddingVertical: s.sm, borderBottomWidth: 1, borderBottomColor: c.border, gap: 2 }}>
              <T tone="muted">{formatDateIt(h.day)}</T>
              <T numberOfLines={2}>{h.qText}</T>
              <T tone={h.meOk && h.partnerOk ? 'success' : 'muted'} bold>
                Tu {h.meOk ? '✓' : '✗'} · Partner {h.partnerOk ? '✓' : '✗'}
              </T>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
};
