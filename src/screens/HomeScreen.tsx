import { countLabel } from '../utils/italian';
import { PulseStreakCard } from '../features/badges/PulseStreakCard';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../config/supabase';
import { useAppDataFields, isConcluded } from '../state/AppData';
import { PulseType, PULSE_MESSAGE_MAX } from '../types/pulse';
import { STATUS_OPTIONS } from '../types/status';

import { trackResult, uncertainWrite } from '../services/saveState';
import { useDraftField } from '../features/drafts/useDraftField';
import { useFeatureRows } from '../features/useFeatureRows';
import { useMinuteClock } from '../features/shared/useMinuteClock';
import { useCelebrations } from '../features/anniversaries/useCelebrations';
import {
  Emotion,
  EMOTIONS,
} from '../features/emotions/EmotionsScreen';
import { HomeFeatureLinks } from '../features/FeatureLinks';

import { questionForDay } from '../utils/trivia';
import { getCityCoordinates, calculateDistanceKm } from '../utils/geo';
import { visitStartMoment, timeLeftUntil } from '../utils/countdown';
import { formatDateIt } from '../utils/dates';

import { PulseButton } from '../components/PulseButton';
import { MOODS } from '../components/MoodSelector';
import { StatusSelector } from '../components/StatusSelector';
import { LastPulseCard } from '../components/LastPulseCard';
import { CountdownCard } from '../components/CountdownCard';

import { Screen, Header, IconButton } from '../ui/layout';
import { Card, Input, T } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../theme/tokens';
import { NotificationDot, useCategoryNotifications } from '../features/inbox/CategoryNotifications';

interface Props {
  onOpenVisit: (id: string) => void;
  onNewVisit: () => void;
  onOpenSettings: () => void;
  onOpenGame: () => void;
}

const QUICK_LINKS = [
  { emoji: '🎮', label: 'Giochi', path: '/game' },
  { emoji: '🎨', label: 'Lavagna', path: '/canvas' },
  { emoji: '📝', label: 'Frigo', path: '/frigo' },
  { emoji: '📅', label: 'Appuntamenti', path: '/appuntamenti' },
] as const;

export const HomeScreen: React.FC<Props> = ({
  onOpenVisit,
  onNewVisit,
  onOpenSettings,
  onOpenGame,
}) => {

  const { c, s, r } = useTheme();
  const compactQuickLinks = useWindowDimensions().width < 400;
  const toast = useToast();
  const d = useAppDataFields(['answers', 'changeMyStatus', 'lastPartnerPulse', 'myCity', 'myStatus', 'names', 'partnerCity', 'partnerId', 'partnerPulseReplied', 'partnerStatus', 'pulsesToday', 'refresh', 'today', 'totalTravelKm', 'userId', 'visits']);
  const celebrations = useCelebrations();
  const hasNews = useCategoryNotifications();

  // I gesti Pulse sono distinti dall'umore emotivo.
  // Manteniamo le chiavi delle bozze già esistenti.
  const [gesture, setGesture] = useDraftField<PulseType>(
    'pulse',
    'mood',
    'thinking',
  );
  const [message, setMessage] = useDraftField(
    'pulse',
    'message',
    '',
  );

  const [sending, setSending] = useState(false);
  const pulsePending = useRef(false);

  const [showStatus, setShowStatus] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showVisitDetails, setShowVisitDetails] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);

  const now = useMinuteClock();
  const emotionData = useFeatureRows<Emotion>('emotional_states');

  const partnerEmotion = emotionData.rows.find(
    (item) =>
      item.id === d.partnerId &&
      Date.parse(item.expires_at) > now,
  );

  const emotionLabel = EMOTIONS.find(
    (item) => item.id === partnerEmotion?.mood,
  )?.label;

  const partnerStatus = STATUS_OPTIONS.find(
    (item) => item.id === d.partnerStatus,
  );

  const partnerName = d.names[d.partnerId] || 'Il tuo partner';

  const nextVisit = useMemo(
    () =>
      d.visits.find((visit) => !isConcluded(visit, d.today)) ??
      null,
    [d.visits, d.today],
  );

  useEffect(() => {
    let active = true;

    if (!d.myCity || !d.partnerCity) {
      return;
    }

    (async () => {
      const [myCoords, partnerCoords] = await Promise.all([
        getCityCoordinates(d.myCity!),
        getCityCoordinates(d.partnerCity!),
      ]);

      if (!active) return;

      setDistanceKm(
        myCoords && partnerCoords
          ? calculateDistanceKm(
              myCoords.lat,
              myCoords.lon,
              partnerCoords.lat,
              partnerCoords.lon,
            )
          : null,
      );
    })();

    return () => {
      active = false;
    };
  }, [d.myCity, d.partnerCity]);

  // Mantiene la logica esistente di scrittura e gli errori incerti.
  const sendPulse = async (
    type: PulseType,
    text: string,
    replyTo?: string,
  ) => {
    if (pulsePending.current) return;

    pulsePending.current = true;
    setSending(true);

    try {
      const { error } = await trackResult(() =>
        supabase.from('pulse_logs').insert([
          {
            sender_id: d.userId,
            type,
            message: text.trim() || null,
            reply_to: replyTo || null,
          },
        ]),
      );

      if (error) throw new Error(error.message);

      toast.success(
        replyTo ? 'Risposta inviata ❤️' : 'Pulse inviato ❤️',
      );

      if (!replyTo) setMessage('');

      void d.refresh(['pulse_logs']);
    } catch (error) {
      toast.error(
        uncertainWrite(error)
          ? 'Invio da verificare: controlla l’ultimo Pulse quando torna la connessione prima di riprovare.'
          : 'Pulse non inviato: ' +
              (error instanceof Error
                ? error.message
                : 'Controlla la connessione'),
      );
    } finally {
      pulsePending.current = false;
      setSending(false);
    }
  };

  const selectedGesture =
    MOODS.find((item) => item.id === gesture) || MOODS[0];

  const question = questionForDay(d.today);
  const todayAnswers = d.answers.filter(
    (answer) => answer.day.slice(0, 10) === d.today,
  );

  const iAnswered = todayAnswers.some(
    (answer) => answer.user_id === d.userId,
  );
  const partnerAnswered = todayAnswers.some(
    (answer) => answer.user_id === d.partnerId,
  );

  const gameText = !iAnswered
    ? `Oggi: ${question.cat}. Rispondi alla domanda!`
    : partnerAnswered
      ? 'Risposte sbloccate: guarda chi ha indovinato'
      : 'Hai risposto: aspetta il partner per sbloccare';

  const visitStart = nextVisit
    ? visitStartMoment(
        nextVisit.start_date,
        nextVisit.arrival_time,
      )
    : null;

  const visitLeft = visitStart
    ? timeLeftUntil(visitStart, now)
    : null;

  const sectionStyle = {
    gap: s.md,
  } as const;

  return (
    <Screen
      header={
        <Header
          title="pulse."
          subtitle="IL VOSTRO SPAZIO"
          right={
            <View style={{ flexDirection: 'row' }}>
              <IconButton
                icon="search"
                label="Cerca nei vostri ricordi"
                onPress={() => router.push('/ricerca')}
              />
              <IconButton
                icon="bell"
                label="I tuoi avvisi"
                onPress={() => router.push('/avvisi')}
              />
              <IconButton
                icon="sliders"
                label="Impostazioni"
                onPress={onOpenSettings}
              />
            </View>
          }
        />
      }
    >
      <PulseStreakCard />
      {/* PARTNER: riga compatta, senza grande card. */}
      <View style={{ gap: s.sm }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Apri l'umore di ${partnerName}`}
          onPress={() => router.push('/umore')}
          activeOpacity={0.8}
          style={{
            minHeight: 64,
            flexDirection: 'row',
            alignItems: 'center',
            gap: s.md,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: c.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 25 }}>
              {partnerStatus?.emoji || '💗'}
            </Text>
          </View>

          <View style={{ flex: 1, gap: 3 }}>
            <T bold numberOfLines={1}>
              {partnerName}
            </T>
            <T tone="muted" v="caption" numberOfLines={1}>
              {partnerStatus?.label || 'Stato non impostato'}
            </T>
            <T tone="muted" v="caption" numberOfLines={1}>
              {emotionData.loading
                ? 'Umore in caricamento…'
                : emotionData.error
                  ? 'Umore non disponibile'
                  : emotionLabel || 'Umore non condiviso'}
            </T>
          </View>

          <Icon
            name="chevronRight"
            size={20}
            color={c.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded: showStatus }}
          accessibilityLabel="Gestisci il tuo stato"
          onPress={() => setShowStatus((value) => !value)}
          style={{
            minHeight: MIN_TOUCH,
            justifyContent: 'center',
            alignSelf: 'flex-start',
          }}
        >
          <T tone="primary" v="caption" bold>
            {showStatus
              ? 'Chiudi gestione stato'
              : 'Modifica il mio stato'}
          </T>
        </TouchableOpacity>

        {showStatus && (
          <StatusSelector
            myStatus={d.myStatus}
            partnerStatus={d.partnerStatus}
            onChange={d.changeMyStatus}
          />
        )}
      </View>

      {/* HERO: gesto principale. */}
      <Card outlined={false}>
        <View
          style={{
            alignItems: 'center',
            gap: s.md,
            paddingVertical: s.sm,
          }}
        >
          {celebrations.today.map((item) => (
            <T
              key={item.id}
              tone="primary"
              bold
              style={{ textAlign: 'center' }}
            >
              {item.emoji} Oggi festeggiamo: {item.title}
            </T>
          ))}

          <T v="h2" style={{ textAlign: 'center' }}>
            {selectedGesture.label}
          </T>

          <PulseButton
            size={108}
            celebration={celebrations.today[0]?.emoji}
            loading={sending}
            selectedMood={selectedGesture}
            onPress={() => sendPulse(selectedGesture.id, message)}
          />

          <T
            tone="muted"
            v="caption"
            style={{ textAlign: 'center' }}
          >
            Tocca il pulsante grande per inviare. Qui sotto puoi cambiare pensiero.
          </T>

          <View
            style={{
              width: '100%',
              flexDirection: 'row',
              gap: s.sm,
            }}
          >
            {MOODS.filter((item) => item.id !== selectedGesture.id).map((item) => {
              const selected = gesture === item.id;

              return (
                <TouchableOpacity
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Seleziona ${item.label}`}
                  accessibilityState={{ selected, disabled: sending }}
                  onPress={() => setGesture(item.id)}
                  disabled={sending}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 68,
                    paddingHorizontal: 4,
                    borderRadius: r.md,
                    backgroundColor: selected
                      ? c.primarySoft
                      : c.surfaceAlt,
                    borderWidth: selected ? 1 : 0,
                    borderColor: c.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    opacity: sending ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>
                    {item.emoji}
                  </Text>
                  <T
                    v="caption"
                    bold={selected}
                    style={{
                      fontSize: 12,
                      color: selected ? c.primary : c.text,
                    }}
                    numberOfLines={1}
                  >
                    {item.label}
                  </T>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ width: '100%', gap: 4 }}>
            <Input
              label="Aggiungi un messaggio (facoltativo)"
              placeholder="Una frase solo per voi…"
              value={message}
              onChangeText={(text) =>
                setMessage(text.slice(0, PULSE_MESSAGE_MAX))
              }
              maxLength={PULSE_MESSAGE_MAX}
            />

            <T
              tone="faint"
              v="caption"
              style={{ textAlign: 'right' }}
            >
              {message.length}/{PULSE_MESSAGE_MAX}
            </T>
          </View>

        </View>
      </Card>

      {/* QUATTRO ATTIVITÀ PRINCIPALI. */}
      <View style={sectionStyle}>
        <T v="title" accessibilityRole="header">
          Facciamo qualcosa insieme?
        </T>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: s.sm,
          }}
        >
          {QUICK_LINKS.map((item) => (
            <TouchableOpacity
              key={item.path}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}${hasNews(item.path) ? ', novità da leggere' : ''}`}
              activeOpacity={0.8}
              onPress={() => router.push(item.path)}
              style={{
                flexBasis: compactQuickLinks ? '46%' : '22%',
                flexGrow: 1,
                minWidth: 0,
                minHeight: 78,
                borderRadius: r.md,
                backgroundColor: c.surface,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                gap: s.sm,
              }}
            >
              <View style={{ position: 'absolute', right: 10, top: 10 }}><NotificationDot visible={hasNews(item.path)} /></View>
              <Text style={{ fontSize: 24 }}>
                {item.emoji}
              </Text>
              <T
                v="caption"
                numberOfLines={2}
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                }}
              >
                {item.label}
              </T>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ULTIMO PULSE: mantiene tutte le risposte attuali. */}
      <LastPulseCard
        lastPulse={d.lastPartnerPulse}
        countToday={d.pulsesToday}
        replied={d.partnerPulseReplied}
        replying={sending}
        onReply={(type, replyTo) =>
          sendPulse(type, '', replyTo)
        }
      />

      {/* PROSSIMO INCONTRO: riepilogo compatto. */}
      <View style={sectionStyle}>
        <T v="title" accessibilityRole="header">
          Quando ci rivediamo?
        </T>

        {nextVisit ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Apri incontro ${nextVisit.title}`}
            activeOpacity={0.8}
            onPress={() => onOpenVisit(nextVisit.id)}
          >
            <Card outlined={false}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: s.md,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: r.md,
                    backgroundColor: c.primarySoft,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Icon
                    name="calendar"
                    size={24}
                    color={c.primary}
                  />
                </View>

                <View style={{ flex: 1, gap: 4 }}>
                  <T bold numberOfLines={1}>
                    {nextVisit.title}
                  </T>

                  <T tone="muted" v="caption">
                    {formatDateIt(nextVisit.start_date)}
                    {nextVisit.end_date !== nextVisit.start_date
                      ? ` → ${formatDateIt(nextVisit.end_date)}`
                      : ''}
                  </T>

                  <T tone="primary" v="caption" bold>
                    {visitLeft && visitLeft.days > 0
                      ? `Tra ${countLabel(visitLeft.days, 'giorno', 'giorni')}`
                      : 'Apri i dettagli dell’incontro'}
                  </T>
                </View>

                <Icon
                  name="chevronRight"
                  size={20}
                  color={c.textMuted}
                />
              </View>
            </Card>
          </TouchableOpacity>
        ) : (
          <Card outlined={false}>
            <View style={{ gap: s.md }}>
              <T tone="muted">
                Non avete ancora un incontro in programma.
                Quando vi rivedrete?
              </T>

              <TouchableOpacity
                accessibilityRole="button"
                onPress={onNewVisit}
                style={{
                  minHeight: MIN_TOUCH,
                  justifyContent: 'center',
                }}
              >
                <T tone="primary" bold>
                  + Pianifica un incontro
                </T>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{
            expanded: showVisitDetails,
          }}
          onPress={() =>
            setShowVisitDetails((value) => !value)
          }
          style={{
            minHeight: MIN_TOUCH,
            justifyContent: 'center',
          }}
        >
          <T tone="primary" v="caption" bold>
            {showVisitDetails
              ? "Nascondi il conto alla rovescia completo"
              : "Mostra conto alla rovescia, distanza e meteo"}
          </T>
        </TouchableOpacity>

        {showVisitDetails && (
          <CountdownCard
            visit={nextVisit}
            manualTogether={d.myStatus === 'together'}
            distanceKm={
              d.myCity && d.partnerCity
                ? distanceKm
                : null
            }
            myCity={d.myCity}
            partnerCity={d.partnerCity}
            onPress={() =>
              nextVisit && onOpenVisit(nextVisit.id)
            }
            onCreate={onNewVisit}
          />
        )}
      </View>

      {/* DOMANDA DEL GIORNO E ALTRI DATI ESISTENTI. */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Apri la domanda del giorno"
        activeOpacity={0.8}
        onPress={onOpenGame}
      >
        <Card outlined={false}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: s.md,
            }}
          >
            <Icon
              name="helpCircle"
              size={24}
              color={c.primary}
            />

            <View style={{ flex: 1, gap: 4 }}>
              <T bold>Domanda del giorno</T>
              <T tone="muted" v="caption">
                {gameText}
              </T>
            </View>

            <Icon
              name="chevronRight"
              size={20}
              color={c.textMuted}
            />
          </View>
        </Card>
      </TouchableOpacity>

      {d.totalTravelKm > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: s.sm,
          }}
        >
          <Icon
            name="navigation"
            size={18}
            color={c.primary}
          />
          <T tone="muted" v="caption">
            Avete percorso{' '}
            <T bold tone="primary">
              {Math.round(d.totalTravelKm).toLocaleString(
                'it-IT',
              )}{' '}
              km
            </T>{' '}
            per vedervi.
          </T>
        </View>
      )}

      {/* MANTIENE PROPOSTE, CAPSULE, MODALITÀ INSIEME,
          CHECK-IN E TUTTI I COLLEGAMENTI ORIGINALI. */}
      <View style={{ gap: s.sm }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Altre funzioni di Pulse"
          accessibilityState={{ expanded: showTools }}
          onPress={() => setShowTools((value) => !value)}
          activeOpacity={0.8}
          style={{
            minHeight: MIN_TOUCH,
            paddingHorizontal: s.md,
            backgroundColor: c.surface,
            borderRadius: r.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <T bold>Altre funzioni e aggiornamenti</T>
          <Icon
            name="chevronRight"
            size={20}
            color={c.textMuted}
          />
        </TouchableOpacity>

        {showTools && <HomeFeatureLinks />}
      </View>
    </Screen>
  );
};
