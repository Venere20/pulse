export function throwIfAborted(signal?: AbortSignal | null) {
  if (signal?.aborted) { const error = new Error('Richiesta annullata'); error.name = 'AbortError'; throw error; }
}
export function abortableDelay(ms: number, signal?: AbortSignal | null): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const finish = () => { signal?.removeEventListener('abort', cancel); resolve(); };
    const timer = setTimeout(finish, ms);
    const cancel = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); const error = new Error('Richiesta annullata'); error.name = 'AbortError'; reject(error); };
    signal?.addEventListener('abort', cancel, { once: true });
  });
}
