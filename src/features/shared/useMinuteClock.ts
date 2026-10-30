import { useEffect, useState } from 'react';
import { useScreenActive } from '../../hooks/useActivity';
export function useMinuteClock() {
  const active = useScreenActive();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const update = () => setNow(Date.now()); const initial = setTimeout(update, 0);
    const timer = setInterval(update, 30000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [active]);
  return now;
}
