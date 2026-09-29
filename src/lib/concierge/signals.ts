// Learning-signal capture (TODO.md Phase 3) — what a guest actually did with
// a concierge plan, not just what the model produced. Always logs locally
// first, same append-and-cap pattern as plan-history.ts, so this works fully
// signed out (CLAUDE.md #5/#6); mirrors to Supabase only when signed in, and
// only as a best-effort side effect that can never block or fail the UI
// action that triggered it — a guest tapping "Save" must never wait on, or
// see an error from, a write to a table they don't know exists.
import type { WayveeSession } from '@/lib/auth';
import type { StopKind } from '@/lib/plan-engine';
import { getStoredItem, setStoredItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'wayvee.conciergeSignals.v1';
const MAX_LOCAL_ENTRIES = 100;

export type ConciergeSignalKind = 'shown' | 'accepted' | 'refined' | 'abandoned' | 'completed' | 'rated';

export interface ConciergeSignalEntry {
  signal: ConciergeSignalKind;
  stopKind: StopKind | null;
  refId: string | null;
  intent: string | null;
  rating: number | null;
  recordedAt: string; // ISO
}

function isSignalEntry(value: unknown): value is ConciergeSignalEntry {
  const v = value as Partial<ConciergeSignalEntry> | null;
  return Boolean(v && typeof v.signal === 'string' && typeof v.recordedAt === 'string');
}

async function appendLocal(entry: ConciergeSignalEntry): Promise<void> {
  const raw = await getStoredItem(STORAGE_KEY);
  let existing: ConciergeSignalEntry[] = [];
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      existing = Array.isArray(parsed) ? parsed.filter(isSignalEntry) : [];
    } catch {
      existing = [];
    }
  }
  await setStoredItem(STORAGE_KEY, JSON.stringify([entry, ...existing].slice(0, MAX_LOCAL_ENTRIES)));
}

async function mirrorToSupabase(session: WayveeSession, entry: ConciergeSignalEntry): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('concierge_signals').insert({
      user_id: session.user.id,
      signal: entry.signal,
      stop_kind: entry.stopKind,
      ref_id: entry.refId,
      intent: entry.intent,
      rating: entry.rating,
    });
  } catch {
    // Best-effort only — the local log above is the source of truth a guest
    // actually depends on; a flaky connection here just means this one
    // signal doesn't reach the account-level history until the next one does.
  }
}

/** Records one thing a guest did with a concierge plan. Fire-and-forget by
 * design — callers should never `await` this from an interaction handler. */
export function recordConciergeSignal(
  session: WayveeSession | null,
  input: { signal: ConciergeSignalKind; stopKind?: StopKind | null; refId?: string | null; intent?: string | null; rating?: number | null },
): void {
  const entry: ConciergeSignalEntry = {
    signal: input.signal,
    stopKind: input.stopKind ?? null,
    refId: input.refId ?? null,
    intent: input.intent ?? null,
    rating: input.rating ?? null,
    recordedAt: new Date().toISOString(),
  };
  void appendLocal(entry).catch(() => undefined);
  if (session) void mirrorToSupabase(session, entry);
}
