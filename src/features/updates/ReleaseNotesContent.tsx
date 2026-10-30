import React from 'react';
import { View } from 'react-native';
import { T } from '../../ui/primitives';
import { formatDateIt } from '../../utils/dates';
import type { ReleaseNote } from './releaseNotes';

export function ReleaseNotesContent({ releases }: { releases: readonly ReleaseNote[] }) {
  return <View style={{ gap: 20 }}>{releases.map(release => <View key={release.id} style={{ gap: 12 }}>
    <T v="title" accessibilityRole="header">{release.title}</T>
    <T v="caption" tone="muted">{formatDateIt(release.date)}</T>
    {release.changes.map(change => <T key={change}>• {change}</T>)}
  </View>)}</View>;
}
