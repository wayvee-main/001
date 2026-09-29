import { create } from 'zustand';

import { clearAskPlan, loadAskPlan, saveAskPlan } from '@/lib/concierge/plan-store';
import { recordConciergeSignal } from '@/lib/concierge/signals';
import type { AskPlanSource, ConciergePlan, ConciergeRequest } from '@/lib/concierge/types';
import type { StopKind } from '@/lib/plan-engine';
import {
  clearSession,
  createAccount,
  restoreSession,
  signInWithEmail,
  signInWithGoogle,
  subscribeToAuthChanges,
  type WayveeSession,
} from '@/lib/auth';
import {
  markArrivalDone,
  restoreArrivalStatus,
  restoreTripContext,
  restoreWalkBudget,
  saveTripContext,
  saveWalkBudget,
  type ArrivalStatus,
  type TripContext,
  type WalkBudget,
} from '@/lib/arrival';
import { EMPTY_PLAN_AROUND, restorePlanAround, savePlanAround, type PlanAround } from '@/lib/plan-around';
import { EVENTS, tonightEvents, type ScoperEvent } from '@/lib/data';
import { recordDinnerHistory, removeDinnerHistory } from '@/lib/dinner-history';
import { milesBetween, usableAnchor, walkMinutes } from '@/lib/geo';
import {
  refreshWayveeLocation,
  requestWayveeLocation,
  restoreLocationPreference,
  skipWayveeLocation,
  type WayveeDeviceLocation,
  type WayveeLocationStatus,
} from '@/lib/location';
import { cancelReminder, scheduleReminder } from '@/lib/notifications';
import { loadPlanHistory, recordPlanHistory, removePlanHistory, type PlanHistoryEntry } from '@/lib/plan-history';
import { coordsForCurated } from '@/lib/places';
import { computeLeaveByReminder, LEAVE_BY_BUFFER_MINUTES, planReminderFireTime, postVisitFireTime, stayCheckoutFireTime } from '@/lib/reminders';
import {
  markStayOnboardingDone,
  restoreStayOnboardingStatus,
  type StayOnboardingStatus,
} from '@/lib/stay';
import {
  clearGuestTasteTags,
  markTastePromptDone,
  restoreGuestTasteTags,
  restoreTastePromptStatus,
  saveGuestTasteTags,
  type TastePromptStatus,
} from '@/lib/taste-onboarding';
import {
  EMPTY_USER_DATA,
  loadUserData,
  setDeliveryPreference,
  setPlan,
  setSavedPlace,
  setStay,
  setTastePreferences,
  setTravelPreferences,
  setVenueFollow,
  type BudgetPreference,
  type WayveeStay,
  type PacePreference,
  type PlanKind,
  type SavedPlaceKind,
} from '@/lib/user-data';
import {
  findPendingPostVisit,
  loadPostVisitOptOut,
  loadVisitFeedback,
  recordVisitFeedback,
  savePostVisitOptOut,
  type VisitRating,
} from '@/lib/visit-feedback';
import { weatherAt } from '@/lib/weather';

export type SheetKind =
  | 'search'
  | 'delivery'
  | 'ride'
  | 'logout'
  | 'stay'
  | 'auth'
  | 'ask'
  | 'startTime'
  | 'addConstraint'
  | 'postVisit'
  | null;

interface ScoperState {
  // Startup, identity, and optional device location
  bootstrapReady: boolean;
  userDataReady: boolean;
  authError: string | null;
  session: WayveeSession | null;
  profileAvatarUrl: string | null;
  savedPlaceKeys: string[];
  locationStatus: WayveeLocationStatus;
  locationCanAskAgain: boolean;
  deviceLocation: WayveeDeviceLocation | null;
  locationBusy: boolean;
  stayOnboardingStatus: StayOnboardingStatus;
  tastePromptStatus: TastePromptStatus;
  /** Device-local, guest-first — the arrival sequence runs before any account
   * exists, so none of these three live in user_preferences. */
  arrivalStatus: ArrivalStatus;
  tripContext: TripContext | null;
  walkBudgetMinutes: WalkBudget;
  /** Restriction chips + the free-text "Other" note from the arrival sequence's
   * last step. What each one is actually allowed to do to ranking is decided by
   * planAroundEffects() against the live catalog, not here. */
  planAround: PlanAround;

  // Global overlays
  sheet: SheetKind;
  deliveryFor: string | null;
  deliveryProvider: string;
  /** eventId the ride sheet should route to; null = no specific plan, show a generic launcher. */
  rideContext: string | null;
  toast: string | null;
  /** Action to replay once sign-in completes — set by requireAuth() when it interrupts a gated action. */
  pendingIntent: (() => void) | null;
  /** Most recent Ask result — ephemeral, not persisted (rawText retention is a
   * privacy decision, not made yet; see TODO.md). Read by app/plan.tsx. */
  askPlan: ConciergePlan | null;
  /** The validated request that produced askPlan — same ephemeral, in-memory
   * lifetime as askPlan itself. A 'refine' ask ("make that cheaper") merges
   * onto this rather than replacing it wholesale (concierge/adapter.ts's
   * mergeRefineRequest), and its own picks become the avoid set so refine
   * visibly moves. Cleared together with askPlan — a refine with nothing to
   * refine against falls back to the ordinary decline path. */
  askRequest: ConciergeRequest | null;
  /** What built askPlan. Null when unknown — a plan rehydrated from a blob
   * written before the field existed. /plan reads null as "do not claim". */
  askPlanSource: AskPlanSource | null;
  /** The past plan the post-visit prompt (screen 20) is currently asking
   * about — device-local, same lifetime as the 'postVisit' sheet. */
  postVisitTarget: PlanHistoryEntry | null;

  // Account-owned data
  plans: string[];
  followedVenues: string[];
  tasteTags: string[];
  dismissedInsightKeys: string[];
  stay: WayveeStay | null;
  pacePreference: PacePreference | null;
  budgetPreference: BudgetPreference | null;
  /** Plan tab's per-night constraints — session-local like the filter fields
   * below, not synced to the backend like pace/budget: a specific night's
   * chosen start time or nightcap-inclusion isn't a standing preference. */
  startTimePreference: string | null;
  wantsNightlife: boolean | null;

  // Filters
  sort: string;
  price: string | null;
  openLate: boolean;
  delivery: boolean;
  reserve: boolean;

  // Discover
  eventCat: string;

  // Actions
  hydrateApp: () => Promise<void>;
  clearAuthError: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<'signed-in' | 'check-email'>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  requestLocation: () => Promise<WayveeLocationStatus>;
  refreshLocation: () => Promise<void>;
  skipLocation: () => Promise<void>;
  linkStay: (stay: WayveeStay) => Promise<void>;
  skipStayOnboarding: () => Promise<void>;
  resolveTastePrompt: (status: 'done' | 'skipped') => Promise<void>;
  clearStay: () => Promise<void>;
  openStaySheet: () => void;
  openAskSheet: () => void;
  openSheet: (sheet: Exclude<SheetKind, 'ride' | null>) => void;
  openRideSheet: (eventId?: string) => void;
  openDelivery: (restaurantId: string) => void;
  closeSheet: () => void;
  setAskPlan: (plan: ConciergePlan | null, request?: ConciergeRequest | null, source?: AskPlanSource | null) => void;
  /** Records what a guest did with the plan currently in askPlan — 'accepted'
   * for a save/add tap on a specific stop, 'refined' for asking to adjust it.
   * Either one marks the plan resolved, so replacing it afterwards isn't
   * also counted as abandoned. See lib/concierge/signals.ts. */
  recordAskPlanSignal: (signal: 'accepted' | 'refined', opts?: { stopKind?: StopKind; refId?: string }) => void;
  showToast: (msg: string) => void;
  setDeliveryProvider: (p: string) => void;
  isPlanned: (kind: PlanKind, itemId: string) => boolean;
  togglePlan: (kind: PlanKind, itemId: string, itemName: string) => void;
  setSort: (v: string) => void;
  togglePrice: (v: string) => void;
  /** Sets a tier outright, or clears with null — what a pick-one menu does.
   * togglePrice stays for the chip idiom, where re-tapping means "undo". */
  setPrice: (v: string | null) => void;
  toggleFlag: (key: 'openLate' | 'delivery' | 'reserve') => void;
  resetFilters: () => void;
  setEventCat: (c: string) => void;
  toggleFollow: (venueId: string, venueName: string) => void;
  isSaved: (placeKind: SavedPlaceKind, placeId: string) => boolean;
  toggleSaved: (placeKind: SavedPlaceKind, placeId: string, placeName: string) => void;
  addTasteTag: (tag: string) => void;
  removeTasteTag: (tag: string) => void;
  /** Bulk, toast-free tag write for the arrival sequence — addTasteTag toasts
   * per tag, which during onboarding means four toasts over the payoff screen. */
  setTasteTags: (tags: string[]) => void;
  setTripContext: (context: TripContext | null) => void;
  setWalkBudgetMinutes: (minutes: WalkBudget) => void;
  setPlanAround: (planAround: PlanAround) => void;
  completeArrival: () => Promise<void>;
  dismissTasteInsight: (key: string) => void;
  setPacePreference: (pace: PacePreference) => void;
  setBudgetPreference: (budget: BudgetPreference) => void;
  setStartTimePreference: (v: string | null) => void;
  setWantsNightlife: (v: boolean | null) => void;
  /** Looks for a past plan eligible for the post-visit prompt and, if found,
   * opens the 'postVisit' sheet. No-ops if another sheet is already open or
   * the guest opted out of the prompt entirely. */
  checkPostVisitPrompt: () => Promise<void>;
  /** Records a rating for the current postVisitTarget and closes the sheet. */
  rateVisit: (rating: VisitRating) => Promise<void>;
  /** Dismisses the current postVisitTarget without a rating; dontAskAgain
   * also sets the permanent opt-out. */
  skipVisitPrompt: (dontAskAgain: boolean) => Promise<void>;
}

const accountReset = {
  profileAvatarUrl: null,
  savedPlaceKeys: [] as string[],
  deliveryProvider: 'Uber Eats',
  plans: [] as string[],
  followedVenues: [] as string[],
  tasteTags: [] as string[],
  dismissedInsightKeys: [] as string[],
  stay: null as WayveeStay | null,
  pacePreference: null as PacePreference | null,
  budgetPreference: null as BudgetPreference | null,
  startTimePreference: null as string | null,
  wantsNightlife: null as boolean | null,
  sort: 'Best match',
  price: null as string | null,
  openLate: false,
  delivery: false,
  reserve: false,
  eventCat: 'Upcoming',
};

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let stopAuthSubscription: (() => void) | null = null;
let sessionHydration = 0;
let intentionalSignOut = false;
// True once the current askPlan has an explicit accepted/refined signal —
// see setAskPlan/recordAskPlanSignal. Starts true: there is no plan yet, so
// nothing is pending resolution.
let askPlanResolved = true;

/** `plans` entries are `${PlanKind}:${itemId}` — same idiom as savedPlaceKeys. */
function splitPlanKey(key: string): [PlanKind, string] {
  const [kind, ...rest] = key.split(':');
  return [kind as PlanKind, rest.join(':')];
}

function schedulePlanReminder(eventId: string): void {
  const event = EVENTS[eventId];
  if (!event) return;
  const fireAt = planReminderFireTime(event);
  if (!fireAt) return;
  void scheduleReminder(`plan-${eventId}`, 'Plan tonight', `${event.name} · ${event.time} at ${event.venue}`, fireAt);
}

function scheduleStayReminder(stay: WayveeStay): void {
  const fireAt = stayCheckoutFireTime(stay);
  if (!fireAt) return;
  void scheduleReminder('stay-checkout', 'Checkout today', `${stay.propertyName} — checkout is today`, fireAt);
}

/** Nudge notification for screen 20 — the actual rating card is shown
 * in-app (checkPostVisitPrompt), this just brings the guest back if the app
 * isn't already open. Tapping it has no special routing, same as every
 * other local reminder here: it opens the app, and the in-app check on
 * bootstrap/plan-change takes it from there. */
function schedulePostVisitReminder(event: ScoperEvent): void {
  if (!event.startsAt) return;
  const fireAt = postVisitFireTime(event.startsAt);
  if (!fireAt) return;
  void scheduleReminder(`postvisit-${event.id}`, `How was ${event.name}?`, `${event.venue} · last night`, fireAt);
}

export const useScoper = create<ScoperState>((set, get) => {
  const applySession = async (nextSession: WayveeSession | null) => {
    const hydration = ++sessionHydration;
    set({ userDataReady: false });

    if (!nextSession) {
      const guestTasteTags = await restoreGuestTasteTags();
      if (hydration !== sessionHydration) return;
      set({
        ...accountReset,
        tasteTags: guestTasteTags,
        session: null,
        userDataReady: true,
        sheet: null,
        toast: null,
        pendingIntent: null,
      });
      return;
    }

    let userData = { ...EMPTY_USER_DATA, displayName: nextSession.user.name };
    try {
      userData = await loadUserData(nextSession);
    } catch {
      // Authentication still succeeds if user-data hydration is temporarily offline.
      // Mutations remain optimistic and the next launch retries the cloud read.
    }
    if (hydration !== sessionHydration) return;

    // A guest may have picked taste tags before creating an account — fold
    // those into the freshly loaded account tags rather than losing them.
    const guestTasteTags = await restoreGuestTasteTags();
    if (hydration !== sessionHydration) return;
    const mergedTasteTags = guestTasteTags.length
      ? Array.from(new Set([...userData.tasteTags, ...guestTasteTags]))
      : userData.tasteTags;
    if (guestTasteTags.length) {
      await clearGuestTasteTags();
      if (mergedTasteTags.length !== userData.tasteTags.length) {
        void setTastePreferences(nextSession, mergedTasteTags, userData.dismissedInsightKeys).catch(() => undefined);
      }
    }

    set({
      ...accountReset,
      session: {
        ...nextSession,
        user: {
          ...nextSession.user,
          name: userData.displayName,
          avatarUrl: userData.avatarUrl || nextSession.user.avatarUrl,
        },
      },
      profileAvatarUrl: userData.avatarUrl,
      savedPlaceKeys: userData.savedPlaceKeys,
      deliveryProvider: userData.deliveryProvider,
      plans: userData.plans,
      followedVenues: userData.followedVenues,
      tasteTags: mergedTasteTags,
      dismissedInsightKeys: userData.dismissedInsightKeys,
      stay: userData.stay,
      pacePreference: userData.pacePreference,
      budgetPreference: userData.budgetPreference,
      userDataReady: true,
    });
  };

  // Real walk time (device location → venue, via geo.ts) and real forecast
  // at the computed departure moment (weather.ts) — computeLeaveByReminder
  // itself refuses to fire on anything less, so a missing location fix or a
  // forecast gap that doesn't cover departure just means no reminder, never
  // an invented one.
  const scheduleLeaveByReminder = (event: ScoperEvent): void => {
    if (!event.startsAt) return;
    const anchor = usableAnchor(get().deviceLocation);
    const venuePoint = coordsForCurated({ name: event.venue, address: event.addr });
    if (!anchor || !venuePoint) return;

    const walk = walkMinutes(milesBetween(anchor, venuePoint));
    const arriveBy = new Date(event.startsAt);
    const approxFireAt = new Date(arriveBy.getTime() - (walk + LEAVE_BY_BUFFER_MINUTES) * 60_000);
    const hour = weatherAt(approxFireAt);
    if (!hour) return;

    const reminder = computeLeaveByReminder(arriveBy, walk, hour.shortForecast.toLowerCase(), LEAVE_BY_BUFFER_MINUTES);
    if (!reminder || reminder.isDue) return;
    void scheduleReminder(`leaveby-${event.id}`, reminder.title, reminder.body, reminder.fireAt);
  };

  const requireAuth = (retry?: () => void): boolean => {
    if (get().session) return true;
    set({ sheet: 'auth', pendingIntent: retry ?? null });
    return false;
  };

  const replayPendingIntent = () => {
    const intent = get().pendingIntent;
    if (!intent) return;
    set({ pendingIntent: null });
    intent();
  };

  return {
    bootstrapReady: false,
    userDataReady: false,
    authError: null,
    session: null,
    ...accountReset,
    locationStatus: 'unknown',
    locationCanAskAgain: true,
    deviceLocation: null,
    locationBusy: false,
    stayOnboardingStatus: 'unknown',
    tastePromptStatus: 'unknown',
    arrivalStatus: 'unknown',
    tripContext: null,
    walkBudgetMinutes: null,
    planAround: EMPTY_PLAN_AROUND,

    sheet: null,
    deliveryFor: null,
    rideContext: null,
    toast: null,
    pendingIntent: null,
    askPlan: null,
    askRequest: null,
    askPlanSource: null,
    postVisitTarget: null,

    hydrateApp: async () => {
      try {
        const [session, location, stayOnboardingStatus, tastePromptStatus, arrivalStatus, tripContext, walkBudgetMinutes, planAround, storedAskPlan] =
          await Promise.all([
            restoreSession(),
            restoreLocationPreference(),
            restoreStayOnboardingStatus(),
            restoreTastePromptStatus(),
            restoreArrivalStatus(),
            restoreTripContext(),
            restoreWalkBudget(),
            restorePlanAround(),
            loadAskPlan(),
          ]);
        set({
          locationStatus: location.status,
          locationCanAskAgain: location.canAskAgain,
          deviceLocation: location.deviceLocation,
          stayOnboardingStatus,
          tastePromptStatus,
          arrivalStatus,
          tripContext,
          walkBudgetMinutes,
          planAround,
        });
        // A plan that survived a restart already fired its own 'shown' signal
        // before the app closed — rehydrating it must not re-fire 'shown', and
        // must not let the next setAskPlan() call treat it as silently
        // abandoned (askPlanResolved marks it already resolved, same as a
        // guest who explicitly acted on it).
        if (storedAskPlan) {
          askPlanResolved = true;
          set({ askPlan: storedAskPlan.plan, askRequest: storedAskPlan.request, askPlanSource: storedAskPlan.source });
        }
        await applySession(session);

        // Reconciles local notification scheduling with whatever plans/stay just
        // hydrated (from this device's storage or the account backend) — covers
        // plans added on another device that this device never scheduled locally.
        const hydratedState = get();
        for (const key of hydratedState.plans) {
          const [kind, itemId] = splitPlanKey(key);
          if (kind !== 'event') continue;
          schedulePlanReminder(itemId);
          const event = EVENTS[itemId];
          if (event) {
            scheduleLeaveByReminder(event);
            schedulePostVisitReminder(event);
          }
        }
        if (hydratedState.stay) scheduleStayReminder(hydratedState.stay);

        if (!stopAuthSubscription) {
          stopAuthSubscription = subscribeToAuthChanges((event, changedSession) => {
            if (event === 'INITIAL_SESSION') return;
            const current = get().session;
            if (changedSession?.user.id === current?.user.id) {
              if (changedSession && current) {
                set({
                  session: {
                    ...changedSession,
                    user: {
                      ...changedSession.user,
                      name: current.user.name,
                      avatarUrl: current.user.avatarUrl || changedSession.user.avatarUrl,
                    },
                  },
                });
              }
              return;
            }
            // Session disappeared without going through signOut() — a refresh-token failure, not a choice.
            if (!changedSession && current && !intentionalSignOut) {
              get().showToast('Your session expired — sign in again to keep syncing');
            }
            void applySession(changedSession);
          });
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Wayvee could not restore your account. Please sign in again.';
        set({ authError: message });
        await applySession(null);
      } finally {
        set({ bootstrapReady: true, userDataReady: get().userDataReady || !get().session });
      }
    },
    clearAuthError: () => set({ authError: null }),
    signIn: async (email, password) => {
      set({ authError: null });
      await applySession(await signInWithEmail(email, password));
      replayPendingIntent();
    },
    register: async (name, email, password) => {
      set({ authError: null });
      const result = await createAccount(name, email, password);
      if (!result.session) return 'check-email';
      await applySession(result.session);
      replayPendingIntent();
      return 'signed-in';
    },
    signInWithGoogle: async () => {
      set({ authError: null });
      const session = await signInWithGoogle();
      if (!session) return false;
      await applySession(session);
      replayPendingIntent();
      return true;
    },
    signOut: async () => {
      ++sessionHydration;
      intentionalSignOut = true;
      const { plans, stay } = get();
      try {
        await clearSession();
      } finally {
        set({ ...accountReset, authError: null, session: null, userDataReady: true, sheet: null, toast: null, pendingIntent: null });
        get().showToast('Signed out — see you around Oakland');
        intentionalSignOut = false;
        for (const key of plans) {
          const [kind, itemId] = splitPlanKey(key);
          if (kind === 'event') void cancelReminder(`plan-${itemId}`);
        }
        if (stay) void cancelReminder('stay-checkout');
      }
    },
    requestLocation: async () => {
      set({ locationBusy: true });
      try {
        const preference = await requestWayveeLocation();
        set({
          locationStatus: preference.status,
          locationCanAskAgain: preference.canAskAgain,
          deviceLocation: preference.deviceLocation,
        });
        return preference.status;
      } finally {
        set({ locationBusy: false });
      }
    },
    // Pull-to-refresh path: silent, best-effort, never prompts. A failed fix
    // leaves the previous one in place rather than dropping to no location.
    refreshLocation: async () => {
      try {
        const preference = await refreshWayveeLocation();
        if (!preference) return;
        set({
          locationStatus: preference.status,
          locationCanAskAgain: preference.canAskAgain,
          deviceLocation: preference.deviceLocation,
        });
      } catch {
        // Keep the stored fix — a transient GPS failure isn't a location change.
      }
    },
    skipLocation: async () => {
      const preference = await skipWayveeLocation();
      set({
        locationStatus: preference.status,
        locationCanAskAgain: preference.canAskAgain,
        deviceLocation: preference.deviceLocation,
      });
    },

    linkStay: async (stay) => {
      if (!requireAuth(() => get().linkStay(stay))) return;
      const previous = get().stay;
      const session = get().session;
      set({ stay, stayOnboardingStatus: 'linked' });
      await markStayOnboardingDone('linked');
      try {
        await setStay(session, stay);
        get().showToast(`${stay.propertyName} linked — Home is now tuned to your stay`);
        scheduleStayReminder(stay);
      } catch {
        if (get().session?.user.id !== session?.user.id) return;
        set({ stay: previous });
        get().showToast('Could not save your stay — try again from Profile');
      }
    },
    skipStayOnboarding: async () => {
      set({ stayOnboardingStatus: 'skipped' });
      await markStayOnboardingDone('skipped');
    },
    resolveTastePrompt: async (status) => {
      set({ tastePromptStatus: status });
      await markTastePromptDone(status);
    },
    clearStay: async () => {
      const previous = get().stay;
      const session = get().session;
      set({ stay: null });
      void cancelReminder('stay-checkout');
      try {
        await setStay(session, null);
        get().showToast('Stay unlinked');
      } catch {
        if (get().session?.user.id !== session?.user.id) return;
        set({ stay: previous });
        get().showToast('Could not update — try again');
      }
    },
    openStaySheet: () => {
      if (!requireAuth(() => get().openSheet('stay'))) return;
      set({ sheet: 'stay' });
    },
    openAskSheet: () => {
      // No auth gate (CLAUDE.md #5): asking builds a plan locally and never
      // persists it (askPlan is ephemeral) — only saving a plan needs a
      // session, and that ask happens later, in its own place.
      set({ sheet: 'ask' });
    },

    openSheet: (sheet) => set({ sheet }),
    openRideSheet: (eventId) => {
      const target = eventId
        ?? get().plans.find((id) => tonightEvents().some((event) => event.id === id))
        ?? tonightEvents()[0]?.id
        ?? null;
      set({ sheet: 'ride', rideContext: target });
    },
    openDelivery: (restaurantId) => set({ sheet: 'delivery', deliveryFor: restaurantId }),
    closeSheet: () => set({ sheet: null }),
    setAskPlan: (plan, request = null, source = null) => {
      const previous = get().askPlan;
      const session = get().session;
      // A plan silently swapped for another one, with no accept/refine tap in
      // between, is exactly what "abandoned" means here — the guest saw it
      // and moved on without it. A plan the guest did act on already fired
      // its own 'accepted'/'refined' signal via recordAskPlanSignal below.
      if (previous && !askPlanResolved) recordConciergeSignal(session, { signal: 'abandoned' });
      askPlanResolved = false;
      if (plan) recordConciergeSignal(session, { signal: 'shown' });
      set({ askPlan: plan, askRequest: plan ? request : null, askPlanSource: plan ? source : null });
      if (plan && request && source) void saveAskPlan(plan, request, source);
      else void clearAskPlan();
    },
    recordAskPlanSignal: (signal, opts) => {
      askPlanResolved = true;
      recordConciergeSignal(get().session, { signal, stopKind: opts?.stopKind, refId: opts?.refId });
    },

    showToast: (msg) => {
      if (toastTimer) clearTimeout(toastTimer);
      set({ toast: msg });
      toastTimer = setTimeout(() => set({ toast: null }), 1800);
    },

    setDeliveryProvider: (provider) => {
      const previous = get().deliveryProvider;
      const session = get().session;
      set({ deliveryProvider: provider });
      void setDeliveryPreference(session, provider).catch(() => {
        if (get().session?.user.id !== session?.user.id) return;
        set({ deliveryProvider: previous });
        get().showToast('Could not sync that preference');
      });
    },

    isPlanned: (kind, itemId) => get().plans.includes(`${kind}:${itemId}`),
    togglePlan: (kind, itemId, itemName) => {
      if (!requireAuth(() => get().togglePlan(kind, itemId, itemName))) return;
      const key = `${kind}:${itemId}`;
      const previous = get().plans;
      const planned = previous.includes(key);
      const next = planned ? previous.filter((value) => value !== key) : [...previous, key];
      const session = get().session;
      set({ plans: next });
      get().showToast(planned ? 'Removed from your plans' : `${itemName} added to your plans`);
      if (planned) {
        if (kind === 'event') {
          void cancelReminder(`plan-${itemId}`);
          void cancelReminder(`leaveby-${itemId}`);
          void cancelReminder(`postvisit-${itemId}`);
        }
        void removePlanHistory(kind, itemId);
      } else {
        if (kind === 'event') {
          schedulePlanReminder(itemId);
          const event = EVENTS[itemId];
          if (event) {
            void recordPlanHistory({
              kind,
              itemId,
              name: event.name,
              venue: event.venue,
              date: event.date,
              time: event.time,
              startsAt: event.startsAt,
              vibeTags: event.vibeTags,
            });
            scheduleLeaveByReminder(event);
            schedulePostVisitReminder(event);
          }
        } else {
          void recordPlanHistory({ kind, itemId, name: itemName });
        }
      }
      void setPlan(session, kind, itemId, !planned).catch(() => {
        if (get().session?.user.id !== session?.user.id) return;
        set({ plans: previous });
        get().showToast('Could not sync your plans');
      });
    },

    setSort: (value) => set({ sort: value }),
    togglePrice: (value) => set({ price: get().price === value ? null : value }),
    setPrice: (value) => set({ price: value }),
    toggleFlag: (key) => set({ [key]: !get()[key] } as Partial<ScoperState>),
    resetFilters: () => set({ sort: 'Best match', price: null, openLate: false, delivery: false, reserve: false }),

    setEventCat: (category) => set({ eventCat: category }),
    toggleFollow: (venueId, venueName) => {
      if (!requireAuth(() => get().toggleFollow(venueId, venueName))) return;
      const previous = get().followedVenues;
      const following = previous.includes(venueId);
      const next = following ? previous.filter((id) => id !== venueId) : [...previous, venueId];
      const session = get().session;
      set({ followedVenues: next });
      get().showToast(following ? 'Unfollowed' : `Following ${venueName}`);
      void setVenueFollow(session, venueId, !following).catch(() => {
        if (get().session?.user.id !== session?.user.id) return;
        set({ followedVenues: previous });
        get().showToast('Could not sync followed venues');
      });
    },
    isSaved: (placeKind, placeId) => get().savedPlaceKeys.includes(`${placeKind}:${placeId}`),
    toggleSaved: (placeKind, placeId, placeName) => {
      if (!requireAuth(() => get().toggleSaved(placeKind, placeId, placeName))) return;
      const key = `${placeKind}:${placeId}`;
      const previous = get().savedPlaceKeys;
      const saved = previous.includes(key);
      const next = saved ? previous.filter((value) => value !== key) : [...previous, key];
      const session = get().session;
      set({ savedPlaceKeys: next });
      get().showToast(saved ? `Removed ${placeName}` : `Saved ${placeName}`);
      // The Ask concierge's only honest "avoid a repeat" signal (CLAUDE.md #4)
      // — recorded on explicit Save, same as recordPlanHistory above for events.
      if (placeKind === 'restaurant') {
        void (saved ? removeDinnerHistory(placeId) : recordDinnerHistory(placeId));
      }
      void setSavedPlace(session, placeKind, placeId, !saved).catch(() => {
        if (get().session?.user.id !== session?.user.id) return;
        set({ savedPlaceKeys: previous });
        get().showToast('Could not sync saved places');
      });
    },
    addTasteTag: (tag) => {
      const cleanTag = tag.trim();
      if (!cleanTag || get().tasteTags.includes(cleanTag)) return;
      const previous = get().tasteTags;
      const next = [...previous, cleanTag];
      const dismissed = get().dismissedInsightKeys;
      const session = get().session;
      set({ tasteTags: next });
      get().showToast(`${cleanTag} added to your profile`);
      if (!session) {
        void saveGuestTasteTags(next);
        return;
      }
      void setTastePreferences(session, next, dismissed).catch(() => {
        if (get().session?.user.id !== session?.user.id) return;
        set({ tasteTags: previous });
        get().showToast('Could not sync your taste profile');
      });
    },
    removeTasteTag: (tag) => {
      const previous = get().tasteTags;
      const next = previous.filter((value) => value !== tag);
      const dismissed = get().dismissedInsightKeys;
      const session = get().session;
      set({ tasteTags: next });
      get().showToast(`${tag} removed from your profile`);
      if (!session) {
        void saveGuestTasteTags(next);
        return;
      }
      void setTastePreferences(session, next, dismissed).catch(() => {
        if (get().session?.user.id !== session?.user.id) return;
        set({ tasteTags: previous });
        get().showToast('Could not sync your taste profile');
      });
    },
    setTasteTags: (tags) => {
      const cleaned = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
      const previous = get().tasteTags;
      if (cleaned.length === previous.length && cleaned.every((tag) => previous.includes(tag))) return;
      const dismissed = get().dismissedInsightKeys;
      const session = get().session;
      set({ tasteTags: cleaned });
      if (!session) {
        void saveGuestTasteTags(cleaned);
        return;
      }
      void setTastePreferences(session, cleaned, dismissed).catch(() => {
        if (get().session?.user.id !== session?.user.id) return;
        set({ tasteTags: previous });
        get().showToast('Could not sync your taste profile');
      });
    },
    setTripContext: (context) => {
      set({ tripContext: context });
      void saveTripContext(context);
    },
    setWalkBudgetMinutes: (minutes) => {
      set({ walkBudgetMinutes: minutes });
      void saveWalkBudget(minutes);
    },
    setPlanAround: (planAround) => {
      // Stores what the arrival sequence collected, and nothing more. Ranking
      // and the concierge are Wayvee's own, carried over unchanged — see the
      // note on planAroundEffects for how to wire these in when that changes.
      set({ planAround });
      void savePlanAround(planAround);
    },
    completeArrival: async () => {
      set({ arrivalStatus: 'done' });
      await markArrivalDone();
    },
    dismissTasteInsight: (key) => {
      const previous = get().dismissedInsightKeys;
      const next = previous.includes(key) ? previous : [...previous, key];
      const tags = get().tasteTags;
      const session = get().session;
      set({ dismissedInsightKeys: next });
      get().showToast('Got it — that will not shape your feed');
      void setTastePreferences(session, tags, next).catch(() => {
        if (get().session?.user.id !== session?.user.id) return;
        set({ dismissedInsightKeys: previous });
        get().showToast('Could not sync your taste profile');
      });
    },
    setPacePreference: (pace) => {
      const previous = get().pacePreference;
      const budget = get().budgetPreference;
      const session = get().session;
      set({ pacePreference: pace });
      void setTravelPreferences(session, pace, budget).catch(() => {
        if (get().session?.user.id !== session?.user.id) return;
        set({ pacePreference: previous });
        get().showToast('Could not sync that preference');
      });
    },
    setBudgetPreference: (budget) => {
      const previous = get().budgetPreference;
      const pace = get().pacePreference;
      const session = get().session;
      set({ budgetPreference: budget });
      void setTravelPreferences(session, pace, budget).catch(() => {
        if (get().session?.user.id !== session?.user.id) return;
        set({ budgetPreference: previous });
        get().showToast('Could not sync that preference');
      });
    },
    setStartTimePreference: (v) => set({ startTimePreference: v }),
    setWantsNightlife: (v) => set({ wantsNightlife: v }),

    checkPostVisitPrompt: async () => {
      if (get().sheet) return;
      const optedOut = await loadPostVisitOptOut();
      if (optedOut) return;
      const [planHistory, feedback] = await Promise.all([loadPlanHistory(), loadVisitFeedback()]);
      if (get().sheet) return; // another sheet may have opened while these loaded
      const target = findPendingPostVisit(planHistory, feedback);
      if (!target) return;
      set({ postVisitTarget: target, sheet: 'postVisit' });
    },
    rateVisit: async (rating) => {
      const target = get().postVisitTarget;
      if (!target) return;
      set({ sheet: null, postVisitTarget: null });
      await recordVisitFeedback(target.kind, target.itemId, rating);
      if (rating === 'loved') get().showToast(`Noted — more ${target.venue ?? target.name} nights`);
      else if (rating === 'not_for_me') get().showToast("Noted — we'll steer away from that");
    },
    skipVisitPrompt: async (dontAskAgain) => {
      const target = get().postVisitTarget;
      set({ sheet: null, postVisitTarget: null });
      if (target) await recordVisitFeedback(target.kind, target.itemId, 'skipped');
      if (dontAskAgain) await savePostVisitOptOut(true);
    },
  };
});
