import React, { useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { FeatureFrame } from '../FeatureFrame';
import { Button, Card, T } from '../../ui/primitives';
import { useTheme } from '../../theme/ThemeProvider';
import { useLocalGame } from './localState';
import { findSearchWord, hintSearch, newWordSearch, nextWordSearch, searchPuzzle, SEARCH_ROUNDS, validWordSearch } from './wordSearch';
import { NewSoloGame, SoloDifficultyPicker, SoloSaveNote } from './SoloChrome';

export function WordSearchScreen() {
  const local = useLocalGame('wordsearch:v1', newWordSearch, validWordSearch); const { state: s, setState } = local; const { c } = useTheme();
  const [start, setStart] = useState<number | null>(null); const [message, setMessage] = useState('');
  const puzzle = useMemo(() => searchPuzzle({ seed: s.seed, difficulty: s.difficulty, level: s.level }), [s.seed, s.difficulty, s.level]);
  const foundCells = new Set(s.found.flatMap(word => word.cells));
  const hintedCells = new Set(puzzle.words.filter(word => s.hints.includes(word.text) && !s.found.some(found => found.text === word.text)).map(word => word.cells[0]));
  const finished = s.found.length === puzzle.words.length, complete = finished && s.level === SEARCH_ROUNDS - 1;
  const tap = (cell: number) => {
    if (start === null) { setStart(cell); setMessage('Ora tocca l’ultima lettera della parola.'); return; }
    if (start === cell) { setStart(null); setMessage('Selezione annullata.'); return; }
    const next = findSearchWord(s, start, cell);
    setMessage(next === s ? 'Nessuna nuova parola su questa linea. Riprova.' : 'Parola trovata!');
    setState(old => findSearchWord(old, start, cell)); setStart(null);
  };
  return <FeatureFrame title="Trova le parole">
    <T>Esplora {SEARCH_ROUNDS} griglie. Tocca la prima e poi l’ultima lettera di una parola: non serve selezionare ogni casella. In modalità normale trovi anche diagonali; in difficile anche parole al contrario.</T>
    <SoloDifficultyPicker value={s.difficulty} onChange={difficulty => { setState(newWordSearch(difficulty)); setStart(null); setMessage(''); }} />
    <Card accent><T v="title">Griglia {s.level + 1}/{SEARCH_ROUNDS}</T><T>{s.found.length}/{puzzle.words.length} parole · Punti: {s.score} · Indizi: {s.hints.length}/3</T></Card>
    <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap' }}>{puzzle.letters.map((letter, i) => <TouchableOpacity key={i} accessibilityRole="button" accessibilityLabel={`${letter}, riga ${Math.floor(i / puzzle.size) + 1}, colonna ${i % puzzle.size + 1}${foundCells.has(i) ? ', trovata' : hintedCells.has(i) ? ', inizio suggerito' : ''}`} accessibilityState={{ selected: start === i, disabled: finished }} disabled={finished} onPress={() => tap(i)} style={{ width: `${100 / puzzle.size}%`, aspectRatio: 1, minHeight: 28, padding: 1 }}><View style={{ flex: 1, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: start === i ? c.primary : foundCells.has(i) ? '#28674A' : hintedCells.has(i) ? '#785D20' : c.surfaceAlt }}><T bold style={{ fontSize: puzzle.size === 10 ? 15 : 18, color: start === i ? c.onPrimary : foundCells.has(i) || hintedCells.has(i) ? '#FFFFFF' : c.text }}>{letter}</T></View></TouchableOpacity>)}</View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{puzzle.words.map(word => { const found = s.found.some(item => item.text === word.text); return <T key={word.text} bold tone={found ? 'success' : 'default'} style={found ? { textDecorationLine: 'line-through' } : undefined}>{found ? '✓ ' : ''}{word.text}</T>; })}</View>
    {message ? <T accessibilityLiveRegion="polite">{message}</T> : null}
    {finished ? <Card><T v="title">{complete ? 'Hai completato tutte le 200 griglie!' : 'Hai trovato tutte le parole!'}</T>{!complete && <Button label="Prossima griglia" onPress={() => { setState(nextWordSearch); setStart(null); setMessage(''); }} />}</Card> : <><Button label="Suggerisci un inizio (−3 punti)" variant="secondary" disabled={s.hints.length >= 3} onPress={() => setState(hintSearch)} />{start !== null && <Button label="Annulla selezione" variant="ghost" onPress={() => { setStart(null); setMessage(''); }} />}</>}
    <NewSoloGame onNew={() => { setState(newWordSearch(s.difficulty)); setStart(null); setMessage(''); }} /><SoloSaveNote error={local.storageError} />
  </FeatureFrame>;
}
