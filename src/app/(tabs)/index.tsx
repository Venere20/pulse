import React from 'react';
import { router } from 'expo-router';
import { HomeScreen } from '../../screens/HomeScreen';
export default function Route() { return <HomeScreen onOpenVisit={id => router.push(`/visit/${id}`)} onNewVisit={() => router.push('/new-visit')} onOpenSettings={() => router.push('/settings')} onOpenGame={() => router.push('/play/daily')}/>; }
