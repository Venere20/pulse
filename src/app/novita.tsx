import React from 'react';
import { router } from 'expo-router';
import { Screen, Header } from '../ui/layout';
import { ReleaseNotesContent } from '../features/updates/ReleaseNotesContent';
import { RELEASE_NOTES } from '../features/updates/releaseNotes';

export default function ReleaseHistoryScreen() {
  return <Screen header={<Header title="Novità di Pulse" onBack={() => router.canGoBack() ? router.back() : router.replace('/avvisi')} />}>
    <ReleaseNotesContent releases={RELEASE_NOTES} />
  </Screen>;
}
