// Per-night drafts for "Plan my stay" — persisted locally (device storage, not
// Supabase; itinerary drafts aren't saves/plans/taste/auth per CLAUDE.md) so a
// guest who picks tonight's dinner and reopens the app tomorrow finds the same
// plan instead of a blank slate. Scoped to the guest's current stay (property +
// dates): linking a new stay starts fresh rather than replaying an old trip's
// picks. A guest with no linked stay still gets one persisted "night" — today.
import { getStoredItem, setStoredItem } from '@/lib/storage';
import type { WayveeStay } from '@/lib/user-data';

const STORAGE_KEY = 'wayvee.itinerary.v1';
const NO_STAY_SCOPE = 'no-stay';

export interface NightDraft {
  generated: boolean;
  restaurantId: string | null;
  eventId: string | null;
  nightlifeSpotId: string | null;
  lockedRestaurant: boolean;
  lockedEvent: boolean;
  lockedNightlife: boolean;
  /** Which door the guest came through. 'vee' means they accepted a ready-made
   * shape; 'manual' means they chose to build it themselves. The draft screen
   * greets each differently — telling someone who just accepted a plan to "pick
   * every stop yourself" describes the door they didn't take.
   *
   * Optional on purpose: drafts written before this field existed still load,
   * because isNightDraft only requires the fields that were always there. */
  source?: 'vee' | 'manual';
  /** The shape name the guest picked ("Low-key & walkable"), so the choice
   * survives the tap across into the draft. */
  themeName?: string;
}

export const EMPTY_NIGHT_DRAFT: NightDraft = {
  generated: false,
  restaurantId: null,
  eventId: null,
  nightlifeSpotId: null,
  lockedRestaurant: false,
  lockedEvent: false,
  lockedNightlife: false,
};

interface StoredItinerary {
  scope: string;
  nights: Record<string, NightDraft>;
}

function itineraryScope(stay: WayveeStay | null): string {
  return stay ? `${stay.propertyName}|${stay.checkIn}|${stay.checkOut}` : NO_STAY_SCOPE;
}

function isNightDraft(value: unknown): value is NightDraft {
  const v = value as Partial<NightDraft> | null;
  return Boolean(
    v &&
      typeof v.generated === 'boolean' &&
      (v.restaurantId === null || typeof v.restaurantId === 'string') &&
      (v.eventId === null || typeof v.eventId === 'string') &&
      (v.nightlifeSpotId === null || typeof v.nightlifeSpotId === 'string') &&
      typeof v.lockedRestaurant === 'boolean' &&
      typeof v.lockedEvent === 'boolean' &&
      typeof v.lockedNightlife === 'boolean',
  );
}

/** Loads every persisted night draft that still belongs to this stay (or to no
 * stay). Drafts from a previous, different stay are dropped — a new trip
 * shouldn't resurrect the last one's picks. */
export async function loadItinerary(stay: WayveeStay | null): Promise<Record<string, NightDraft>> {
  const raw = await getStoredItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<StoredItinerary>;
    if (parsed.scope !== itineraryScope(stay) || !parsed.nights) return {};
    const nights: Record<string, NightDraft> = {};
    for (const [date, draft] of Object.entries(parsed.nights)) {
      if (isNightDraft(draft)) nights[date] = draft;
    }
    return nights;
  } catch {
    return {};
  }
}

export async function saveNightDraft(stay: WayveeStay | null, date: string, draft: NightDraft): Promise<void> {
  const nights = await loadItinerary(stay);
  nights[date] = draft;
  const payload: StoredItinerary = { scope: itineraryScope(stay), nights };
  await setStoredItem(STORAGE_KEY, JSON.stringify(payload));
}
