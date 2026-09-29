import { useEffect, useState } from 'react';

import { useScoper } from '@/lib/store';
import { EMPTY_TASTE_PROFILE, type TasteProfile } from '@/lib/taste';
import { buildTasteProfile } from '@/lib/taste-profile';

/** The taste profile, rebuilt whenever the guest's stated tags change. Starts
 * empty and fills in — a ranker fed the empty profile simply produces no taste
 * terms, which is the correct behaviour for a guest with no history. */
export function useTasteProfile(): TasteProfile {
  const tasteTags = useScoper((s) => s.tasteTags);
  const [profile, setProfile] = useState<TasteProfile>(EMPTY_TASTE_PROFILE);
  const tasteKey = tasteTags.join('|');

  useEffect(() => {
    let cancelled = false;
    buildTasteProfile(tasteTags)
      .then((next) => {
        if (!cancelled) setProfile(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasteKey]);

  return profile;
}
