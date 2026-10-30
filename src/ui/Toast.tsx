import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';

type ToastKind = 'success' | 'error' | 'info';

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => {}, success: () => {}, error: () => {} });

export const useToast = () => useContext(ToastContext);

/** Notifiche a comparsa: sostituiscono alert() (che su web e Android è poco curato). */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { c, r, s, f } = useTheme();
  const [toast, setToast] = useState<{ id: number; message: string; kind: ToastKind } | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
  }, [opacity]);

  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ id: Date.now(), message, kind });
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(hide, kind === 'error' ? 4500 : 2800);
    },
    [hide, opacity]
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const api = useMemo<ToastApi>(() => ({
    show,
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
  }), [show]);

  const tone = toast?.kind === 'error' ? c.danger : toast?.kind === 'success' ? c.success : c.info;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            left: s.lg,
            right: s.lg,
            bottom: 96 + (Platform.OS === 'ios' ? 12 : 0),
            opacity,
            alignItems: 'center',
            zIndex: 10000,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: s.sm,
              backgroundColor: c.surfaceAlt,
              borderColor: tone,
              borderWidth: 1,
              borderRadius: r.lg,
              paddingVertical: s.md,
              paddingHorizontal: s.lg,
              maxWidth: 560,
            }}
          >
            <Icon name={toast.kind === 'error' ? 'x' : 'check'} size={18} color={tone} />
            <Text style={{ color: c.text, fontSize: f.caption + 1, flexShrink: 1 }}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
};
