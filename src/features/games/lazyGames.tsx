import type React from 'react';
import type { PlayKey } from '../../types/games';
type Props = { onBack: () => void };
type Loader = () => Promise<{ default: React.ComponentType<Props> }>;
// Literal imports produce independent web chunks. Native evaluates the selected
// game on demand; production native still ships one Hermes bundle.
const loaders: Record<PlayKey, Loader> = {
  daily: () => import('../../screens/GameScreen').then(m => ({ default: m.GameScreen })),
  tris: () => import('../../screens/TrisScreen').then(m => ({ default: m.TrisScreen })),
  wyr: () => import('../../screens/WyrScreen').then(m => ({ default: m.WyrScreen })),
  deeptalk: () => import('../deeptalk/DeepTalkScreen').then(m => ({ default: m.DeepTalkScreen })),
  connect4: () => import('../partnergames/ConnectFourScreen').then(m => ({ default: m.ConnectFourScreen })),
  battleship: () => import('../partnergames/BattleshipScreen').then(m => ({ default: m.BattleshipScreen })),
  drawguess: () => import('../partnergames/DrawGuessScreen').then(m => ({ default: m.DrawGuessScreen })),
  hearts: () => import('../sologames/CatchHeartsScreen').then(m => ({ default: m.CatchHeartsScreen })),
  stars: () => import('../sologames/StarsScreen').then(m => ({ default: m.StarsScreen })),
  memory: () => import('../sologames/MemoryScreen').then(m => ({ default: m.MemoryScreen })),
  sequence: () => import('../sologames/SequenceScreen').then(m => ({ default: m.SequenceScreen })),
  secretword: () => import('../sologames/SecretWordScreen').then(m => ({ default: m.SecretWordScreen })),
  wordsearch: () => import('../sologames/WordSearchScreen').then(m => ({ default: m.WordSearchScreen })),
  clouds: () => import('../sologames/CloudsScreen').then(m => ({ default: m.CloudsScreen })),
  sliding: () => import('../sologames/SlidingPuzzleScreen').then(m => ({ default: m.SlidingPuzzleScreen })),
};
const ready = new Map<PlayKey, React.ComponentType<Props>>();
const pending = new Map<PlayKey, Promise<React.ComponentType<Props>>>();
export function playKey(value: unknown): PlayKey { return typeof value === 'string' && Object.hasOwn(loaders, value) ? value as PlayKey : 'daily'; }
export function loadedGame(key: PlayKey) { return ready.get(key); }
export function loadGame(key: PlayKey): Promise<React.ComponentType<Props>> {
  const existing = ready.get(key); if (existing) return Promise.resolve(existing);
  const request = pending.get(key); if (request) return request;
  const next = loaders[key]().then(module => { ready.set(key, module.default); pending.delete(key); return module.default; })
    .catch(error => { pending.delete(key); throw error; });
  pending.set(key, next); return next;
}
