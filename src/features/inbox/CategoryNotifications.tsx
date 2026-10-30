import React, { createContext, useContext, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { usePathname } from 'expo-router';
import { useAppDataFields } from '../../state/AppData';
import { useScreenActive } from '../../hooks/useActivity';
import { useTheme } from '../../theme/ThemeProvider';
import { featureRpc, useFeatureRows } from '../useFeatureRows';
import { notificationMatchesLink, notificationOpened } from './categories';

interface Notice { id: string; url: string; created_at: string; read_at: string | null }
const Context = createContext<(path: string) => boolean>(() => false);
export const useCategoryNotifications = () => useContext(Context);

export function CategoryNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAppDataFields(['userId']);
  const { rows: notices, hasSnapshot, error, updateRows } = useFeatureRows<Notice>('notification_inbox', { column: 'read_at', value: null });
  const path = usePathname();
  const active = useScreenActive();
  const pending = useRef(new Set<string>());
  useEffect(() => {
    if (!active || !hasSnapshot || error) return;
    const rows = notices.filter(row => !row.read_at && notificationOpened(row.url, path) && !pending.current.has(`${userId}:${row.id}`)).slice(0, 4);
    if (!rows.length) return;
    let alive = true;
    const owner = userId;
    const keys = pending.current;
    rows.forEach(row => keys.add(`${owner}:${row.id}`));
    void Promise.all(rows.map(async row => {
      try { await featureRpc('read_my_notifications', { p_id: row.id }, false); return row.id; }
      catch { return null; }
    })).then(ids => {
      if (alive) {
        const read = new Set(ids.filter(Boolean));
        if (read.size) updateRows(values => values.filter(row => !read.has(row.id)));
      }
    });
    // A failed read is retried on the next screen visit, never in a tight loop.
    return () => { alive = false; rows.forEach(row => keys.delete(`${owner}:${row.id}`)); };
  }, [active, path, userId, notices, hasSnapshot, error, updateRows]);
  return <Context.Provider value={link => notices.some(row => !row.read_at && notificationMatchesLink(row.url, link))}>{children}</Context.Provider>;
}

export function NotificationDot({ visible }: { visible: boolean }) {
  const { c } = useTheme();
  return visible ? <View accessibilityLabel="Novità da leggere" style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.primary, flexShrink: 0 }} /> : null;
}
