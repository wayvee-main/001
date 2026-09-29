import type { WayveeSession } from '@/lib/auth';
import { BUDGET_OPTIONS, PACE_OPTIONS, type BudgetPreference, type PacePreference } from '@/lib/concierge/enums';
import { requireSupabase } from '@/lib/supabase';

/** Guest-entered stay context — free text, never a curated hotel database. No brand affiliation. */
export interface WayveeStay {
  propertyName: string;
  checkIn: string; // 'YYYY-MM-DD'
  checkOut: string; // 'YYYY-MM-DD'
}

/** Fixed option sets for the Create tab's "Plan my stay" pickers — the same
 * vocabulary the user_preferences.pace_preference/budget_preference check
 * constraints enforce (see supabase/migrations/20260724010000_citycue_travel_preferences.sql).
 * Defined in concierge/enums.ts (import-free) so the concierge guardrail and
 * the Node eval can use them without pulling in this module's Supabase and
 * auth dependencies; re-exported here so existing call sites keep working. */
export { BUDGET_OPTIONS, PACE_OPTIONS, type BudgetPreference, type PacePreference };

export interface WayveeUserData {
  displayName: string;
  avatarUrl: string | null;
  /** `${PlanKind}:${itemId}` keys — same idiom as savedPlaceKeys below. */
  plans: string[];
  followedVenues: string[];
  deliveryProvider: string;
  tasteTags: string[];
  dismissedInsightKeys: string[];
  savedPlaceKeys: string[];
  stay: WayveeStay | null;
  pacePreference: PacePreference | null;
  budgetPreference: BudgetPreference | null;
}

export const EMPTY_USER_DATA: WayveeUserData = {
  displayName: 'Guest',
  avatarUrl: null,
  plans: [],
  followedVenues: [],
  deliveryProvider: 'Uber Eats',
  tasteTags: [],
  dismissedInsightKeys: [],
  savedPlaceKeys: [],
  stay: null,
  pacePreference: null,
  budgetPreference: null,
};

export function canSyncUserData(session: WayveeSession | null): session is WayveeSession {
  return session !== null;
}

export async function loadUserData(session: WayveeSession): Promise<WayveeUserData> {
  const client = requireSupabase();
  const userId = session.user.id;
  const [profileResult, preferencesResult, plansResult, followsResult, savedResult] = await Promise.all([
    client.from('profiles').select('display_name, avatar_url').eq('id', userId).maybeSingle(),
    client
      .from('user_preferences')
      .select(
        'preferred_delivery_provider, taste_tags, dismissed_insight_keys, stay_property_name, stay_check_in, stay_check_out, pace_preference, budget_preference',
      )
      .eq('user_id', userId)
      .maybeSingle(),
    client.from('user_plans').select('item_kind, item_id').eq('user_id', userId).order('created_at', { ascending: true }),
    client.from('venue_follows').select('venue_id').eq('user_id', userId).order('created_at', { ascending: true }),
    client
      .from('saved_places')
      .select('place_kind, place_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ]);

  const error = profileResult.error || preferencesResult.error || plansResult.error || followsResult.error || savedResult.error;
  if (error) throw error;

  const profile = profileResult.data;
  const preferences = preferencesResult.data;

  return {
    displayName: profile?.display_name || session.user.name,
    avatarUrl: profile?.avatar_url || session.user.avatarUrl || null,
    plans: (plansResult.data ?? []).map((row) => `${row.item_kind}:${row.item_id}`),
    followedVenues: (followsResult.data ?? []).map((row) => row.venue_id),
    deliveryProvider: preferences?.preferred_delivery_provider || 'Uber Eats',
    tasteTags: preferences?.taste_tags ?? [],
    dismissedInsightKeys: preferences?.dismissed_insight_keys ?? [],
    savedPlaceKeys: (savedResult.data ?? []).map((row) => `${row.place_kind}:${row.place_id}`),
    stay: preferences?.stay_property_name && preferences?.stay_check_in && preferences?.stay_check_out
      ? { propertyName: preferences.stay_property_name, checkIn: preferences.stay_check_in, checkOut: preferences.stay_check_out }
      : null,
    pacePreference: (preferences?.pace_preference as PacePreference | null) ?? null,
    budgetPreference: (preferences?.budget_preference as BudgetPreference | null) ?? null,
  };
}

export async function setStay(session: WayveeSession | null, stay: WayveeStay | null): Promise<void> {
  if (!canSyncUserData(session)) return;
  const { error } = await requireSupabase()
    .from('user_preferences')
    .upsert({
      user_id: session.user.id,
      stay_property_name: stay?.propertyName ?? null,
      stay_check_in: stay?.checkIn ?? null,
      stay_check_out: stay?.checkOut ?? null,
    });
  if (error) throw error;
}

export type SavedPlaceKind = 'restaurant' | 'venue' | 'place' | 'night';

export async function setSavedPlace(
  session: WayveeSession | null,
  placeKind: SavedPlaceKind,
  placeId: string,
  saved: boolean,
): Promise<void> {
  if (!canSyncUserData(session)) return;
  const client = requireSupabase();
  const query = saved
    ? client.from('saved_places').upsert({ user_id: session.user.id, place_kind: placeKind, place_id: placeId })
    : client
        .from('saved_places')
        .delete()
        .eq('user_id', session.user.id)
        .eq('place_kind', placeKind)
        .eq('place_id', placeId);
  const { error } = await query;
  if (error) throw error;
}

/** Kinds a guest can pin to their plans — wider than SavedPlaceKind: events
 * and dated Viator picks have their own real time/date and belong here, but
 * never in saved_places (which is "keep for later", not "on my night"). */
export type PlanKind = 'event' | 'restaurant' | 'venue' | 'night' | 'crawl' | 'pick';

export async function setPlan(session: WayveeSession | null, itemKind: PlanKind, itemId: string, planned: boolean): Promise<void> {
  if (!canSyncUserData(session)) return;
  const client = requireSupabase();
  const query = planned
    ? client.from('user_plans').upsert({ user_id: session.user.id, item_kind: itemKind, item_id: itemId })
    : client
        .from('user_plans')
        .delete()
        .eq('user_id', session.user.id)
        .eq('item_kind', itemKind)
        .eq('item_id', itemId);
  const { error } = await query;
  if (error) throw error;
}

export async function setVenueFollow(session: WayveeSession | null, venueId: string, following: boolean): Promise<void> {
  if (!canSyncUserData(session)) return;
  const client = requireSupabase();
  const query = following
    ? client.from('venue_follows').upsert({ user_id: session.user.id, venue_id: venueId })
    : client.from('venue_follows').delete().eq('user_id', session.user.id).eq('venue_id', venueId);
  const { error } = await query;
  if (error) throw error;
}

export async function setDeliveryPreference(session: WayveeSession | null, provider: string): Promise<void> {
  if (!canSyncUserData(session)) return;
  const { error } = await requireSupabase()
    .from('user_preferences')
    .upsert({ user_id: session.user.id, preferred_delivery_provider: provider });
  if (error) throw error;
}

export async function setTastePreferences(
  session: WayveeSession | null,
  tasteTags: string[],
  dismissedInsightKeys: string[],
): Promise<void> {
  if (!canSyncUserData(session)) return;
  const { error } = await requireSupabase()
    .from('user_preferences')
    .upsert({
      user_id: session.user.id,
      taste_tags: tasteTags,
      dismissed_insight_keys: dismissedInsightKeys,
    });
  if (error) throw error;
}

export async function setTravelPreferences(
  session: WayveeSession | null,
  pacePreference: PacePreference | null,
  budgetPreference: BudgetPreference | null,
): Promise<void> {
  if (!canSyncUserData(session)) return;
  const { error } = await requireSupabase()
    .from('user_preferences')
    .upsert({
      user_id: session.user.id,
      pace_preference: pacePreference,
      budget_preference: budgetPreference,
    });
  if (error) throw error;
}
