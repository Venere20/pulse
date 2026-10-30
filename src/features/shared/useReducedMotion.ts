import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : true);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReduced(query.matches); query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduced(value); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { alive = false; sub.remove(); };
  }, []);
  return reduced;
}
