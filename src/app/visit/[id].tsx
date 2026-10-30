import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { VisitDetailScreen } from '../../screens/VisitDetailScreen';
export default function VisitRoute() { const { id, tab } = useLocalSearchParams<{
    id: string;
    tab?: string;
}>(); return <VisitDetailScreen key={`${id}:${tab}`} visitId={id} initialTab={tab === 'packing' ? 'packing' : tab === 'expenses' ? 'expenses' : 'overview'} onBack={() => router.canGoBack() ? router.back() : router.replace('/meetings')}/>; }
