import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ProposalsScreen } from '../../features/proposals/ProposalsScreen';
export default function Route() { const p = useLocalSearchParams<{ title?: string; wish?: string }>(); return <ProposalsScreen key={p.wish ?? 'all'} initialTitle={typeof p.title === 'string' ? p.title : ''} wish={typeof p.wish === 'string' && /^[a-f0-9-]{36}$/i.test(p.wish) ? p.wish : undefined} />; }
