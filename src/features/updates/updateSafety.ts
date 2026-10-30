import type { SavePhase } from '../../services/saveState';

// These overview routes have no transient editor/game state to discard.
const OVERVIEWS = new Set(['/', '/meetings', '/memories', '/per-noi', '/game', '/avvisi', '/statistiche', '/badge']);
export function updateSafeRoute(path: string) { return OVERVIEWS.has(path.replace(/\/+$/, '') || '/'); }
export function updateCanRestart(path: string, save: SavePhase, draft: string) {
  return updateSafeRoute(path) && !['saving', 'failed', 'uncertain'].includes(save) && draft !== 'error' && draft !== 'saving';
}
