import { VisitCoverCredit } from '../components/VisitCoverCredit';
import { VisitAdultBadge } from '../components/VisitAdultBadge';

import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  View,
} from 'react-native';

import { ProposalLink } from '../features/FeatureLinks';
import { useAppDataFields, isConcluded } from '../state/AppData';
import { Visit } from '../types/travel';

import { MonthCalendar } from '../components/MonthCalendar';
import { VisitCard } from '../components/VisitCard';
import { VisitCover } from '../components/VisitCover';

import { daysBetween, formatDateIt } from '../utils/dates';

import {
  Header,
  IconButton,
} from '../ui/layout';

import {
  Button,
  Card,
  EmptyState,
  Skeleton,
  T,
} from '../ui/primitives';

import { Icon } from '../ui/Icon';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../theme/tokens';
import { useProgressiveItems } from '../hooks/useProgressiveItems';
import { ListScreen } from '../ui/ListScreen';
import { togetherState } from '../utils/together';

interface Props {
  onOpenVisit: (id: string) => void;
  onNewVisit: () => void;
}

const visitBadge = (
  visit: Visit,
  today: string,
): string => {
  if (togetherState([visit], null, Date.now()).visit) {
    return 'SIETE INSIEME';
  }

  if (visit.timing_mode === 'manual') return 'IN ATTESA DEL VOSTRO ARRIVO';
  const days = daysBetween(today, visit.start_date);

  if (days <= 0) return "VI VEDETE OGGI";
  if (days === 1) return "VI VEDETE DOMANI";

  return `VI VEDETE TRA ${days} GIORNI`;
};

export const MeetingsScreen: React.FC<Props> = React.memo(({
  onOpenVisit,
  onNewVisit,
}) => {
  const { c, r, s } = useTheme();
  const d = useAppDataFields(['loaded', 'today', 'totalTravelKm', 'visitBucket', 'visits']);

  // Non modifichiamo d.visits: ordiniamo una copia.
  const upcoming = useMemo(
    () =>
      d.visits
        .filter((visit) => !isConcluded(visit, d.today))
        .slice()
        .sort((a, b) =>
          a.start_date.localeCompare(b.start_date),
        ),
    [d.visits, d.today],
  );

  const nextVisit = upcoming[0] ?? null;
  const otherVisits = upcoming.slice(1);
  const page = useProgressiveItems(otherVisits);

  const wishCount = (id: string) =>
    d.visitBucket.filter(
      (link) => link.visit_id === id,
    ).length;

  return (
    <ListScreen label="Elenco degli altri incontri"
      header={<Header
          title="Incontri"
          subtitle="Ogni giorno un po' più vicini."
          right={
            <IconButton
              icon="plus"
              label="Nuovo incontro"
              tone="primary"
              filled
              onPress={onNewVisit}
            />
          }
        />}
      items={d.loaded ? page.visible : []} keyExtractor={visit => visit.id}
      renderItem={({ item: visit }) => (<VisitCard
                  key={visit.id}
                  visit={visit}
                  today={d.today}
                  colorIndex={d.visits.findIndex(
                    (item) =>
                      item.id === visit.id,
                  )}
                  wishCount={wishCount(
                    visit.id,
                  )}
                  onPress={() =>
                    onOpenVisit(visit.id)
                  }
                />)}
      before={<View style={{ gap: s.lg }}>{!d.loaded ? (<View style={{ gap: s.lg }}>
          <Skeleton height={300} />
          <Skeleton height={74} />
          <Skeleton height={260} />
        </View>) : <>{/* PROSSIMO INCONTRO IN EVIDENZA */}
          {nextVisit ? (
            <View style={{ gap: s.md }}>
              <T
                v="title"
                accessibilityRole="header"
              >
                Il prossimo incontro
              </T>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={
                  `Apri incontro ${nextVisit.title}. ` +
                  visitBadge(nextVisit, d.today)
                }
                activeOpacity={0.85}
                onPress={() =>
                  onOpenVisit(nextVisit.id)
                }
              >
                <Card
                  padded={false}
                  outlined={false}
                >
                  {/* Usa la copertina esistente.
                      La ricerca automatica arriverà
                      in una fase successiva. */}
                  <VisitCover
                    visit={nextVisit}
                    height={158}
                    resizeMode="cover"
                  />

                  <View
                    style={{
                      padding: s.lg,
                      gap: s.md,
                    }}
                  >
                    <VisitCoverCredit visit={nextVisit} />
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent:
                          'space-between',
                        flexWrap: 'wrap',
                        gap: s.sm,
                      }}
                    >
                      <View
                        style={{
                          paddingHorizontal: s.md,
                          paddingVertical: s.sm,
                          borderRadius: r.pill,
                          backgroundColor:
                            c.primarySoft,
                        }}
                      >
                        <T
                          tone="primary"
                          v="caption"
                          bold
                        >
                          {visitBadge(
                            nextVisit,
                            d.today,
                          )}
                        </T>
                      </View>

                      <Icon
                        name="calendar"
                        size={19}
                        color={c.textMuted}
                      />
                    </View>

                    <View style={{ gap: 5 }}>
                      <VisitAdultBadge visible={nextVisit.is_adult} />
                      <T
                        v="h2"
                        numberOfLines={2}
                      >
                        {nextVisit.title}
                      </T>

                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: s.sm,
                        }}
                      >
                        <Icon
                          name="calendar"
                          size={16}
                          color={c.textMuted}
                        />

                        <T
                          tone="muted"
                          v="caption"
                          style={{ flex: 1 }}
                        >
                          {formatDateIt(
                            nextVisit.start_date,
                          )}
                          {nextVisit.end_date !==
                          nextVisit.start_date
                            ? ` – ${formatDateIt(
                                nextVisit.end_date,
                              )}`
                            : ''}
                        </T>
                      </View>

                      {!!nextVisit.location && (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: s.sm,
                          }}
                        >
                          <Icon
                            name="mapPin"
                            size={16}
                            color={c.textMuted}
                          />

                          <T
                            tone="muted"
                            v="caption"
                            numberOfLines={2}
                            style={{ flex: 1 }}
                          >
                            {nextVisit.location}
                          </T>
                        </View>
                      )}

                      {wishCount(
                        nextVisit.id,
                      ) > 0 && (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: s.sm,
                          }}
                        >
                          <Icon
                            name="star"
                            size={16}
                            color={c.primary}
                          />

                          <T
                            tone="muted"
                            v="caption"
                          >
                            {wishCount(
                              nextVisit.id,
                            )}{' '}
                            {wishCount(
                              nextVisit.id,
                            ) === 1
                              ? 'desiderio collegato'
                              : 'desideri collegati'}
                          </T>
                        </View>
                      )}
                    </View>

                    <View
                      style={{
                        minHeight: MIN_TOUCH,
                        borderRadius: r.md,
                        backgroundColor: c.primary,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: s.sm,
                        paddingHorizontal: s.md,
                      }}
                    >
                      <T
                        tone="onPrimary"
                        bold
                      >
                        Apri incontro
                      </T>

                      <Icon
                        name="chevronRight"
                        size={19}
                        color={c.onPrimary}
                      />
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            </View>
          ) : (
            /* STATO VUOTO APPROVATO */
            <Card outlined={false}>
              <EmptyState
                icon="calendar"
                title="Quando ci rivediamo?"
                hint={
                  'Non avete ancora incontri ' +
                  'in programma. Scegliete ' +
                  'il prossimo momento da ' +
                  'vivere insieme.'
                }
                action={
                  <Button
                    label="Pianifica un incontro"
                    icon="plus"
                    onPress={onNewVisit}
                  />
                }
              />
            </Card>
          )}

          {/* PROPOSTE DATE SEMPRE DISPONIBILI */}
          <View style={{ gap: s.sm }}>
            <T
              v="title"
              accessibilityRole="header"
            >
              Scegliamo quando vederci
            </T>

            <ProposalLink />
          </View>

          {/* CALENDARIO SECONDARIO */}
          <View style={{ gap: s.md }}>
            <T
              v="title"
              accessibilityRole="header"
            >
              Il nostro calendario
            </T>

            <Card outlined={false}>
              <MonthCalendar
                visits={d.visits}
                onVisitPress={(visit) =>
                  onOpenVisit(visit.id)
                }
              />
            </Card>
          </View>{otherVisits.length > 0 && <T v="title" accessibilityRole="header">Altri incontri</T>}</>}</View>}
      after={d.loaded ? <View style={{ gap: s.md }}>{page.hasMore && <><T tone="muted">{page.count} di {page.total} altri incontri</T><Button label="Mostra altri incontri" variant="secondary" onPress={page.showMore} /></>}{/* CHILOMETRI: INFORMAZIONE SECONDARIA */}
          {d.totalTravelKm > 0 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: s.md,
                paddingHorizontal: s.sm,
                paddingVertical: s.sm,
              }}
            >
              <Icon
                name="navigation"
                size={20}
                color={c.primary}
              />

              <T
                tone="muted"
                v="caption"
                style={{ flex: 1 }}
              >
                Avete percorso{' '}
                <T
                  bold
                  tone="primary"
                >
                  {Math.round(
                    d.totalTravelKm,
                  ).toLocaleString('it-IT')}{' '}
                  km
                </T>{' '}
                per vedervi.
              </T>
            </View>
          )}</View> : null}
    />
  );
});

MeetingsScreen.displayName = 'MeetingsScreen';
