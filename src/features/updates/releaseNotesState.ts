import type { DraftStorage } from '../../services/drafts/core';

/** This acknowledgement has no draft expiry and contains no private content. */
export function createReleaseNotesState(storage: DraftStorage) {
  const memory = new Map<string, string>();
  const key = (owner: string) => `release-notes:${encodeURIComponent(owner)}`;
  return {
    read(owner: string): string | null {
      if (!owner) return null;
      if (memory.has(owner)) return memory.get(owner)!;
      try { return storage.getItem(key(owner)); } catch { return null; }
    },
    acknowledge(owner: string, releaseId: string): boolean {
      if (!owner || !releaseId) return false;
      memory.set(owner, releaseId);
      try { storage.setItem(key(owner), releaseId); return true; } catch { return false; }
    },
  };
}
