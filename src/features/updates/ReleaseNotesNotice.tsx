import React, { useState, useSyncExternalStore } from 'react';
import { Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { useAppForeground } from '../../hooks/useActivity';
import { useAppDataFields } from '../../state/AppData';
import { draftStorage } from '../../services/drafts/storage';
import { IconButton } from '../../ui/layout';
import { Button, T } from '../../ui/primitives';
import { useToast } from '../../ui/Toast';
import { useTheme } from '../../theme/ThemeProvider';
import { ReleaseNotesContent } from './ReleaseNotesContent';
import { useBadges } from '../badges/Badges';
import { RELEASE_NOTES, unseenReleases } from './releaseNotes';
import { createReleaseNotesState } from './releaseNotesState';
import { updateSafeRoute } from './updateSafety';
import { updateProtection } from './updateProtection';

const acknowledgements = createReleaseNotesState(draftStorage);

function ReleaseNotesForUser({ owner }: { owner: string }) {
  const [seen, setSeen] = useState(() => acknowledgements.read(owner));
  const path = usePathname();
  const active = useAppForeground();
  const { loaded } = useAppDataFields(['loaded']);
  const badges = useBadges();
  const toast = useToast();
  const { c, r, s } = useTheme();
  const { height } = useWindowDimensions();
  const protectedWork = useSyncExternalStore(updateProtection.subscribe, updateProtection.blocked, () => false);
  const releases = unseenReleases(seen);
  const visible = !!owner && releases.length > 0 && loaded && active && updateSafeRoute(path) && !protectedWork && !badges.loading && !(badges.enabled && badges.unseen.length > 0);
  const close = () => {
    const latest = RELEASE_NOTES[0]?.id;
    if (!latest) return;
    const persisted = acknowledgements.acknowledge(owner, latest);
    setSeen(latest);
    if (!persisted) toast.error('Il riepilogo è stato chiuso, ma potrebbe ricomparire: non riesco a salvare la conferma su questo dispositivo.');
  };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
    <View style={{ flex: 1, justifyContent: 'center', padding: s.lg, backgroundColor: c.overlay }}>
      <View accessibilityViewIsModal style={{ height: Math.min(height * 0.85, 680), width: '100%', maxWidth: 640, alignSelf: 'center', borderRadius: r.lg, backgroundColor: c.surface, padding: s.lg, gap: s.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.sm }}>
          <T v="title" accessibilityRole="header" style={{ flex: 1 }}>Novità di Pulse</T>
          <IconButton icon="x" label="Chiudi" onPress={close} />
        </View>
        <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ gap: s.md, paddingBottom: s.md }} showsVerticalScrollIndicator>
          <T tone="muted">Ecco cosa è cambiato o è stato aggiunto. Questo riepilogo compare una sola volta per aggiornamento su questo dispositivo.</T>
          <ReleaseNotesContent releases={releases} />
          <T tone="muted">Puoi rileggere tutte le novità in I tuoi avvisi → Riepilogo degli aggiornamenti.</T>
        </ScrollView>
        <Button label="Ho letto, continua" onPress={close} />
      </View>
    </View>
  </Modal>;
}

export function ReleaseNotesNotice() {
  const { userId } = useAppDataFields(['userId']);
  return <ReleaseNotesForUser key={userId} owner={userId} />;
}
