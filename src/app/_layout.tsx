import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaRoot } from '../ui/safeArea';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ToastProvider } from '../ui/Toast';
import { AuthProvider } from '../state/Auth';
import { AuthGate } from '../screens/AuthScreens';
import { AppDataProvider } from '../state/AppData';
import { GamesProvider } from '../state/Games';
import { NotificationBridge } from '../navigation/NotificationBridge';
import { BadgesProvider } from '../features/badges/Badges';
import { CheckinReminderSync } from '../features/checkin/CheckinScreen';
import { DataLoadBanner } from '../features/DataLoadBanner';
import { ConfirmationHost } from '../ui/ConfirmationHost';
import { DraftLifecycle } from '../features/drafts/DraftLifecycle';
import { SaveOwnerSync } from '../features/saving/SaveFeedback';
import { ScreenActivity } from '../hooks/useActivity';
import { AppUpdateNotice } from '../features/updates/AppUpdateNotice';
import { CategoryNotificationsProvider } from '../features/inbox/CategoryNotifications';
import { ReleaseNotesNotice } from '../features/updates/ReleaseNotesNotice';
const screenLayout = ({ children }: { children: React.ReactNode }) => <ScreenActivity>{children}</ScreenActivity>;
export default function RootLayout() {
    return <SafeAreaRoot><ThemeProvider><ToastProvider><AuthProvider><AuthGate><AppDataProvider>
 <SaveOwnerSync /><DraftLifecycle /><NotificationBridge /><CheckinReminderSync />
 <GamesProvider><BadgesProvider><CategoryNotificationsProvider><DataLoadBanner /><ConfirmationHost /><Stack screenLayout={screenLayout} screenOptions={{ headerShown: false }}/><AppUpdateNotice /><ReleaseNotesNotice /></CategoryNotificationsProvider></BadgesProvider></GamesProvider>
 </AppDataProvider></AuthGate></AuthProvider></ToastProvider></ThemeProvider></SafeAreaRoot>;
}
