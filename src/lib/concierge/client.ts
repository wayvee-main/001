// Calls the concierge Edge Function and validates its response. Every
// failure path — missing session, no key configured server-side, timeout,
// rate limit, network down, malformed JSON, a response that fails the
// enum-only guardrail — resolves to null. null is not an error state here;
// it is the signal to fall back to ordinary browsing (CLAUDE.md #6).
import { supabase } from '@/lib/supabase';
import { parseConciergeRequest } from './request';
import type { ConciergeRequest } from './types';

const RETRY_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A thrown error here means the request never reached the function at all
 * (device offline for a moment, a dropped mobile connection) — distinct from
 * a 204 "declined" response, which resolves normally and never throws. Worth
 * one retry on a guest's own flaky connection; a second failure is treated
 * the same as every other decline path, straight to browsing. */
export async function requestConciergeRequest(rawText: string, moodVocabulary: string[]): Promise<ConciergeRequest | null> {
  if (!supabase || !rawText.trim()) return null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('concierge', {
        body: { rawText: rawText.trim(), moodVocabulary },
      });
      if (error || !data) return null;
      return parseConciergeRequest(data, moodVocabulary);
    } catch {
      if (attempt === 1) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      return null;
    }
  }
  return null;
}
