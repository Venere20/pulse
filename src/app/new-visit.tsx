import React from 'react';
import { router } from 'expo-router';
import { NewVisitSheet } from '../components/NewVisitSheet';
import { Screen } from '../ui/layout';
export default function NewVisitRoute() { return <Screen><NewVisitSheet visible onClose={() => router.canGoBack() ? router.back() : router.replace('/meetings')} onCreated={id => router.replace(`/visit/${id}`)}/></Screen>; }
