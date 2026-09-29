// What /answer can honestly say about the answer it is showing.
//
// These were badges inside a bordered summary box: a price chip, one chip per
// exclusion, and a match count. On a declined answer none of them apply, and
// the box drew its divider anyway — a rule with nothing under it. A strip
// that returns [] draws nothing, which is the honest shape for "there is
// nothing to say yet".

import type { HubFact } from '@/components/fact-strip';

/** Same ceiling as the detail screens': a strip is a summary, and a fourth
 * short fact already overruns 362 pt at text-meta. */
export const ANSWER_STRIP_MAX = 3;

/** Exclusions collapse into one fact rather than one each, so the match count
 * — the fact a guest actually came for — never gets pushed off the end by a
 * long "not" list. */
export function exclusionLabel(exclusions: readonly string[]): string | null {
  if (!exclusions.length) return null;
  if (exclusions.length === 1) return `Not ${exclusions[0]}`;
  return `Not ${exclusions[0]} +${exclusions.length - 1}`;
}

/** What a screen reader hears in place of "+2". */
export function spokenExclusions(exclusions: readonly string[]): string | null {
  if (!exclusions.length) return null;
  if (exclusions.length === 1) return `not ${exclusions[0]}`;
  return `not ${exclusions.slice(0, -1).join(', ')} or ${exclusions[exclusions.length - 1]}`;
}

export function answerFacts({
  budget,
  exclusions = [],
  matchCount = 0,
}: {
  budget?: string | null;
  exclusions?: readonly string[];
  /** Rows actually on screen, not rows found. Zero means say nothing — a
   * "0 matches" chip above an empty list is the list saying it twice. */
  matchCount?: number;
}): HubFact[] {
  const excluded = exclusionLabel(exclusions);
  return [
    budget ? { glyph: 'wallet', label: budget, tone: 'accent' as const } : null,
    excluded ? { glyph: 'filter', label: excluded } : null,
    matchCount > 0
      ? { glyph: 'spark', label: `${matchCount} top ${matchCount === 1 ? 'match' : 'matches'}`, tone: 'open' as const }
      : null,
  ]
    .filter((fact): fact is HubFact => fact !== null)
    .slice(0, ANSWER_STRIP_MAX);
}
