import { useEffect, useState } from 'react';

// A ticking "now" for screens whose content depends on the hour (daypart
// ordering, event countdowns). Without this, a screen mounted at 4:59 PM keeps
// claiming it's afternoon all evening — the opposite of the "right now is live"
// rule in CLAUDE.md. One interval per screen, cleared on unmount.

/** Re-renders the caller on a fixed cadence and returns the current time.
 * Default 60s: fine enough for minute-level countdowns, cheap enough to leave
 * running on a tab. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
