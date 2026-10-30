import React from 'react';
import { Card, T } from '../../ui/primitives';
import { PartnerMatch } from './usePartnerGame';
export function MatchStatus({ match, userId }: { match: PartnerMatch; userId: string }) {
  const message = match.status === 'cancelled' ? 'Partita annullata.' : match.status === 'draw' ? 'Partita conclusa senza vincitore.'
    : match.status === 'won' ? match.winner === userId ? 'Hai vinto! Rivincita?' : 'Ha vinto il partner. Rivincita?'
    : match.status === 'setup' ? 'Posizionate entrambi le vostre navi.'
    : match.game === 'drawguess' ? match.state.drawer === userId ? 'Disegni tu. Il partner indovina.' : 'Il partner disegna. Prova a indovinare!'
    : match.turn === userId ? 'Tocca a te!' : "In attesa della mossa del partner.";
  return <Card accent><T bold accessibilityLiveRegion="polite">{message}</T></Card>;
}
