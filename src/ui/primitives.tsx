import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  ActivityIndicator,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../theme/tokens';
import { Icon, IconName } from './Icon';

type TextVariant = 'display' | 'h1' | 'h2' | 'title' | 'body' | 'caption';
type TextTone = 'default' | 'muted' | 'faint' | 'primary' | 'success' | 'danger' | 'onPrimary';

interface TProps {
  v?: TextVariant;
  tone?: TextTone;
  bold?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  children?: React.ReactNode;
  accessibilityRole?: 'header' | 'text';
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
}

export const T: React.FC<TProps> = ({ v = 'body', tone = 'default', bold, style, numberOfLines, children, accessibilityRole, accessibilityLiveRegion }) => {
  const { c, f } = useTheme();
  const colors: Record<TextTone, string> = {
    default: c.text,
    muted: c.textMuted,
    faint: c.textFaint,
    primary: c.primary,
    success: c.success,
    danger: c.danger,
    onPrimary: c.onPrimary,
  };
  const sizes: Record<TextVariant, TextStyle> = {
    display: { fontSize: f.display, fontWeight: '800', letterSpacing: -1 },
    h1: { fontSize: f.h1, fontWeight: '800', letterSpacing: -0.5 },
    h2: { fontSize: f.h2, fontWeight: '700' },
    title: { fontSize: f.title, fontWeight: '700' },
    body: { fontSize: f.body, fontWeight: '400' },
    caption: { fontSize: f.caption, fontWeight: '400' },
  };
  return (
    <Text
      accessibilityRole={accessibilityRole}
      accessibilityLiveRegion={accessibilityLiveRegion}
      numberOfLines={numberOfLines}
      style={[{ color: colors[tone] }, sizes[v], bold && { fontWeight: '700' }, style]}
    >
      {children}
    </Text>
  );
};

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: boolean;
  padded?: boolean;
  outlined?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  accent = false,
  padded = true,
  outlined = true,
}) => {
  const { c, r, s } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: r.lg,
          borderWidth: accent || outlined ? 1 : 0,
          borderColor: accent ? c.primary : c.border,
          padding: padded ? s.lg : 0,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Button: React.FC<ButtonProps> = ({ label, onPress, variant = 'primary', icon, loading, disabled, small, style }) => {
  const { c, r, s, f } = useTheme();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary },
    secondary: { bg: c.surfaceAlt, fg: c.text, border: c.border },
    ghost: { bg: 'transparent', fg: c.primary, border: 'transparent' },
    danger: { bg: c.dangerSoft, fg: c.danger, border: c.danger },
  };
  const p = palette[variant];
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading) }}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        {
          minHeight: MIN_TOUCH,
          paddingVertical: s.sm,
          paddingHorizontal: small ? s.md : s.lg,
          borderRadius: r.md,
          backgroundColor: p.bg,
          borderWidth: 1,
          borderColor: p.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s.sm,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={p.fg} /> : null}
          <Text style={{ color: p.fg, fontSize: f.caption + (small ? 0 : 1), fontWeight: '700', flexShrink: 1, textAlign: 'center' }}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
}

export const Chip: React.FC<ChipProps> = ({ label, selected, onPress, icon, color }) => {
  const { c, r, s, f } = useTheme();
  const active = color || c.primary;
  const content = (
    <View
      style={{
        minHeight: MIN_TOUCH,
        minWidth: MIN_TOUCH,
        paddingVertical: s.sm,
        paddingHorizontal: s.md,
        borderRadius: r.pill,
        borderWidth: 1,
        borderColor: selected ? active : c.border,
        backgroundColor: selected ? c.primarySoft : c.surfaceAlt,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {icon ? <Icon name={icon} size={16} color={selected ? c.primary : c.textMuted} /> : null}
      <Text style={{ color: c.text, fontSize: f.caption, fontWeight: selected ? '700' : '500', flexShrink: 1 }}>{label}</Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      {...(Platform.OS === 'web' ? { 'aria-pressed': !!selected } : {})}
      accessibilityLabel={label}
      activeOpacity={0.8}
      onPress={onPress}
    >
      {content}
    </TouchableOpacity>
  );
};

interface InputProps extends TextInputProps {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, style, ...rest }) => {
  const { c, r, s, f } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text style={{ color: c.textMuted, fontSize: f.caption, fontWeight: '600' }}>{label}</Text>
      ) : null}
      <TextInput
        accessibilityLabel={label || rest.placeholder}
        placeholderTextColor={c.textFaint}
        style={[
          {
            minHeight: MIN_TOUCH,
            backgroundColor: c.surfaceAlt,
            color: c.text,
            borderRadius: r.md,
            borderWidth: 1,
            borderColor: c.border,
            paddingHorizontal: s.md,
            paddingVertical: s.sm + 2,
            fontSize: f.body,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
};

export const SectionTitle: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
    <T v="title" accessibilityRole="header">{title}</T>
    {right}
  </View>
);

export const EmptyState: React.FC<{ icon: IconName; title: string; hint?: string; action?: React.ReactNode }> = ({
  icon,
  title,
  hint,
  action,
}) => {
  const { c, s, r } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: s.xl, gap: s.sm }}>
      <View style={{ width: 64, height: 64, borderRadius: r.pill, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={30} color={c.primary} />
      </View>
      <T v="title" style={{ textAlign: 'center' }}>{title}</T>
      {hint ? <T tone="muted" style={{ textAlign: 'center' }}>{hint}</T> : null}
      {action}
    </View>
  );
};

export const Skeleton: React.FC<{ height?: number; style?: StyleProp<ViewStyle> }> = ({ height = 80, style }) => {
  const { c, r } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.4));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[{ height, borderRadius: r.lg, backgroundColor: c.surfaceAlt, opacity }, style]} />;
};

export const ProgressBar: React.FC<{ value: number; color?: string }> = ({ value, color }) => {
  const { c, r } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height: 8, borderRadius: r.pill, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color || c.primary }} />
    </View>
  );
};

export const Row: React.FC<{ children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }> = ({ children, gap = 8, style }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);
