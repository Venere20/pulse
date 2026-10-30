import React, { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useAppDataFields, isConcluded } from '../state/AppData';
import { MemoryCard } from '../components/MemoryCard';
import { Header } from '../ui/layout';
import { ListScreen } from '../ui/ListScreen';
import { Button, Card, EmptyState, T } from '../ui/primitives';
import { daysBetween } from '../utils/dates';
import { useTheme } from '../theme/ThemeProvider';
import { MemoriesFeatureLinks } from '../features/FeatureLinks';
import { computeStats } from '../utils/statistics';
import { useProgressiveItems } from '../hooks/useProgressiveItems';

interface Props {
  onOpenVisit: (id: string) => void;
}

const Stat: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const { c, r, s } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 130, backgroundColor: c.surfaceAlt, borderRadius: r.md, padding: s.md }}>
      <T v="h2" tone="primary">{value}</T>
      <T tone="muted">{label}</T>
    </View>
  );
};

export const MemoriesScreen: React.FC<Props> = React.memo(({ onOpenVisit }) => {
  const { s } = useTheme();
  const { width } = useWindowDimensions();
  const d = useAppDataFields(['bucket', 'expenses', 'loaded', 'today', 'visitBucket', 'visits']);
  const past = useMemo(
    () => d.visits.filter((v) => isConcluded(v, d.today)).sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [d.visits, d.today]
  );

  const stats = useMemo(() => {
    return computeStats(d.visits,d.expenses,d.today);
  }, [d.visits,d.expenses,d.today]);
  const page = useProgressiveItems(past);

  const wishesDone = (visitId: string) => {
    const ids = d.visitBucket.filter((l) => l.visit_id === visitId).map((l) => l.bucket_item_id);
    return d.bucket.filter((b) => ids.includes(b.id) && b.is_completed).map((b) => b.title);
  };

  return (
    <ListScreen
      label="Diario dei ricordi"
      header={<Header title="I nostri ricordi" subtitle="Il vostro diario di coppia" />}
      items={d.loaded ? page.visible : []}
      columns={Math.min(width, 720) - 2 * s.lg >= 280 + s.lg ? 2 : 1}
      keyExtractor={v => v.id}
      extraData={{ bucket: d.bucket, links: d.visitBucket }}
      renderItem={({ item: v }) => <View style={{ flex: 1 }}><MemoryCard visit={v} doneWishes={wishesDone(v.id)} onOpen={() => onOpenVisit(v.id)} /></View>}
      before={<><MemoriesFeatureLinks/>{d.loaded && past.length > 0 &&
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
            <Stat value={String(past.length)} label={past.length === 1 ? 'incontro' : 'incontri'} />
            <Stat value={String(stats.days)} label={stats.days === 1 ? 'giorno insieme' : 'giorni insieme'} />
            <Stat value={`${Math.round(stats.travelKm).toLocaleString('it-IT')}`} label="km andata e ritorno" />
            <Stat value={`€ ${Math.round(stats.spent).toLocaleString('it-IT')}`} label="spesi insieme" />
          </View>}
      </>}
      empty={!d.loaded ? <T tone="muted">Caricamento dei ricordi…</T> :
        <Card>
          <EmptyState icon="image" title="Il diario è ancora vuoto" hint="Dopo il primo incontro potrete aggiungere foto, un pensiero e i desideri realizzati." />
        </Card>
      }
      after={d.loaded && page.hasMore ? <View style={{ gap: s.sm }}>
            <T tone="muted">{page.count} di {page.total} ricordi</T>
            <Button label="Mostra altri ricordi" variant="secondary" onPress={page.showMore}/>
          </View> : null}
    />
  );
});

MemoriesScreen.displayName = 'MemoriesScreen';
