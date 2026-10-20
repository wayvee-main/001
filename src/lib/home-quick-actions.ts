import { currentDaypart, type Daypart } from '@/lib/daypart';
import { openStateFor } from '@/lib/hours';

export interface HomeVenueCandidate {
  id: string;
  name: string;
  href: `/restaurant/${string}` | `/place/${string}`;
  category: string;
  terms: string[];
  openingHours: string | null;
  openLate: boolean;
  miles: number;
}

export interface HomeVenueAction {
  id: string;
  name: string;
  href: HomeVenueCandidate['href'];
  glyph: 'coffee' | 'food';
  intent: 'Coffee' | 'Breakfast' | 'Lunch' | 'A bite' | 'Dinner' | 'Late bites';
}

type Intent = HomeVenueAction['intent'];
const INTENTS: Record<Daypart, [Intent, Intent]> = {
  morning: ['Coffee', 'Breakfast'],
  midday: ['Lunch', 'Lunch'],
  afternoon: ['Coffee', 'A bite'],
  evening: ['Dinner', 'Dinner'],
  lateNight: ['Late bites', 'Late bites'],
};

const nameKey = (name: string) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Real local venues, not generic search intents. The caller supplies only the
 * selected trip's five-mile catalog. Hours exclude known closures; missing
 * hours stay unknown and never become an "Open now" claim. */
export function homeVenueActions(candidates: HomeVenueCandidate[], now: Date): HomeVenueAction[] {
  const daypart = currentDaypart(now);
  const available = candidates.flatMap((candidate) => {
    const state = openStateFor(candidate.openingHours, now);
    if (state.status === 'closed' || !candidate.name.trim() || !Number.isFinite(candidate.miles) || candidate.miles < 0) return [];
    const terms = [candidate.name, ...candidate.terms].join(' ');
    const coffee = candidate.category === 'cafe' || /\b(coffee|espresso|caf[eé])\b/i.test(terms);
    const breakfast = candidate.category === 'bakery' || /\b(breakfast|brunch|bagels?|pancakes?|waffles?|bakery|donuts?|pastr(?:y|ies)|croissants?|beignets?)\b/i.test(terms);
    const meal = candidate.category === 'restaurant';
    return [{ ...candidate, coffee, breakfast, meal, isOpen: state.status === 'open' }];
  });
  const usedIds = new Set<string>(), usedNames = new Set<string>();
  const actions: HomeVenueAction[] = [];
  for (const intent of INTENTS[daypart]) {
    const fit = (candidate: typeof available[number]): number => {
      switch (intent) {
        case 'Coffee': return candidate.coffee ? 0 : candidate.breakfast ? 1 : Infinity;
        case 'Breakfast': return candidate.breakfast ? 0 : candidate.coffee ? 1 : Infinity;
        case 'A bite': return candidate.breakfast ? 0 : candidate.meal ? 1 : candidate.coffee ? 2 : Infinity;
        case 'Lunch':
        case 'Dinner': return candidate.meal ? 0 : Infinity;
        case 'Late bites': return (candidate.isOpen || candidate.openLate) && (candidate.meal || candidate.breakfast || candidate.coffee) ? 0 : Infinity;
      }
    };
    const next = available
      .filter((candidate) => !usedIds.has(candidate.id) && !usedNames.has(nameKey(candidate.name)) && Number.isFinite(fit(candidate)))
      .sort((a, b) => fit(a) - fit(b) || Number(b.isOpen) - Number(a.isOpen) || a.miles - b.miles || a.name.localeCompare(b.name))[0];
    if (!next) continue;
    usedIds.add(next.id); usedNames.add(nameKey(next.name));
    // A café filling an otherwise-empty breakfast slot still reads as coffee,
    // without inventing a breakfast menu for it.
    const actualIntent = (intent === 'Breakfast' && !next.breakfast) || (intent === 'A bite' && !next.breakfast && !next.meal)
      ? 'Coffee' : intent === 'Coffee' && !next.coffee ? 'Breakfast' : intent;
    actions.push({ id: next.id, name: next.name, href: next.href, intent: actualIntent,
      glyph: actualIntent === 'Coffee' ? 'coffee' : 'food' });
  }
  return actions;
}
