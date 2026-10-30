import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Checkin } from './CheckinScreen';
import { reminderSession, reminderSessionCurrent } from '../../services/localReminderSession';
export async function syncCheckinReminder(c: Checkin | null) {
    if (Platform.OS === 'web')
        return;
    const ticket = reminderSession();
    if (!reminderSessionCurrent(ticket)) return;
    try {
        await Notifications.cancelScheduledNotificationAsync('pulse-checkin-local');
        // V2 uses the server queue on every platform, avoiding local + push duplicates.
        if (!reminderSessionCurrent(ticket) || !c || c.flow_version === 2 || Date.parse(c.due_at) <= Date.now())
            return;
        if (!(await Notifications.getPermissionsAsync()).granted)
            return;
        if (!reminderSessionCurrent(ticket)) return;
        await Notifications.scheduleNotificationAsync({ identifier: 'pulse-checkin-local', content: { title: '🛡️ Sei arrivato/a?', body: 'Conferma l’arrivo per avvisare il partner.', data: { url: '/checkin' }, sound: 'default' }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(c.due_at), channelId: 'checkin_alerts' } });
        if (!reminderSessionCurrent(ticket)) await Notifications.cancelScheduledNotificationAsync('pulse-checkin-local');
    }
    catch (e) {
        console.warn('Promemoria locale check-in non disponibile', e);
    }
}
