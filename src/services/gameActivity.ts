const sessions = new Map<object, string>();
export const SHARED_GAMES = ['tris', 'connect4', 'battleship', 'drawguess', 'wyr', 'daily', 'deeptalk'] as const;
export function sharedGame(value: unknown): value is typeof SHARED_GAMES[number] {
  return typeof value === 'string' && (SHARED_GAMES as readonly string[]).includes(value);
}
export function notificationGame(data: Record<string, unknown> | null | undefined): string | null {
  if (typeof data?.url !== 'string') return null;
  const match = data.url.replace(/^\/#\//, '/').match(/^\/play\/([a-z0-9]+)(?:[?#].*)?$/);
  return match && sharedGame(match[1]) ? match[1] : null;
}
export function enterGame(game: string) {
  const token = {}; sessions.set(token, game);
  return () => { sessions.delete(token); };
}
export function suppressGameNotice(data: Record<string, unknown> | null | undefined) {
  const game = notificationGame(data);
  return game !== null && [...sessions.values()].includes(game);
}
