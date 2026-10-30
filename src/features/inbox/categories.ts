import { notificationPath } from '../../navigation/notificationPath';

export function notificationCategory(raw: unknown): string | null {
  const path = notificationPath(raw)?.split('?')[0];
  if (!path) return null;
  if (path === '/game' || path.startsWith('/play/')) return '/game';
  if (path.startsWith('/proposte/')) return '/proposte';
  if (path === '/meetings' || path === '/new-visit' || path.startsWith('/visit/')) return '/meetings';
  return path;
}

export function notificationMatchesLink(raw: unknown, link: string): boolean {
  const path = notificationPath(raw)?.split('?')[0];
  if (!path) return false;
  const category = notificationCategory(path);
  if (category === '/capsule' || category === '/canvas') return false;
  // Do not light up unrelated parent sections or derive news from unfinished tasks.
  return link === '/game' || link === '/proposte' || link === '/meetings' ? category === link : path === link;
}

/** Opening an overview must not dismiss the unread details it links to. */
export function notificationOpened(raw: unknown, currentPath: string): boolean {
  return notificationPath(raw)?.split('?')[0] === currentPath;
}
