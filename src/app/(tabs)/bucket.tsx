import React from 'react';
import { router } from 'expo-router';
import { BucketScreen } from '../../screens/BucketScreen';
const openVisit = (id: string) => router.push(`/visit/${id}`);
export default function Route() { return <BucketScreen onOpenVisit={openVisit}/>; }
