import React from 'react';
import { Slot, router, usePathname } from 'expo-router';
import { Platform, View } from 'react-native';
import { TabBar, TabDef } from '../../ui/layout';
import { useCategoryNotifications } from '../../features/inbox/CategoryNotifications';
type Tab = 'home' | 'meetings' | 'game' | 'memories' | 'bucket' | 'pernoi';
const paths = { home: '/', meetings: '/meetings', game: '/game', memories: '/memories', bucket: '/bucket', pernoi: '/per-noi' } as const;
export default function TabsLayout() {
    const path = usePathname();
    const hasNews = useCategoryNotifications();
    const active = path === '/game' ? 'pernoi' : (Object.keys(paths) as Tab[]).find(k => paths[k] === path) ?? 'home';
    const tabs: TabDef<Tab>[] = [{ key: 'home', label: 'Insieme', icon: 'home' }, { key: 'meetings', label: 'Incontri', icon: 'calendar' },
        { key: 'pernoi', label: 'Per noi', icon: 'heart' },
        { key: 'memories', label: 'Ricordi', icon: 'image' }, { key: 'bucket', label: 'Desideri', icon: 'star' }];
    const changeTab = (key: Tab) => {
        if (paths[key] === path) return;
        // Keep the previous page in browser history for Safari's Back/swipe.
        // Replacing it can take the PWA outside Pulse on the next Back action.
        if (Platform.OS === 'web') router.push(paths[key]);
        else router.replace(paths[key]);
    };
    return <View style={{ flex: 1 }}><Slot /><TabBar tabs={tabs.map(tab => ({ ...tab, badge: hasNews(paths[tab.key]) }))} active={active} onChange={changeTab}/></View>;
}
