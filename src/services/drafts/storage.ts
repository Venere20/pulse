import type { DraftStorage } from './core';
export const draftStorage: DraftStorage = {
  getItem: key => window.localStorage.getItem(`pulse-draft:${key}`),
  setItem: (key, value) => window.localStorage.setItem(`pulse-draft:${key}`, value),
  removeItem: key => window.localStorage.removeItem(`pulse-draft:${key}`),
};
