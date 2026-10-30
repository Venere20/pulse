import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Card, T } from '../../ui/primitives';
import { Icon, IconName } from '../../ui/Icon';
import { Screen, Header, IconButton } from '../../ui/layout';
import { useTheme } from '../../theme/ThemeProvider';
import { MIN_TOUCH } from '../../theme/tokens';
import { NotificationDot, useCategoryNotifications } from '../inbox/CategoryNotifications';

type FeatureLink = [title: string, path: string, icon: IconName, hint: string];
const GROUPS: { title: string; links: FeatureLink[] }[] = [
  { title: 'Come stiamo', links: [
    ['Umore', '/umore', 'user', 'Come ti senti oggi?'],
    ['Vicinanza', '/vicinanza', 'heart', 'Un gesto per starti vicino'],
    ['Check-in', '/checkin', 'checkSquare', 'Avvisa quando arrivi'],
  ] },
  { title: 'Facciamo qualcosa', links: [
    ['Giochiamo', '/game', 'helpCircle', 'Piccoli giochi per voi'],
    ['Lavagna', '/canvas', 'edit', 'Disegniamo insieme'],
    ['Appuntamenti', '/appuntamenti', 'calendar', 'Anche da lontano'],
    ['Il nostro frigo', '/frigo', 'message', 'Pensieri e cose da fare'],
  ] },
  { title: 'I nostri momenti', links: [
    ['Promemoria', '/promemoria', 'checkSquare', 'Ricordati di chiedermi'],
    ['Ricorrenze', '/ricorrenze', 'star', 'Le date speciali'],
    ['Scegli per noi', '/scegli', 'compass', 'La prossima avventura'],
    ['Capsule', '/capsule', 'message', 'Un pensiero per dopo'],
  ] },
];
const MORE_LINKS: FeatureLink[] = [
  ['La nostra storia', '/storia', 'image', 'Un ricordo alla volta'],
  ['Il nostro mese', '/riepilogo', 'calendar', 'Riviviamo il mese'],
  ['Statistiche', '/statistiche', 'compass', 'La nostra storia in numeri'],
];

function FeatureGrid({ links }: { links: FeatureLink[] }) {
  const { c } = useTheme();
  const hasNews = useCategoryNotifications();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
    {links.map(([title, path, icon, hint]) => <TouchableOpacity
      key={path}
      accessibilityRole="button"
      accessibilityLabel={`${title}${hasNews(path) ? ', novità da leggere' : ''}`}
      onPress={() => router.push(path as Parameters<typeof router.push>[0])}
      style={{ flexBasis: '46%', flexGrow: 1, minWidth: 130 }}
    >
      <Card style={{ minHeight: 132, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Icon name={icon} size={30} color={c.primary} />
          <Icon name="chevronRight" size={18} color={c.textMuted} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><T bold style={{ flex: 1 }}>{title}</T><NotificationDot visible={hasNews(path)} /></View>
        <T v="caption" tone="muted">{hint}</T>
      </Card>
    </TouchableOpacity>)}
  </View>;
}

export function ForUsScreen() {
  const { c } = useTheme();
  const [moreExpanded, setMoreExpanded] = useState(false);
  return <Screen header={<Header title="Per noi" right={<IconButton icon="sliders" label="Impostazioni" onPress={() => router.push('/settings')} />} />}>
    <View style={{ gap: 8 }}>
      <T v="h1">Piccoli gesti, ogni giorno</T>
      <T tone="muted">Uno spazio tutto nostro, per coltivare ciò che ci fa stare bene.</T>
    </View>
    {GROUPS.map(group => <View key={group.title} style={{ gap: 12 }}>
      <T v="title">{group.title}</T>
      <FeatureGrid links={group.links} />
    </View>)}
    <View style={{ gap: 12 }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Storia e riepiloghi"
        accessibilityState={{ expanded: moreExpanded }}
        onPress={() => setMoreExpanded(value => !value)}
        style={{ minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <T v="title" style={{ flex: 1 }}>Storia e riepiloghi</T>
        <Icon name={moreExpanded ? 'chevronUp' : 'chevronDown'} size={20} color={c.textMuted} />
      </TouchableOpacity>
      {moreExpanded && <FeatureGrid links={MORE_LINKS} />}
    </View>
  </Screen>;
}
