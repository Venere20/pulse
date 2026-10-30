import { useLayoutEffect, useRef } from 'react';
import { router, useNavigationContainerRef, usePathname, type Href } from 'expo-router';

/** Recover a browser Back/Forward that races the router's initial URL sync.
 * Normal history changes remain entirely under Expo Router's control.
 */
export function WebHistoryRecovery() {
  const navigation = useNavigationContainerRef();
  const pathname = usePathname();
  const currentPath = useRef(pathname);
  useLayoutEffect(() => { currentPath.current = pathname; }, [pathname]);
  useLayoutEffect(() => {
    let target: string | null = null;
    let first = 0, second = 0;
    const cancel = () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
    const reconcile = () => {
      cancel();
      first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => {
          if (!target || !navigation.isReady()) return;
          const expected = target;
          target = null;
          const expectedUrl = new URL(expected, location.origin);
          if (expectedUrl.origin !== location.origin) return;
          const actual = location.pathname + location.search + location.hash;
          if (actual !== expected || currentPath.current !== expectedUrl.pathname) {
            router.replace(expected as Href);
          }
        });
      });
    };
    const pop = () => { target = location.pathname + location.search + location.hash; reconcile(); };
    // A new deliberate tap takes precedence over a pending recovery.
    const interaction = () => { target = null; cancel(); };
    window.addEventListener('popstate', pop, true);
    window.addEventListener('pointerdown', interaction, true);
    window.addEventListener('keydown', interaction, true);
    const unsubscribe = navigation.addListener('state', () => { if (target) reconcile(); });
    return () => {
      cancel(); unsubscribe();
      window.removeEventListener('popstate', pop, true);
      window.removeEventListener('pointerdown', interaction, true);
      window.removeEventListener('keydown', interaction, true);
    };
  }, [navigation]);
  return null;
}
