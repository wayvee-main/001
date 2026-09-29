import { getStoredItem, setStoredItem } from '@/lib/storage';
import type { WayveeStay } from '@/lib/user-data';

// Device-local record of whether the "link your stay" onboarding step has been
// shown — separate from the actual stay value, which syncs to the account via
// user-data.ts. Mirrors location.ts's pattern for the same reason: a returning
// guest shouldn't see the prompt again just because they're on a new device,
// but a guest who already has a stay saved to their account effectively has.

const STAY_ONBOARDING_KEY = 'wayvee.stay-onboarding.v1';

export type StayOnboardingStatus = 'unknown' | 'linked' | 'skipped';

export async function restoreStayOnboardingStatus(): Promise<StayOnboardingStatus> {
  const raw = await getStoredItem(STAY_ONBOARDING_KEY);
  return raw === 'linked' || raw === 'skipped' ? raw : 'unknown';
}

export async function markStayOnboardingDone(status: 'linked' | 'skipped'): Promise<void> {
  await setStoredItem(STAY_ONBOARDING_KEY, status);
}

/** 'MM/DD/YYYY' → 'YYYY-MM-DD', or null if not a real date. */
export function parseUsDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  const month = Number(mm);
  const day = Number(dd);
  const year = Number(yyyy);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

export interface StayProgress {
  totalNights: number;
  currentNight: number;
  nightsLeft: number;
}

export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's date as 'YYYY-MM-DD', device-local — the default night for a guest with no linked stay. */
export function todayIso(now = new Date()): string {
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** Shift a 'YYYY-MM-DD' date by whole days, staying device-local. Used by the
 * stay date picker to bound checkout to the day after check-in. */
export function addDaysIso(value: string, days: number): string {
  const date = parseDateOnly(value);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

/** Nights between check-in and checkout, 0 when the range is empty/inverted —
 * unlike stayProgress, this does not clamp to 1, so a half-picked range in the
 * date picker reads honestly instead of claiming a night that isn't booked. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = parseDateOnly(checkOut).getTime() - parseDateOnly(checkIn).getTime();
  return Math.max(0, Math.round(diff / msPerDay));
}

/** Every night of the stay as 'YYYY-MM-DD', check-in through the night before
 * checkout — the same nights stayProgress counts. Always at least one date,
 * even for a malformed/same-day stay, so a night rail never renders empty. */
export function stayNightDates(stay: WayveeStay): string[] {
  const checkIn = parseDateOnly(stay.checkIn);
  const checkOut = parseDateOnly(stay.checkOut);
  const dates: string[] = [];
  for (let cursor = checkIn; cursor.getTime() < checkOut.getTime(); cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)) {
    dates.push(toIsoDate(cursor));
  }
  return dates.length ? dates : [toIsoDate(checkIn)];
}

export type StayArcPosition = 'arrival' | 'middle' | 'climax' | 'departure';

/** Where a given night falls in the stay's own narrative. The first night
 * stays close and familiar (still finding your feet); the last stays easy
 * (early flight, don't overcommit); the night before checkout is the one
 * worth spending rating/budget leniency on — "tonight's the splurge, you
 * leave tomorrow." A 1-night (or malformed) stay has no arc to speak of and
 * reads as 'middle' — today's flat, unweighted behavior. */
export function stayArcPosition(stay: WayveeStay, dateIso: string): StayArcPosition {
  const nights = stayNightDates(stay);
  const index = nights.indexOf(dateIso);
  if (index === -1 || nights.length <= 1) return 'middle';
  if (index === 0) return 'arrival';
  if (index === nights.length - 1) return 'departure';
  if (index === nights.length - 2) return 'climax';
  return 'middle';
}

/** "Night X of Y" math — clamped so a stale/expired stay still reads sensibly instead of going negative. */
export function stayProgress(stay: WayveeStay, now = new Date()): StayProgress {
  const msPerDay = 24 * 60 * 60 * 1000;
  const checkIn = parseDateOnly(stay.checkIn);
  const checkOut = parseDateOnly(stay.checkOut);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const totalNights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / msPerDay));
  const elapsed = Math.round((today.getTime() - checkIn.getTime()) / msPerDay);
  const currentNight = Math.min(totalNights, Math.max(1, elapsed + 1));
  const nightsLeft = Math.max(0, totalNights - currentNight + 1);

  return { totalNights, currentNight, nightsLeft };
}

/** True once checkout has passed — the linked stay shouldn't keep framing Home after the trip ends. */
export function isStayActive(stay: WayveeStay, now = new Date()): boolean {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parseDateOnly(stay.checkOut).getTime() >= today.getTime();
}

/** The night the app is planning right now: today when there is no stay, and
 * otherwise the stay night the guest is currently on, clamped to the trip.
 *
 * A stay that has not started yet is still "active" (isStayActive only asks
 * whether checkout has passed), so a booked trip plans from its opening night
 * rather than from today. That is the behaviour the Plans tab and the builder
 * already had; this only gives it one definition.
 *
 * Three screens derived this independently — the Plans tab, the builder, and
 * now /plan, which has to write the draft the builder will read. Three copies
 * of the same clamp is three chances for them to disagree about which night a
 * plan belongs to. */
export function currentNightIso(stay: WayveeStay | null, now = new Date()): string {
  if (!stay || !isStayActive(stay, now)) return todayIso(now);
  const dates = stayNightDates(stay);
  const progress = stayProgress(stay, now);
  return dates[Math.min(dates.length - 1, Math.max(0, progress.currentNight - 1))] ?? todayIso(now);
}

/** Whole days from now until checkout — 0 on checkout day, negative once the stay has ended. */
export function daysUntilCheckout(stay: WayveeStay, now = new Date()): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parseDateOnly(stay.checkOut).getTime() - today.getTime()) / msPerDay);
}
