import React, { useEffect, useState, useRef } from 'react';
import { TouchableOpacity, Text, Animated, ActivityIndicator, Platform, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon } from '../ui/Icon';
import { MoodOption } from '../types/pulse';
import { useReducedMotion } from '../features/shared/useReducedMotion';

interface Props {
  loading: boolean;
  selectedMood: MoodOption;
  onPress: () => void | Promise<void>;
  size?: number;
  celebration?: string;
}

export const PulseButton: React.FC<Props> = ({ loading, selectedMood, onPress, size = 168, celebration }) => {
  const [scale] = useState(() => new Animated.Value(1));
  const [sparks] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();
  const sending = useRef(false);
  useEffect(() => { sending.current = loading; }, [loading]);
  useEffect(() => () => { scale.stopAnimation(); sparks.stopAnimation(); }, [scale, sparks]);

  const handlePress = () => {
    if (loading || sending.current) return;
    sending.current = true;
    // Doppio battito cardiaco (solo su dispositivo)
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 150);
    }
    if (!reduced) Animated.sequence([
      Animated.timing(scale, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }),
    ]).start();
    if (celebration && !reduced) { sparks.setValue(0); Animated.timing(sparks, { toValue: 1, duration: 1100, useNativeDriver: true }).start(); }
    void Promise.resolve(onPress()).catch(() => {}).finally(() => { sending.current = false; });
  };

  return (
    <Animated.View style={{ transform: [{ scale }], alignSelf: 'center' }}>
      <View style={{ borderRadius: size, padding: 12, borderWidth: 1, borderColor: '#512538', backgroundColor: '#211520' }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Invia Pulse: ${selectedMood.label}`}
        accessibilityHint="Invia il pensiero selezionato e l’eventuale messaggio al partner"
        accessibilityState={{ disabled: loading }}
        activeOpacity={0.9}
        onPress={handlePress}
        disabled={loading}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#56263C',
          borderWidth: celebration ? 3 : 1,
          borderColor: celebration ? '#FFD166' : '#FF9DBD',
          shadowColor: '#E99BB0',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.45,
          shadowRadius: 22,
          elevation: 12,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#FFFFFF" />
        ) : (
          <>
            {selectedMood.id === 'thinking'
              ? <Icon name="heart" size={size * 0.3} color="#FFFFFF" />
              : <Text accessible={false} style={{ fontSize: size * 0.3 }}>{selectedMood.emoji}</Text>}
            <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>{selectedMood.label}</Text>
          </>
        )}
      </TouchableOpacity>
      </View>
      {!!celebration && !reduced && [0, 1, 2, 3, 4, 5].map(i => <Animated.Text key={i} pointerEvents="none" accessible={false} style={{ position: 'absolute', left: size / 2 - 12, top: size / 2 - 12, fontSize: 24, opacity: sparks.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }), transform: [{ translateX: sparks.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(i * Math.PI / 3) * size * 0.65] }) }, { translateY: sparks.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(i * Math.PI / 3) * size * 0.65] }) }] }}>{i % 2 ? '✨' : celebration}</Animated.Text>)}
    </Animated.View>
  );
};
