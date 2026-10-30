import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { MoodOption, PulseType } from '../types/pulse';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../theme/tokens';

export const MOODS: MoodOption[] = [
  { id: 'thinking', emoji: '❤️', label: 'Ti penso', color: '#FF4D85' },
  { id: 'coffee', emoji: '☕', label: 'Caffè?', color: '#F59E0B' },
  { id: 'miss_you', emoji: '🫂', label: 'Mi manchi', color: '#3B82F6' },
  { id: 'urgent', emoji: '⚡', label: 'Rispondimi', color: '#EF4444' },
];

interface Props {
  selectedMood: PulseType;
  onSelect: (mood: PulseType) => void;
}

export const MoodSelector: React.FC<Props> = ({ selectedMood, onSelect }) => {
  const { c, r, s, f } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: s.sm }}>
      {MOODS.map((mood) => {
        const on = selectedMood === mood.id;
        return (
          <TouchableOpacity
            key={mood.id}
            accessibilityRole="button"
            accessibilityLabel={mood.label}
            accessibilityState={{ selected: on }}
            {...(Platform.OS === 'web' ? { 'aria-pressed': on } : {})}
            activeOpacity={0.8}
            onPress={() => onSelect(mood.id)}
            style={{
              minHeight: MIN_TOUCH,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: s.md,
              borderRadius: r.pill,
              borderWidth: 1,
              borderColor: on ? mood.color : c.border,
              backgroundColor: on ? mood.color : c.surfaceAlt,
            }}
          >
            <Text style={{ fontSize: 18 }}>{mood.emoji}</Text>
            <Text style={{ color: on ? '#17151D' : c.text, fontSize: f.caption, fontWeight: on ? '700' : '500' }}>{mood.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
