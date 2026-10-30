import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ProposalsScreen } from '../../features/proposals/ProposalsScreen';
export default function Route() { const { id } = useLocalSearchParams<{
    id: string;
}>(); return <ProposalsScreen id={id}/>; }
