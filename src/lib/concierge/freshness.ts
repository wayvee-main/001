// Guardrail on top of the validator (docs/build-book.md Part 3.6): a freshness
// and confidence check before anything is shown. Never blocks a plan — only
// narrows how it's presented — because CLAUDE.md #6 means the concierge
// degrades honestly rather than failing outright.
import { PACE_WALK_BUDGET_MIN } from '@/lib/plan-engine';
import { supabase } from '@/lib/supabase';
import type { PacePreference } from '@/lib/user-data';
import type { ConciergePlan } from './types';

export type SyncStatusRow = {
  job: 'events' | 'ticketmaster' | 'viator' | 'places' | 'weather';
  status: 'ok' | 'partial' | 'failed';
  finished_at: string;
};

/** Same budget scripts/check-sync.ts:29 already uses for the `events` job —
 * re-declared here rather than imported, since that script runs its CLI body
 * at module scope and isn't meant to be imported. */
const EVENTS_FRESHNESS_BUDGET_HOURS = 50;

export async function readSyncStatus(): Promise<SyncStatusRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('sync_status').select('job, status, finished_at');
  if (error || !data) return [];
  return data as SyncStatusRow[];
}

export type EventsFreshness = 'fresh' | 'stale' | 'unknown';

export function eventsFreshness(rows: SyncStatusRow[], now = new Date()): EventsFreshness {
  const row = rows.find((r) => r.job === 'events');
  if (!row) return 'unknown';
  if (row.status === 'failed') return 'stale';
  const ageHours = (now.getTime() - Date.parse(row.finished_at)) / 3_600_000;
  return ageHours > EVENTS_FRESHNESS_BUDGET_HOURS ? 'stale' : 'fresh';
}

/** Detects the two "always returns something" fallbacks plan-engine.ts can
 * fall through to: a restaurant scored down for being closed, or a walk leg
 * that exceeds the pace's own budget because pickFeasible() (plan-engine.ts:194)
 * had nothing walkable to choose from. Neither is an error — both deserve the
 * honest, narrowed presentation from build-book Part 4.2 rather than looking
 * like a confident match. */
function hasFallbackSignal(plan: ConciergePlan, pace: PacePreference): boolean {
  const closedAnywhere = [...plan.solved.reasons.restaurant, ...plan.solved.reasons.event, ...plan.solved.reasons.nightlife].some((reason) =>
    reason.startsWith('Closed'),
  );
  if (closedAnywhere) return true;

  const budgetMin = PACE_WALK_BUDGET_MIN[pace];
  return plan.stopLegs.some((leg) => {
    if (!leg) return false;
    const minutes = Number.parseInt(leg, 10);
    return Number.isFinite(minutes) && minutes > budgetMin;
  });
}

/** Applies the freshness + fallback layer to an already-built plan. Never
 * mutates plan-engine.ts's own output — only decides how honestly to frame it. */
export function applyFreshness(plan: ConciergePlan, pace: PacePreference, syncRows: SyncStatusRow[], now = new Date()): ConciergePlan {
  const notes = [...plan.notes];
  const relaxed = [...plan.relaxed];
  let confidence = plan.confidence;

  const freshness = eventsFreshness(syncRows, now);
  if (freshness === 'stale') {
    confidence = confidence === 'strong' ? 'narrowed' : confidence;
    notes.push('Event listings may be out of date — the daily refresh hasn’t run recently.');
  }

  if (hasFallbackSignal(plan, pace)) {
    confidence = 'fallback';
    if (!relaxed.includes('walkBudget')) relaxed.push('walkBudget');
  }

  return { ...plan, confidence, notes, relaxed };
}
