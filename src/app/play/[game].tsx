import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { loadGame, loadedGame, playKey } from '../../features/games/lazyGames';
import { Screen, Header } from '../../ui/layout';
import { Button, T } from '../../ui/primitives';
import { useTheme } from '../../theme/ThemeProvider';
import { useGamePresence } from '../../features/games/useGamePresence';
export default function PlayRoute() {
  const { game } = useLocalSearchParams<{ game: string }>(); const key = playKey(game); const { c } = useTheme();
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(() => ({ key, component: loadedGame(key), failed: false }));
  useGamePresence(loaded.key === key && loaded.component ? key : null);
  useEffect(() => {
    let disposed = false;
    void loadGame(key).then(component => { if (!disposed) setLoaded({ key, component, failed: false }); })
      .catch(() => { if (!disposed) setLoaded({ key, component: undefined, failed: true }); });
    return () => { disposed = true; };
  }, [key, attempt]);
  const back = () => router.canGoBack() ? router.back() : router.replace('/game');
  if (loaded.key === key && loaded.component) return React.createElement(loaded.component, { onBack: back });
  return <Screen header={<Header title="Giochiamo" onBack={back} />}>
    {loaded.key === key && loaded.failed ? <>
      <T>Il gioco non si è caricato. Verifica la connessione e riprova.</T>
      <Button label="Riprova a caricare il gioco" onPress={() => setAttempt(value => value + 1)} />
      <Button label="Torna ai giochi" variant="secondary" onPress={() => router.replace('/game')} />
    </> : <><ActivityIndicator color={c.primary} /><T accessibilityLiveRegion="polite">Caricamento del gioco…</T></>}
  </Screen>;
}
