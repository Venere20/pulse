export interface ConfirmationRequest { id: number; title: string; message: string; label: string; resolve: (accepted: boolean) => void }
let listener: ((request: ConfirmationRequest) => void) | null = null;
let sequence = 0;
const pending = new Map<number, ConfirmationRequest>();
export function registerConfirmationHandler(handler: (request: ConfirmationRequest) => void) {
  listener = handler;
  return () => { if (listener === handler) { listener = null; for (const request of pending.values()) request.resolve(false); pending.clear(); } };
}
export function requestConfirmation(title: string, message: string, label: string): Promise<boolean> {
  if (!listener) return Promise.resolve(false);
  return new Promise(resolve => {
    const id = ++sequence;
    const request = { id, title, message, label, resolve: (accepted: boolean) => { pending.delete(id); resolve(accepted); } };
    pending.set(id, request); listener?.(request);
  });
}
