import React, { useState } from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Visit } from '../types/travel';
import { localDateStr } from '../utils/dates';
import { visitColors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { T } from '../ui/primitives';
import { IconButton } from '../ui/layout';

interface Props {
  visits: Visit[];
  /** Se presente, il calendario è in modalità selezione intervallo */
  range?: { start: string | null; end: string | null };
  onPickDay?: (day: string) => void;
  onVisitPress?: (visit: Visit) => void;
  allowPast?: boolean;
  maxDate?: string;
}

const WEEK = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

/** Calendario mensile: gli incontri sono barre colorate continue che attraversano i giorni. */
export const MonthCalendar: React.FC<Props> = ({ visits, range, onPickDay, onVisitPress, allowPast, maxDate }) => {
  const { c, r, s, f } = useTheme();
  const [cursor, setCursor] = useState(new Date());
  const today = localDateStr();

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(localDateStr(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const inRange = (day: string) => {
    if (!range?.start) return false;
    const end = range.end || range.start;
    return day >= range.start && day <= end;
  };

  return (
    <View style={{ gap: s.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="chevronLeft" label="Mese precedente" onPress={() => setCursor(new Date(year, month - 1, 1))} />
        <T v="title" style={{ textTransform: 'capitalize' }} accessibilityRole="header">
          {cursor.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
        </T>
        <IconButton icon="chevronRight" label="Mese successivo" onPress={() => setCursor(new Date(year, month + 1, 1))} />
      </View>

      <View style={{ flexDirection: 'row' }}>
        {WEEK.map((w, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <T tone="faint" bold>{w}</T>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row' }}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={{ flex: 1, height: 52 }} />;
            const past = day < today;
            const disabled = !!onPickDay && ((past && !allowPast) || !!maxDate && day > maxDate);
            const active = visits
              .map((v, idx) => ({ v, idx }))
              .filter(({ v }) => day >= v.start_date && day <= v.end_date)
              .slice(0, 2);
            const selected = inRange(day);
            const isToday = day === today;
            const content = (
              <View
                style={{
                  flex: 1,
                  height: 52,
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: 1,
                  borderRadius: r.md,
                  backgroundColor: selected ? c.primarySoft : 'transparent',
                  borderWidth: isToday ? 1 : 0,
                  borderColor: c.primary,
                  opacity: disabled ? 0.35 : 1,
                }}
              >
                <T style={{ fontSize: f.caption }} bold={selected || isToday} tone={selected ? 'primary' : 'default'}>{Number(day.slice(8))}</T>
                <View style={{ width: '100%', marginTop: 3, gap: 2 }}>
                  {active.map(({ v, idx }) => {
                    const isStart = day === v.start_date || di === 0;
                    const isEnd = day === v.end_date || di === 6;
                    return (
                      <View
                        key={v.id}
                        style={{
                          height: 5,
                          backgroundColor: visitColors[idx % visitColors.length],
                          borderTopLeftRadius: isStart ? 3 : 0,
                          borderBottomLeftRadius: isStart ? 3 : 0,
                          borderTopRightRadius: isEnd ? 3 : 0,
                          borderBottomRightRadius: isEnd ? 3 : 0,
                          marginLeft: isStart ? 4 : -2,
                          marginRight: isEnd ? 4 : -2,
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            );
            const label = `${Number(day.slice(8))} ${cursor.toLocaleDateString('it-IT', { month: 'long' })}${active.length ? `, incontro: ${active.map((a) => a.v.title).join(', ')}` : ''}`;
            const press = onPickDay ? () => onPickDay(day) : active.length && onVisitPress ? () => onVisitPress(active[0].v) : undefined;
            return (
              <TouchableOpacity
                key={di}
                style={{ flex: 1 }}
                disabled={disabled || !press}
                onPress={press}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                {...(Platform.OS === 'web' ? { 'aria-pressed': selected } : {})}
                activeOpacity={0.7}
              >
                {content}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};
