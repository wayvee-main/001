import { RESTAURANTS } from '@/lib/data';
import { deleteStoredItem, getStoredItem, setStoredItem } from '@/lib/storage';
import { normalize, restaurantHaystack, tagMatches } from '@/lib/taste';

// Device-local record of the "Anything Vee should plan around?" step — the
// structured restriction chips plus the free-text note behind "Other". Stored
// the same way as arrival.ts (device-local, guest-first): the step runs before
// anyone has an account, and the whole promise of the sequence is that it works
// without one.

const PLAN_AROUND_KEY = 'wayvee.plan-around.v1';
const PLAN_AROUND_NOTE_KEY = 'wayvee.plan-around-note.v1';

/** The chips, in the order the screen draws them. `No restrictions` is the
 * default and is mutually exclusive with everything else. */
export const PLAN_AROUND_CHIPS = [
  'No restrictions',
  'Vegetarian',
  'Vegan',
  'Gluten-free',
  'Halal',
  'Dairy-free',
  'Nut allergy',
  'Wheelchair access',
  'Low-noise',
  'Limited standing',
  'No alcohol',
  'Other',
] as const;

export const NO_RESTRICTIONS = 'No restrictions';
export const OTHER_RESTRICTION = 'Other';

export const PLAN_AROUND_NOTE_MAX = 90;

export interface PlanAround {
  chips: string[];
  note: string;
}

export const EMPTY_PLAN_AROUND: PlanAround = { chips: [NO_RESTRICTIONS], note: '' };

export async function restorePlanAround(): Promise<PlanAround> {
  const [rawChips, rawNote] = await Promise.all([
    getStoredItem(PLAN_AROUND_KEY),
    getStoredItem(PLAN_AROUND_NOTE_KEY),
  ]);
  let chips: string[] = [NO_RESTRICTIONS];
  if (rawChips) {
    try {
      const parsed = JSON.parse(rawChips) as unknown;
      if (Array.isArray(parsed)) {
        const clean = parsed.filter((chip): chip is string =>
          typeof chip === 'string' && (PLAN_AROUND_CHIPS as readonly string[]).includes(chip));
        if (clean.length) chips = clean;
      }
    } catch {
      // Corrupt payload falls back to the default rather than throwing during
      // bootstrap — same posture as restoreGuestTasteTags.
    }
  }
  return { chips, note: rawNote ?? '' };
}

export async function savePlanAround({ chips, note }: PlanAround): Promise<void> {
  await setStoredItem(PLAN_AROUND_KEY, JSON.stringify(chips));
  if (note.trim()) await setStoredItem(PLAN_AROUND_NOTE_KEY, note.trim());
  else await deleteStoredItem(PLAN_AROUND_NOTE_KEY);
}

/** Applying `No restrictions` clears everything; picking anything else clears
 * `No restrictions`; emptying the list falls back to `No restrictions`. */
export function togglePlanAroundChip(chips: string[], chip: string): string[] {
  if (chip === NO_RESTRICTIONS) return [NO_RESTRICTIONS];
  const withoutDefault = chips.filter((value) => value !== NO_RESTRICTIONS);
  if (withoutDefault.includes(chip)) {
    const next = withoutDefault.filter((value) => value !== chip);
    return next.length ? next : [NO_RESTRICTIONS];
  }
  return [...withoutDefault, chip];
}

/** What each chip *could* mean to the ranker, before checking whether the
 * catalog can actually back it.
 *
 * `prefer` is a dietary need — it ranks matching kitchens up (a vegan guest
 * wants the vegan places first). `avoid` is an allergen — it drops a kitchen
 * outright, the one deliberate exception to "never drop, only demote", because
 * a downranked allergen is still a plan that can hurt someone.
 *
 * Chips absent from this table are real constraints the catalog has no verified
 * field for. They are still stored and still handed to Vee as context; what
 * they are never allowed to do is claim they filtered anything. */
const CHIP_TERMS: Record<string, { prefer?: string[]; avoid?: string[] }> = {
  Vegetarian: { prefer: ['vegetarian'] },
  Vegan: { prefer: ['vegan'] },
  'Gluten-free': { prefer: ['gluten free'] },
  Halal: { prefer: ['halal'] },
  'Dairy-free': { avoid: ['dairy'] },
  'Nut allergy': { avoid: ['nuts', 'peanut', 'peanuts'] },
};

/** True when at least one real catalog entry names the term, using the same
 * whole-word matcher the ranker uses. Checked at runtime against the live
 * catalog rather than hardcoded, so a term stops or starts being enforceable as
 * the catalog changes, without this file needing to know. */
function catalogKnows(term: string): boolean {
  const needle = normalize(term);
  return Object.values(RESTAURANTS).some((restaurant) =>
    tagMatches(needle, normalize(restaurantHaystack(restaurant))));
}

export interface PlanAroundEffects {
  /** Dietary needs the catalog can rank on — fed in as taste tags. */
  preferTags: string[];
  /** Allergens the catalog actually names — fed in as hard exclusions. */
  avoidTerms: string[];
  /** Stored and passed to Vee as context, but not claimed as applied to
   * ranking: either no catalog field backs them, or nothing in the catalog
   * names the term today. */
  contextOnly: string[];
}

export function planAroundEffects({ chips, note }: PlanAround): PlanAroundEffects {
  const preferTags: string[] = [];
  const avoidTerms: string[] = [];
  const contextOnly: string[] = [];

  for (const chip of chips) {
    if (chip === NO_RESTRICTIONS) continue;
    if (chip === OTHER_RESTRICTION) {
      if (note.trim()) contextOnly.push(note.trim());
      continue;
    }
    const terms = CHIP_TERMS[chip];
    if (!terms) {
      contextOnly.push(chip);
      continue;
    }
    const prefer = (terms.prefer ?? []).filter(catalogKnows);
    const avoid = (terms.avoid ?? []).filter(catalogKnows);
    if (prefer.length) preferTags.push(...prefer);
    if (avoid.length) avoidTerms.push(...avoid);
    if (!prefer.length && !avoid.length) contextOnly.push(chip);
  }

  return { preferTags, avoidTerms, contextOnly };
}

/** The line the confirmation card prints. Names every constraint the guest
 * chose — hiding the ones the ranker can't enforce would be worse than showing
 * them, since the guest still needs to know Wayvee is carrying them. */
export function planAroundSummary({ chips, note }: PlanAround): string {
  const structured = chips.filter((chip) => chip !== OTHER_RESTRICTION && chip !== NO_RESTRICTIONS);
  const custom = chips.includes(OTHER_RESTRICTION) ? note.trim() : '';
  const combined = custom ? [...structured, custom] : structured;
  return combined.length ? combined.join(' · ') : NO_RESTRICTIONS;
}
