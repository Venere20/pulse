import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity, Linking } from 'react-native';
import { VisitLegs, formatDuration } from '../utils/routing';
import { buildTravelLinks, adviseModes, MODE_LABEL, TravelLink, TravelMode } from '../utils/travelLinks';
import { Card, Chip, SectionTitle, T } from '../ui/primitives';
import { Icon, IconName } from '../ui/Icon';
import { useTheme } from '../theme/ThemeProvider';
import { useToast } from '../ui/Toast';

interface Props {
  myCity: string;
  partnerCity: string;
  meetingPoint: string;
  startDate: string;
  endDate: string;
  legs: VisitLegs | null;
}

const MODE_ICON: Record<TravelMode, IconName> = {
  train: 'train',
  flight: 'plane',
  sea: 'ship',
  bus: 'bus',
  transit: 'navigation',
  car: 'car',
};

const GROUPS: { title: string; modes: TravelMode[] }[] = [
  { title: 'Treni', modes: ['train'] },
  { title: 'Bus', modes: ['bus'] },
  { title: 'Traghetti e aliscafi', modes: ['sea'] },
];

/** Propone mezzi, tempi e link diretti (treno, volo, bus, traghetto, aliscafo) verso il punto d'incontro. */
export const TravelOptions: React.FC<Props> = ({ myCity, partnerCity, meetingPoint, startDate, endDate, legs }) => {
  const { c, r, s } = useTheme();
  const toast = useToast();
  const [who, setWho] = useState<'me' | 'partner'>('me');
  const [dir, setDir] = useState<'out' | 'back'>('out');

  const origin = who === 'me' ? myCity : partnerCity;
  const leg = who === 'me' ? legs?.mine : legs?.partner;
  const from = dir === 'out' ? origin : meetingPoint;
  const to = dir === 'out' ? meetingPoint : origin;
  const date = dir === 'out' ? startDate : endDate;

  const links = useMemo(() => (from && to ? buildTravelLinks(from, to, date) : []), [from, to, date]);
  const advice = useMemo(() => adviseModes(leg ? leg.km : null, leg ? leg.source === 'road' : true), [leg]);

  const open = (l: TravelLink) => {
    Linking.openURL(l.url).catch(() => toast.error('Impossibile aprire il link'));
  };

  const LinkRow: React.FC<{ l: TravelLink }> = ({ l }) => (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={`${l.label}${l.prefilled ? ', ricerca già compilata' : ''}`}
      onPress={() => open(l)}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: s.md, borderBottomWidth: 1, borderBottomColor: c.border }}
    >
      <Icon name={MODE_ICON[l.mode]} size={20} color={c.primary} />
      <View style={{ flex: 1 }}>
        <T>{l.label}</T>
        {l.prefilled ? <T tone="success">Ricerca già compilata</T> : null}
      </View>
      <Icon name="externalLink" size={18} color={c.textFaint} />
    </TouchableOpacity>
  );

  if (!meetingPoint || !origin) {
    return (
      <Card>
        <SectionTitle title="Come arrivare" />
        <T tone="muted">Imposta la città di entrambi e il punto d&apos;incontro per vedere le opzioni di viaggio.</T>
      </Card>
    );
  }

  const prefilled = links.filter((l) => l.prefilled);

  return (
    <View style={{ gap: s.lg }}>
      <Card>
        <SectionTitle title="Come arrivare" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
          <Chip label="Il mio viaggio" selected={who === 'me'} onPress={() => setWho('me')} />
          <Chip label="Viaggio del partner" selected={who === 'partner'} onPress={() => setWho('partner')} />
          <Chip label="Andata" selected={dir === 'out'} onPress={() => setDir('out')} />
          <Chip label="Ritorno" selected={dir === 'back'} onPress={() => setDir('back')} />
        </View>
        <T style={{ marginTop: s.md }} bold>
          {from} → {to}
        </T>
        <T tone="muted">
          {leg
            ? `${leg.km} km ${leg.source === 'road' ? `su strada, circa ${formatDuration(leg.minutes)}` : "in linea d'aria (nessun percorso su strada trovato)"}`
            : 'Distanza in calcolo...'}
        </T>
      </Card>

      <Card>
        <SectionTitle title="Mezzo consigliato" />
        {advice.map((a) => (
          <View key={a.mode} style={{ flexDirection: 'row', gap: s.md, paddingVertical: s.sm, alignItems: 'flex-start' }}>
            <View style={{ width: 40, height: 40, borderRadius: r.pill, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={MODE_ICON[a.mode]} size={20} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <T bold>{MODE_LABEL[a.mode]}</T>
              <T tone="muted">{a.reason}</T>
            </View>
          </View>
        ))}
        <T tone="faint" style={{ marginTop: s.sm }}>
          Indicazioni di massima basate sulla distanza: orari e prezzi aggiornati si vedono nei siti qui sotto.
        </T>
      </Card>

      <Card>
        <SectionTitle title="Cerca orari e prezzi" />
        {prefilled.map((l) => (
          <LinkRow key={l.id} l={l} />
        ))}
      </Card>

      {GROUPS.map((g) => (
        <Card key={g.title}>
          <SectionTitle title={g.title} />
          {links
            .filter((l) => !l.prefilled && g.modes.includes(l.mode))
            .map((l) => (
              <LinkRow key={l.id} l={l} />
            ))}
        </Card>
      ))}
    </View>
  );
};
