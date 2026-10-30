import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAppDataFields } from '../state/AppData';
import { registerForPushNotificationsAsync, registerWebPush } from '../services/notification';
import { notificationPath } from './notificationPath';
import { createNotificationResponseHandler } from './notificationResponse';
export { notificationPath } from './notificationPath';
export function NotificationBridge() {
    const { userId, refresh } = useAppDataFields(['refresh', 'userId']);
    const refreshRef = useRef(refresh);
    useEffect(() => { refreshRef.current = refresh; }, [refresh]);
    useEffect(() => {
        const register = () => { if (Platform.OS !== 'web')
            void registerForPushNotificationsAsync(userId);
        else if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
            void registerWebPush(userId); };
        register();
        const app = AppState.addEventListener('change', s => { if (s === 'active') {
            register();
            void refreshRef.current();
        } });
        const navigate = (raw: unknown) => { const path = notificationPath(raw); if (path)
            router.push(path as Parameters<typeof router.push>[0]); };
        if (Platform.OS === 'web') {
            if (window.location.hash)
                navigate(window.location.hash);
            const listener = (e: MessageEvent) => { if (e.data?.type === 'pulse-navigate')
                navigate(e.data.url); };
            navigator.serviceWorker?.addEventListener('message', listener);
            return () => { app.remove(); navigator.serviceWorker?.removeEventListener('message', listener); };
        }
        let alive = true, receivedLive = false;
        const handle = createNotificationResponseHandler(navigate, () => Notifications.clearLastNotificationResponseAsync());
        const listener = Notifications.addNotificationResponseReceivedListener(response => {
            if (!alive) return;
            receivedLive = true; handle(response);
        });
        void Notifications.getLastNotificationResponseAsync().then(response => {
            if (alive && !receivedLive && response) handle(response);
        }).catch(() => { /* An unavailable notification must not prevent opening Pulse. */ });
        return () => { alive = false; app.remove(); listener.remove(); };
    }, [userId]);
    return null;
}
