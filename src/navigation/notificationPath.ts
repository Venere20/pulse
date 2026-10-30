export function notificationPath(raw: unknown): string | null {
 if (typeof raw !== 'string') return null;
 let path = raw.replace(/^\/#/, '').replace(/^#/, ''); if (path === '/home') path = '/';
 return /^\/(?:$|meetings$|game$|memories$|bucket$|settings$|new-visit$|proposte(?:\/[a-f0-9-]+)?$|checkin$|frigo$|capsule$|statistiche$|badge$|canvas$|vicinanza$|promemoria$|appuntamenti$|riepilogo$|storia$|scegli$|ricorrenze$|umore$|per-noi$|avvisi$|ricerca$|play\/(?:daily|tris|wyr|deeptalk|connect4|battleship|drawguess|hearts|stars|memory|sequence|secretword|wordsearch|clouds|sliding)$|visit\/[a-f0-9-]+(?:\?tab=(?:expenses|packing|overview))?$)/i.test(path) ? path : null;
}
