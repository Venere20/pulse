import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { PulseLog, PulseType } from '../types/pulse';
import { MOODS } from './MoodSelector';
import { Card, T } from '../ui/primitives';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../theme/tokens';

interface Props {
  lastPulse: PulseLog | null;
  countToday: number;
  replied: boolean;
  onReply: (type: PulseType, replyTo: string) => void;
  replying?: boolean;
}

const timeAgo = (iso: string) => {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'adesso';
  if (min < 60) return `${min} min fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h fa`;
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
};

export const LastPulseCard: React.FC<Props> = ({ lastPulse, countToday, replied, onReply, replying }) => {
  const { c, r, s, f } = useTheme();
  const mood = lastPulse ? MOODS.find((m) => m.id === lastPulse.type) || MOODS[0] : null;

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s.sm }}>
        <T v="title">Dal tuo partner</T>
        <T tone="muted">Oggi: <T tone="primary" bold>{countToday}</T></T>
      </View>

      {lastPulse && mood ? (
        <View style={{ gap: s.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.md }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: mood.color + '33', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 26 }}>{mood.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <T bold>{mood.label}</T>
              <T tone="muted">{timeAgo(lastPulse.created_at)}</T>
            </View>
          </View>

          {lastPulse.message ? (
            <View style={{ backgroundColor: c.surfaceAlt, borderRadius: r.md, padding: s.md }}>
              <T>“{lastPulse.message}”</T>
            </View>
          ) : null}

          {replied ? (
            <T tone="success" bold>✓ Hai già risposto</T>
          ) : (
            <View style={{ gap: s.sm }}>
              <T tone="muted">Rispondi con un Pulse:</T>
              <View style={{ flexDirection: 'row', gap: s.sm }}>
                {MOODS.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Rispondi: ${m.label}`}
                    disabled={replying}
                    onPress={() => onReply(m.id, lastPulse.id)}
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      minHeight: MIN_TOUCH,
                      borderRadius: r.md,
                      borderWidth: 1,
                      borderColor: m.color,
                      backgroundColor: m.color + '22',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: replying ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      ) : (
        <T tone="muted">Nessun Pulse ricevuto per ora.</T>
      )}
    </Card>
  );
};
