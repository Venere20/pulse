import React from 'react';
import { router } from 'expo-router';
import { MeetingsScreen } from '../../screens/MeetingsScreen';
const openVisit = (id: string) => router.push(`/visit/${id}`);
const newVisit = () => router.push('/new-visit');
export default function Route() { return <MeetingsScreen onOpenVisit={openVisit} onNewVisit={newVisit}/>; }
