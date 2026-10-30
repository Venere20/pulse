import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useAppDataFields } from '../state/AppData';
import { useGames } from '../state/Games';
import { PlayKey } from '../types/games';
import { Screen, Header } from '../ui/layout';
import { Card, T, Row } from '../ui/primitives';
import { Icon, IconName } from '../ui/Icon';
import { useTheme } from '../theme/ThemeProvider';
import { useDeepTalkSummary } from '../features/deeptalk/useDeepTalkSummary';
import { NotificationDot, useCategoryNotifications } from '../features/inbox/CategoryNotifications';

interface Props {
  onOpen: (game: PlayKey) => void;
}

const GameRow: React.FC<{ game: PlayKey; icon: IconName; title: string; text: string; highlight?: boolean; onPress: () => void }> = ({
  game,
  icon,
  title,
  text,
  highlight,
  onPress,
}) => {
  const { c, s } = useTheme();
  const hasNews = useCategoryNotifications();
  const news = hasNews(`/play/${game}`);
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${title}. ${text}${news ? '. Novità da leggere' : ''}`} activeOpacity={0.9} onPress={onPress}>
      <Card accent={highlight}>
        <Row gap={s.md}>
          <Icon name={icon} size={28} color={c.primary} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><T v="title" style={{ flex: 1 }}>{title}</T><NotificationDot visible={news} /></View>
            <T tone={highlight ? 'primary' : 'muted'} bold={highlight}>{text}</T>
          </View>
          <Icon name="chevronRight" size={20} color={c.textFaint} />
        </Row>
      </Card>
    </TouchableOpacity>
  );
};

export const GamesHubScreen: React.FC<Props> = React.memo(({ onOpen }) => {
  const { c, s, r } = useTheme();
  const [mode, setMode] = React.useState<'couple' | 'solo'>('couple');
  const d = useAppDataFields(['answers', 'partnerId', 'today', 'userId']);
  const g = useGames();
  const deepTalk = useDeepTalkSummary();

  // Domanda del giorno (cultura generale)
  const todays = d.answers.filter((a) => a.day.slice(0, 10) === d.today);
  const iAnswered = todays.some((a) => a.user_id === d.userId);
  const partnerAnswered = todays.some((a) => a.user_id === d.partnerId);
  const dailyText = !iAnswered
    ? 'Una domanda nuova ti aspetta'
    : partnerAnswered
    ? 'Risposte sbloccate: guarda chi ha indovinato'
    : 'Hai risposto: aspetta il partner';

  // Preferisci…?
  const wyrToday = g.wyrAnswers.filter((a) => a.day.slice(0, 10) === d.today);
  const wyrMine = wyrToday.some((a) => a.user_id === d.userId);
  const wyrTheirs = wyrToday.some((a) => a.user_id === d.partnerId);
  const wyrText = !g.available
    ? 'Non ancora attivo'
    : !wyrMine
    ? wyrTheirs
      ? 'Il partner ha già scelto: tocca a te!'
      : 'Cosa preferisci oggi?'
    : wyrTheirs
    ? 'Scelte sbloccate: guarda se coincidono'
    : 'Hai scelto: aspetta il partner';

  // Tris
  const match = g.trisMatches[0];
  const trisText = !g.available
    ? 'Non ancora attivo'
    : !match
    ? 'Sfida il partner a una partita'
    : match.status === 'playing'
    ? match.turn === d.userId
      ? 'Tocca a te!'
      : 'Aspetti la mossa del partner'
    : match.status === 'cancelled'
    ? 'Partita annullata. Iniziamone una nuova?'
    : match.status === 'draw'
    ? 'Ultima partita: pareggio. Rivincita?'
    : match.winner === d.userId
    ? 'Hai vinto l\'ultima partita! Rivincita?'
    : 'Ha vinto il partner. Rivincita?';

  const gameRows = {
    couple: [
      <GameRow key="deeptalk" game="deeptalk" icon="heart" title="Deep Talk" text={deepTalk.error ? 'Non ancora disponibile' : deepTalk.pending ? 'Il partner ti aspetta: una risposta da sbloccare' : `${deepTalk.answered}/3 risposte nella carta della settimana`} highlight={deepTalk.pending} onPress={() => onOpen('deeptalk')} />,
      <GameRow key="daily" game="daily" icon="helpCircle" title="Domanda del giorno" text={dailyText} highlight={!iAnswered} onPress={() => onOpen('daily')} />,
      <GameRow key="wyr" game="wyr" icon="heart" title="Preferisci…?" text={wyrText} highlight={g.wyrPending} onPress={() => onOpen('wyr')} />,
      <GameRow key="drawguess" game="drawguess" icon="edit" title="Disegna e indovina" text="Una parola segreta e otto tentativi" onPress={() => onOpen('drawguess')} />,
      <GameRow key="battleship" game="battleship" icon="compass" title="Battaglia navale" text="Posiziona la flotta e sfida il partner" onPress={() => onOpen('battleship')} />,
      <GameRow key="connect4" game="connect4" icon="trophy" title="Forza 4" text="Allineate quattro gettoni, una mossa alla volta" onPress={() => onOpen('connect4')} />,
      <GameRow key="tris" game="tris" icon="trophy" title="Tris" text={trisText} highlight={g.trisMyTurn} onPress={() => onOpen('tris')} />,
    ],
    solo: [
      <GameRow key="hearts" game="hearts" icon="heart" title="Acchiappa cuori" text="Bombe, tempo extra e tre livelli di difficoltà" onPress={() => onOpen('hearts')} />,
      <GameRow key="stars" game="stars" icon="star" title="Unisci le stelle" text="Illumina il tuo cielo, una stella alla volta" onPress={() => onOpen('stars')} />,
      <GameRow key="memory" game="memory" icon="image" title="Memory dei ricordi" text="Abbina i simboli, senza usare le vostre foto" onPress={() => onOpen('memory')} />,
      <GameRow key="sequence" game="sequence" icon="star" title="Sequenza luminosa" text="120 livelli di memoria, cinque vite e tre difficoltà" onPress={() => onOpen('sequence')} />,
      <GameRow key="secretword" game="secretword" icon="edit" title="Parola segreta" text="200 parole italiane, indizi e lettere da scoprire" onPress={() => onOpen('secretword')} />,
      <GameRow key="wordsearch" game="wordsearch" icon="search" title="Trova le parole" text="200 griglie da esplorare, anche in diagonale" onPress={() => onOpen('wordsearch')} />,
      <GameRow key="clouds" game="clouds" icon="compass" title="Schiva le nuvole" text="100 ondate, stelle da raccogliere e pausa con salvataggio" onPress={() => onOpen('clouds')} />,
      <GameRow key="sliding" game="sliding" icon="image" title="Puzzle scorrevole" text="200 schemi per difficoltà: 3×3, 4×4 e 5×5" onPress={() => onOpen('sliding')} />,
    ],
  };

  return (
    <Screen
      header={
        <Header
          title="Giochiamo"
          subtitle="UN MOMENTO PER NOI"
        />
      }
    >
      <View style={{ gap: 6 }}>
        <T v="h2">Come vuoi giocare?</T>
        <T tone="muted">
          Un momento insieme o una piccola sfida
          tutta tua.
        </T>
      </View>
  
      {/* SELEZIONE MODALITÀ */}
      <View
        style={{
          flexDirection: 'row',
          gap: s.sm,
        }}
      >
        {[
          {
            id: 'couple' as const,
            title: 'In coppia',
            icon: 'heart' as IconName,
            count: gameRows.couple.length,
          },
          {
            id: 'solo' as const,
            title: "In solitaria",
            icon: 'user' as IconName,
            count: gameRows.solo.length,
          },
        ].map((option) => {
          const selected = mode === option.id;
  
          return (
            <TouchableOpacity
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={option.title}
              accessibilityState={{ selected }}
              onPress={() => setMode(option.id)}
              style={{
                flex: 1,
                minHeight: 76,
                borderRadius: r.lg,
                borderWidth: 1,
                borderColor: selected
                  ? c.primary
                  : c.border,
                backgroundColor: selected
                  ? c.primarySoft
                  : c.surface,
                padding: s.md,
                gap: 6,
                justifyContent: 'center',
              }}
            >
              <Icon
                name={option.icon}
                size={23}
                color={
                  selected ? c.primary : c.textMuted
                }
              />
  
              <T
                bold
                tone={selected ? 'primary' : 'default'}
              >
                {option.title}
              </T>
  
              <T v="caption" tone="muted">
                {option.count} giochi
              </T>
            </TouchableOpacity>
          );
        })}
      </View>
  
      <View style={{ gap: s.sm }}>
        <T v="title">{mode === 'couple' ? 'Da giocare insieme' : 'Un momento tutto tuo'}</T>
        {gameRows[mode]}
      </View>
    </Screen>
  );
});

GamesHubScreen.displayName = 'GamesHubScreen';
