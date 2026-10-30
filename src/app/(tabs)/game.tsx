import React from 'react';
import { router } from 'expo-router';
import { PlayKey } from '../../types/games';
import { GamesHubScreen } from '../../screens/GamesHubScreen';
const openGame = (game: PlayKey) => router.push(`/play/${game}`);
export default function Route() { return <GamesHubScreen onOpen={openGame}/>; }
