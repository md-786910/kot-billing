import { useCallback, useEffect, useState } from 'react';

/** After a "too many attempts" (429) reply, how long the submit button stays disabled */
export const RATE_LIMIT_COOLDOWN_MS = 30_000;

/**
 * Seconds left on a cooldown, ticking down once a second.
 * Retrying while the server is rate limiting only extends its window, so the button waits instead.
 */
export function useCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= Date.now()) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [until]);

  const start = useCallback((ms: number = RATE_LIMIT_COOLDOWN_MS) => {
    const t = Date.now();
    setNow(t);
    setUntil(t + ms);
  }, []);

  const secondsLeft = Math.max(0, Math.ceil((until - now) / 1000));
  return { secondsLeft, active: secondsLeft > 0, start };
}
