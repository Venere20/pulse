import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../state/Auth';
import { useScreenActive } from './useActivity';
import { signedImages } from '../services/signedImages';

export function useSignedImage(bucket: string, path: string | null) {
  const owner = useAuth().profile?.id ?? '';
  const active = useScreenActive();
  const key = JSON.stringify([owner, bucket, path]);
  const [snapshot, setSnapshot] = useState<{ key: string; url: string | null; error: boolean } | null>(null);
  const [retry, setRetry] = useState<{ key: string; count: number }>({ key, count: 0 });
  const count = retry.key === key ? retry.count : 0;
  useEffect(() => {
    if (!active || !owner || !path) return;
    let alive = true; let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const value = await signedImages.get(owner, bucket, path);
        if (!alive) return;
        setSnapshot({ key, url: value.url, error: false });
        timer = setTimeout(() => { void load(); }, Math.max(1000, value.expiresAt - Date.now() - 120000));
      } catch { if (alive) setSnapshot({ key, url: null, error: true }); }
    };
    void load();
    return () => { alive = false; clearTimeout(timer); };
  }, [active, owner, bucket, path, key, count]);
  const onError = useCallback(() => {
    if (!path) return;
    signedImages.invalidate(owner, bucket, path);
    setSnapshot({ key, url: null, error: true });
    // One fresh signature per displayed path; persistent failures show fallback.
    if (count === 0) setRetry({ key, count: 1 });
  }, [owner, bucket, path, key, count]);
  return { url: snapshot?.key === key ? snapshot.url : null, error: snapshot?.key === key && snapshot.error, onError };
}
