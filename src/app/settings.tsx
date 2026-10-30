import React from 'react';
import { router } from 'expo-router';
import { SettingsScreen } from '../screens/SettingsScreen';
export default function Route() { return <SettingsScreen onBack={() => router.canGoBack() ? router.back() : router.replace('/')}/>; }
