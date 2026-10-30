import { notificationPath } from './notificationPath';

interface Response {
  actionIdentifier: string;
  notification: { date: number; request: { identifier: string; content: { data?: Record<string, unknown> } } };
}

// The listener and the initial native lookup can report the same tap. Keep this
// receipt across bridge remounts; clear the native response for subsequent boots.
const handled = new Set<string>();
export function createNotificationResponseHandler(navigate: (path: string) => void, clear: () => Promise<void>) {
  return (response: Response) => {
    const request = response.notification.request;
    const path = notificationPath(request.content.data?.url);
    if (!path) return;
    const key = JSON.stringify([request.identifier, response.notification.date, response.actionIdentifier]);
    if (handled.has(key)) return;
    handled.add(key);
    if (handled.size > 64) handled.delete(handled.values().next().value!);
    navigate(path);
    void clear().catch(() => { /* The in-memory receipt still prevents resume/remount replay. */ });
  };
}
