import React from 'react';
import { router } from 'expo-router';
import { MemoriesScreen } from '../../screens/MemoriesScreen';
const openVisit = (id: string) => router.push(`/visit/${id}`);
export default function Route() { return <MemoriesScreen onOpenVisit={openVisit}/>; }
