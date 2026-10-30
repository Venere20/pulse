import { File, Paths } from 'expo-file-system';
import type { DraftStorage } from './core';
const file = (key: string) => new File(Paths.document, `pulse-draft-${encodeURIComponent(key)}.json`);
export const draftStorage: DraftStorage = {
  getItem(key) { const target = file(key); return target.exists ? target.textSync() : null; },
  setItem(key, value) { const target = file(key); if (!target.exists) target.create(); target.write(value); },
  removeItem(key) { const target = file(key); if (target.exists) target.delete(); },
};
