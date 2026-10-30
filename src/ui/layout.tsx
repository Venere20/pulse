import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
  StyleProp,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../theme/tokens';
import { Icon, IconName } from './Icon';
import { T } from './primitives';
import { useInsets, hasSafeArea } from './safeArea';
import { SaveFeedback } from '../features/saving/SaveFeedback';

const Wrapper: React.ComponentType<any> = hasSafeArea ? View : SafeAreaView;

/** Contenitore schermata: sfondo tema + margini di sicurezza + (opzionale) scroll. */
export const Screen: React.FC<{
  children: React.ReactNode;
  scroll?: boolean;
  header?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
  showSaveFeedback?: boolean;
}> = ({ children, scroll = true, header, contentStyle, scrollEnabled, showSaveFeedback = true }) => {
  const { c, s } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useInsets();
  // Su schermo largo (web/tablet) il contenuto resta centrato e leggibile
  const maxWidth = 720;
  const side = width > maxWidth ? (width - maxWidth) / 2 : 0;
  const inner = [{ padding: s.lg, paddingHorizontal: s.lg + side, paddingBottom: 120, gap: s.lg }, contentStyle];
  return (
    <Wrapper style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {header}
        {scroll ? (
          <ScrollView scrollEnabled={scrollEnabled} keyboardShouldPersistTaps="handled" contentContainerStyle={inner} showsVerticalScrollIndicator={false}>
            {showSaveFeedback && <SaveFeedback />}
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, inner]}>{showSaveFeedback && <SaveFeedback />}{children}</View>
        )}
      </View>
    </Wrapper>
  );
};

export const Header: React.FC<{
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}> = ({ title, subtitle, onBack, right }) => {
  const { c, s } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: s.lg,
        paddingVertical: s.sm,
        gap: s.sm,
        minHeight: 56,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        backgroundColor: c.bg,
      }}
    >
      {onBack ? <IconButton icon="chevronLeft" label="Indietro" onPress={onBack} /> : null}
      <View style={{ flex: 1 }}>
        <T v="h2" numberOfLines={1} accessibilityRole="header">{title}</T>
        {subtitle ? <T tone="muted" numberOfLines={1}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
};

export const IconButton: React.FC<{ icon: IconName; label: string; onPress: () => void; tone?: 'default' | 'primary' | 'danger'; filled?: boolean }> = ({
  icon,
  label,
  onPress,
  tone = 'default',
  filled,
}) => {
  const { c, r } = useTheme();
  const color = tone === 'primary' ? c.primary : tone === 'danger' ? c.danger : c.text;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        borderRadius: r.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? c.surfaceAlt : 'transparent',
      }}
    >
      <Icon name={icon} size={22} color={color} />
    </TouchableOpacity>
  );
};

/** Pannello a scorrimento dal basso (conferme, moduli, selezioni). */
export const BottomSheet: React.FC<{
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ visible, title, onClose, children, footer }) => {
  const { c, r, s } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={onClose} accessibilityLabel="Chiudi">
          <View style={{ flex: 1, backgroundColor: c.overlay }} />
        </TouchableWithoutFeedback>
        <View
          style={{
            backgroundColor: c.surface,
            borderTopLeftRadius: r.xl,
            borderTopRightRadius: r.xl,
            maxHeight: height * 0.92,
            width: '100%',
            maxWidth: 720,
            alignSelf: 'center',
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: s.sm }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.border }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.lg, paddingVertical: s.sm }}>
            <T v="title" style={{ flex: 1 }} accessibilityRole="header">{title}</T>
            <IconButton icon="x" label="Chiudi" onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: s.lg, paddingTop: 0, gap: s.md }}>
            {children}
          </ScrollView>
          {footer ? <View style={{ padding: s.lg, paddingTop: s.sm, gap: s.sm, borderTopWidth: 1, borderTopColor: c.border }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export interface TabDef<K extends string> {
  key: K;
  label: string;
  icon: IconName;
  badge?: boolean;
}

export function TabBar<K extends string>({ tabs, active, onChange }: { tabs: TabDef<K>[]; active: K; onChange: (k: K) => void }) {
  const { c, s, f } = useTheme();
  const insets = useInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.border,
        paddingTop: s.sm,
        paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 22 : s.md),
      }}
      accessibilityRole="tablist"
    >
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <TouchableOpacity
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            {...(Platform.OS === 'web' ? { 'aria-selected': on } : {})}
            accessibilityLabel={t.label}
            onPress={() => onChange(t.key)}
            activeOpacity={0.7}
            style={{ flex: 1, alignItems: 'center', minHeight: MIN_TOUCH, justifyContent: 'center', gap: 2 }}
          >
            <View>
              <Icon name={t.icon} size={24} color={on ? c.primary : c.textFaint} strokeWidth={on ? 2.4 : 2} />
              {t.badge ? (
                <View style={{ position: 'absolute', top: -2, right: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary, borderWidth: 2, borderColor: c.surface }} />
              ) : null}
            </View>
            <T style={{ fontSize: f.tab, fontWeight: on ? '700' : '500' }} tone={on ? 'primary' : 'faint'}>{t.label}</T>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Tab interne a una schermata (es. dettaglio incontro). */
export function SegmentedTabs<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: K; label: string }[];
  active: K;
  onChange: (k: K) => void;
}) {
  const { c, r, s, f } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s.xs,
        padding: s.xs,
        backgroundColor: c.surfaceAlt,
        borderRadius: r.md,
      }}
      style={{
        flexGrow: 0,
        maxWidth: '100%',
        borderRadius: r.md,
        backgroundColor: c.surfaceAlt,
      }}
      accessibilityRole="tablist"
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;

        return (
          <TouchableOpacity
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.8}
            style={{
              minHeight: MIN_TOUCH,
              minWidth: 76,
              paddingHorizontal: s.md,
              paddingVertical: s.sm,
              borderRadius: r.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected
                ? c.primarySoft
                : 'transparent',
            }}
          >
            <T
              v="caption"
              numberOfLines={1}
              style={{
                color: selected ? c.primary : c.textMuted,
                fontWeight: selected ? '700' : '500',
                fontSize: f.caption,
              }}
            >
              {tab.label}
            </T>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
