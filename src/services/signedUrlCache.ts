export interface SignedImage { url: string; expiresAt: number }
type Signer = (bucket: string, path: string, seconds: number) => Promise<SignedImage | string>;
export function createSignedUrlCache(sign: Signer, now = Date.now, maxEntries = 200) {
  let generation = 0;
  const slots = new Map<string, { value?: SignedImage; pending?: Promise<SignedImage> }>();
  const keyFor = (owner: string, bucket: string, path: string) => JSON.stringify([owner, bucket, path]);
  return {
    async get(owner: string, bucket: string, path: string): Promise<SignedImage> {
      if (!owner || !path) throw new Error('Foto non disponibile');
      const key = keyFor(owner, bucket, path); const existing = slots.get(key);
      if (existing?.value && existing.value.expiresAt - 120000 > now()) return existing.value;
      if (existing?.pending) return existing.pending;
      const epoch = generation; const started = now(); const slot: { value?: SignedImage; pending?: Promise<SignedImage> } = {};
      slots.delete(key); slots.set(key, slot);
      while (slots.size > maxEntries) slots.delete(slots.keys().next().value!);
      slot.pending = sign(bucket, path, 3600).then(result => {
        if (epoch !== generation || slots.get(key) !== slot) throw new Error('Richiesta foto superata');
        const value = typeof result === 'string' ? { url: result, expiresAt: started + 3600000 } : result;
        if (!value.url || value.expiresAt <= now()) throw new Error('Foto non disponibile');
        slot.value = value; slot.pending = undefined; return value;
      }).catch(error => { if (slots.get(key) === slot) slots.delete(key); throw error; });
      return slot.pending;
    },
    invalidate(owner: string, bucket: string, path: string) { slots.delete(keyFor(owner, bucket, path)); },
    clear() { generation++; slots.clear(); },
  };
}
