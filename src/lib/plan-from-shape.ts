// A shape tile's solved night, in the shape /plan renders.
//
// The Plans tab has two doors into the same job. "Ask" runs the concierge
// adapter, which ends by wrapping its SolvedNight in a ConciergePlan; "Or
// start from a shape" solves the same way and then had nowhere to send it, so
// it went to /plan-draft instead and the two doors never met.
//
// This is that adapter tail (adapter.ts, after solveNight) with nothing else
// attached: the same planStopOrder, the same orderedLegs, the same confidence
// rule. Kept here rather than in the adapter because a shape has no
// ConciergeRequest behind it — there is no model call, no intent, no relaxed
// constraint to report — and the adapter's job is to turn a request into a
// plan.

import type { ConciergePlan } from '@/lib/concierge/types';
import type { GeoPoint } from '@/lib/geo';
import { orderedLegs, planStopOrder, type SolvedNight, type StopKind } from '@/lib/plan-engine';

export function planFromShape(
  solved: SolvedNight,
  selectedDateAt: Date,
  coordsOf: (place: { name: string; address?: string }) => GeoPoint | null,
): ConciergePlan {
  const { order: stopOrder, dinnerTimeLabel } = planStopOrder(
    solved.event,
    solved.restaurant,
    solved.nightlifeSpot,
    selectedDateAt,
  );
  const pointForStop = (kind: StopKind): GeoPoint | null => {
    if (kind === 'event') return solved.event ? coordsOf({ name: solved.event.venue }) : null;
    if (kind === 'dinner') return solved.restaurant ? coordsOf(solved.restaurant) : null;
    return solved.nightlifeSpot ? coordsOf(solved.nightlifeSpot) : null;
  };

  return {
    solved,
    stopOrder,
    stopLegs: orderedLegs(stopOrder, pointForStop),
    dinnerTimeLabel,
    // The adapter's own rule, not a blanket 'strong'. A shape with neither a
    // kitchen nor a show is the same fallback there as here — the tile is
    // offering the closest real thing, and /plan says so rather than calling
    // an empty night a match.
    confidence: solved.event === null && solved.restaurant === null ? 'fallback' : 'strong',
    // Both of these report what a *request* had to give up. A shape asked for
    // nothing, so it relaxed nothing, and there is nothing to note.
    notes: [],
    relaxed: [],
  };
}
