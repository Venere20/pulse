import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { FeatureFrame } from '../FeatureFrame';
import { Button, Card, T } from '../../ui/primitives';
import { useTheme } from '../../theme/ThemeProvider';
import { useLocalGame } from './localState';
import { neighbours, newSliding, nextSliding, PUZZLE_ROUNDS, puzzleSolved, resetSliding, slideTile, solvedBoard, undoSlide, validSliding } from './sliding';
import { NewSoloGame, SoloDifficultyPicker, SoloSaveNote } from './SoloChrome';
import { confirmAction } from '../../utils/confirm';

export function SlidingPuzzleScreen() {
  const local = useLocalGame('sliding:v1', newSliding, validSliding); const { state: s, setState } = local; const { c } = useTheme();
  const [preview, setPreview] = useState(false); const won = puzzleSolved(s.board), complete = won && s.level === PUZZLE_ROUNDS - 1;
  const available = neighbours(s.size, s.board.indexOf(0));
  const board = (values: number[], small = false) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%', maxWidth: small ? 220 : 500, alignSelf: 'center' }}>{values.map((value, i) => <TouchableOpacity key={i} accessibilityRole="button" accessibilityLabel={value ? `Tessera ${value}${available.includes(i) && !small ? ', spostabile' : ''}` : 'Spazio vuoto'} disabled={small || won || !available.includes(i)} accessibilityState={{ disabled: small || won || !available.includes(i) }} onPress={() => setState(old => slideTile(old, i))} style={{ width: `${100 / s.size}%`, aspectRatio: 1, padding: 3 }}><View style={{ flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: !value ? 'transparent' : value === i + 1 ? c.primarySoft : c.surfaceAlt, borderWidth: value ? 1 : 0, borderColor: !small && available.includes(i) ? c.primary : c.border }}><T bold style={{ fontSize: small ? 14 : s.size === 5 ? 22 : 28 }}>{value || ''}</T></View></TouchableOpacity>)}</View>;
  return <FeatureFrame title="Puzzle scorrevole">
    <T>Riordina le tessere dal numero 1, lasciando lo spazio vuoto in basso a destra. Tocca una tessera accanto al vuoto per spostarla. Hai {PUZZLE_ROUNDS} schemi diversi per difficoltà, tutti risolvibili.</T>
    <SoloDifficultyPicker value={s.size === 3 ? 'easy' : s.size === 4 ? 'normal' : 'hard'} onChange={difficulty => { setState(newSliding(difficulty === 'easy' ? 3 : difficulty === 'normal' ? 4 : 5)); setPreview(false); }} />
    <Card accent><T v="title">Puzzle {s.level + 1}/{PUZZLE_ROUNDS} · {s.size}×{s.size}</T><T>Mosse: {s.moves} · Mosse totali: {s.totalMoves} · Completati: {s.completed}</T></Card>
    {board(s.board)}
    {won ? <Card><T v="title" accessibilityLiveRegion="polite">{complete ? 'Tutti i 200 puzzle completati!' : 'Tessere al loro posto!'}</T>{!complete && <Button label="Prossimo puzzle" onPress={() => { setState(nextSliding); setPreview(false); }} />}</Card> : <>
      <Button label="Annulla ultima mossa" variant="secondary" disabled={!s.history.length} onPress={() => setState(undoSlide)} />
      <Button label="Ricomincia questo schema" variant="ghost" onPress={async () => { if (await confirmAction('Ricomincia lo schema', 'Le tessere torneranno alla disposizione iniziale di questo livello.', 'Ricomincia')) setState(resetSliding); }} />
    </>}
    <Button label={preview ? 'Nascondi disposizione finale' : 'Mostra disposizione finale'} variant="ghost" onPress={() => setPreview(!preview)} />
    {preview && board(solvedBoard(s.size), true)}
    <T tone="muted">Anche annullare una mossa conta come movimento. Puoi annullare gli ultimi 40 movimenti; il livello completato resta confermato.</T>
    <NewSoloGame onNew={() => { setState(newSliding(s.size)); setPreview(false); }} /><SoloSaveNote error={local.storageError} />
  </FeatureFrame>;
}
