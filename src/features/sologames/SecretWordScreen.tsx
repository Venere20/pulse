import React, { useState } from 'react';
import { View } from 'react-native';
import { FeatureFrame } from '../FeatureFrame';
import { Button, Card, Input, T } from '../../ui/primitives';
import { useTheme } from '../../theme/ThemeProvider';
import { useLocalGame } from './localState';
import { guessError, guessLimit, guessWord, hintLimit, newSecretWord, nextSecretWord, normaliseWord, revealLetter, secretTarget, validSecretWord, wordClues, wordResult } from './secretWord';
import { NewSoloGame, SoloDifficultyPicker, SoloSaveNote } from './SoloChrome';

export function SecretWordScreen() {
  const local = useLocalGame('secretword:v1', newSecretWord, validSecretWord);
  const { state: s, setState } = local; const { c } = useTheme();
  const [draft, setDraft] = useState(''); const [error, setError] = useState('');
  const target = secretTarget(s), result = wordResult(s), complete = result !== 'playing' && s.index === s.order.length - 1;
  const submit = () => { const message = guessError(s, draft); if (message) { setError(message); return; } setState(old => guessWord(old, draft)); setDraft(''); setError(''); };
  return <FeatureFrame title="Parola segreta">
    <T>Una campagna di 200 parole italiane, tutte diverse. Indovina ogni parola di cinque lettere. Le lettere ripetute vengono conteggiate una volta per ogni presenza nella soluzione.</T>
    <SoloDifficultyPicker value={s.difficulty} onChange={difficulty => { setState(newSecretWord(difficulty)); setDraft(''); setError(''); }} />
    <Card accent><T v="title">Parola {s.index + 1}/{s.order.length}</T><T>Indovinate: {s.solved} · Punti: {s.score} · Serie: {s.streak}</T><T>{guessLimit(s.difficulty)} tentativi per parola · {hintLimit(s.difficulty)} indizi disponibili</T></Card>
    <T>✓ Verde: posto giusto · ↔ Ocra: posto diverso · — Grigio: lettera assente</T>
    <View style={{ gap: 7 }}>{Array.from({ length: guessLimit(s.difficulty) }, (_, row) => {
      const word = s.guesses[row], clues = word ? wordClues(target, word) : null;
      return <View key={row} style={{ flexDirection: 'row', gap: 7 }}>{Array.from({ length: 5 }, (_, i) => {
        const clue = clues?.[i]; const colour = clue === 'correct' ? '#28674A' : clue === 'present' ? '#785D20' : clue === 'absent' ? '#49414D' : c.surfaceAlt;
        const label = clue === 'correct' ? 'posto giusto' : clue === 'present' ? 'posto diverso' : 'assente';
        return <View key={i} accessibilityLabel={word ? `${word[i]}, ${label}` : `Tentativo ${row + 1}, casella ${i + 1} vuota`} style={{ flex: 1, height: 50, borderRadius: 8, backgroundColor: colour, alignItems: 'center', justifyContent: 'center' }}><T bold style={{ fontSize: 22, color: word ? '#FFFFFF' : c.text }}>{word?.[i] ?? ''}</T></View>;
      })}</View>;
    })}</View>
    {s.hints.length > 0 && <T>Indizi: {[...target].map((letter, i) => s.hints.includes(i) ? letter : '＿').join(' ')}</T>}
    {result === 'playing' ? <><Input label="La tua parola" placeholder="Cinque lettere" value={draft} autoCapitalize="characters" autoCorrect={false} maxLength={5} onChangeText={value => { setDraft(normaliseWord(value)); setError(''); }} onSubmitEditing={submit} returnKeyType="done" /><Button label="Prova la parola" disabled={draft.length !== 5} onPress={submit} />{s.hints.length < hintLimit(s.difficulty) && <Button label="Rivela una lettera (riduce i punti)" variant="ghost" onPress={() => setState(revealLetter)} />}</>
      : <Card><T v="title" accessibilityLiveRegion="polite">{result === 'won' ? 'Parola indovinata!' : `La parola era ${target}.`}</T><T>{complete ? `Campagna completata: ${s.solved} parole indovinate su ${s.order.length}.` : 'Un’altra parola ti aspetta.'}</T>{!complete && <Button label="Prossima parola" onPress={() => { setState(nextSecretWord); setDraft(''); setError(''); }} />}</Card>}
    {error ? <T tone="danger" accessibilityLiveRegion="polite">{error}</T> : null}
    <NewSoloGame onNew={() => { setState(newSecretWord(s.difficulty)); setDraft(''); setError(''); }} /><SoloSaveNote error={local.storageError} />
  </FeatureFrame>;
}
