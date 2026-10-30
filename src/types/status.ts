export type UserStatus = 'home' | 'office' | 'study' | 'gym' | 'out' | 'traveling' | 'flying' | 'together' | 'sleep';

export const STATUS_OPTIONS: { id: UserStatus; emoji: string; label: string }[] = [
  { id: 'home', emoji: '🏠', label: 'A casa' },
  { id: 'office', emoji: '💼', label: 'Al lavoro' },
  { id: 'study', emoji: '📚', label: 'Studio' },
  { id: 'gym', emoji: '🏋️', label: 'In palestra' },
  { id: 'out', emoji: '🌳', label: 'Fuori' },
  { id: 'traveling', emoji: '🚆', label: 'In viaggio' },
  { id: 'flying', emoji: '✈️', label: 'In volo' },
  { id: 'together', emoji: '❤️', label: 'Insieme' },
  { id: 'sleep', emoji: '🌙', label: 'Dormo' },
];

export const isUserStatus = (v: unknown): v is UserStatus =>
  STATUS_OPTIONS.some((s) => s.id === v);
