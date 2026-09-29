// Device-local record of restaurants a guest has deliberately opened from a
// non-empty search. This is selection history, not a claim about visits or
// community popularity, and ordinary browsing never writes to it.
import { getStoredItem, setStoredItem } from '@/lib/storage';

const STORAGE_KEY = 'wayvee.restaurantExplorations.v1';
const MAX_ENTRIES = 40;
const RESTAURANT_PREFIX = '/restaurant/';

export interface RestaurantExploration {
  href: string;
  label: string;
  count: number;
  lastExploredAt: string;
}

export interface RestaurantExplorationInput {
  href: string;
  label: string;
}

/** Accepts internal restaurant routes and removes route-only query/hash noise.
 * Dish search results already point at their parent /restaurant/:id route, so
 * they naturally collapse into the same canonical entry as restaurant hits. */
export function canonicalRestaurantHref(href: string): string | null {
  const match = href.trim().match(/^\/restaurant\/([^/?#]+)\/?(?:[?#].*)?$/);
  if (!match || match[1] === '.' || match[1] === '..') return null;
  return `${RESTAURANT_PREFIX}${match[1]}`;
}

function parseEntry(value: unknown): RestaurantExploration | null {
  if (typeof value !== 'object' || value === null) return null;

  const candidate = value as Partial<RestaurantExploration>;
  const href = typeof candidate.href === 'string' ? canonicalRestaurantHref(candidate.href) : null;
  const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
  const exploredAt = typeof candidate.lastExploredAt === 'string' ? Date.parse(candidate.lastExploredAt) : Number.NaN;

  if (
    !href ||
    !label ||
    !Number.isSafeInteger(candidate.count) ||
    (candidate.count ?? 0) <= 0 ||
    !Number.isFinite(exploredAt)
  ) {
    return null;
  }

  return {
    href,
    label,
    count: candidate.count!,
    lastExploredAt: new Date(exploredAt).toISOString(),
  };
}

function rank(entries: RestaurantExploration[]): RestaurantExploration[] {
  return entries
    .sort((a, b) => {
      const countDifference = b.count - a.count;
      if (countDifference) return countDifference;
      const recencyDifference = Date.parse(b.lastExploredAt) - Date.parse(a.lastExploredAt);
      return recencyDifference || a.href.localeCompare(b.href);
    })
    .slice(0, MAX_ENTRIES);
}

function normalizeEntries(values: unknown[]): RestaurantExploration[] {
  const byHref = new Map<string, RestaurantExploration>();

  for (const value of values) {
    const entry = parseEntry(value);
    if (!entry) continue;

    const previous = byHref.get(entry.href);
    if (!previous) {
      byHref.set(entry.href, entry);
      continue;
    }

    const entryIsNewer = Date.parse(entry.lastExploredAt) >= Date.parse(previous.lastExploredAt);
    byHref.set(entry.href, {
      href: entry.href,
      label: entryIsNewer ? entry.label : previous.label,
      count: Math.min(Number.MAX_SAFE_INTEGER, previous.count + entry.count),
      lastExploredAt: entryIsNewer ? entry.lastExploredAt : previous.lastExploredAt,
    });
  }

  return rank([...byHref.values()]);
}

export async function loadRestaurantExplorations(): Promise<RestaurantExploration[]> {
  try {
    const raw = await getStoredItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeEntries(parsed) : [];
  } catch {
    return [];
  }
}

/** Records one deliberate selection from restaurant search results. Invalid or
 * non-restaurant routes are ignored and return the unchanged ranked history. */
export async function recordRestaurantExploration(
  input: RestaurantExplorationInput,
): Promise<RestaurantExploration[]> {
  const existing = await loadRestaurantExplorations();
  const href = canonicalRestaurantHref(input.href);
  const label = input.label.trim();
  if (!href || !label) return existing;

  const previous = existing.find((entry) => entry.href === href);
  const next = rank([
    {
      href,
      label,
      count: Math.min(Number.MAX_SAFE_INTEGER, (previous?.count ?? 0) + 1),
      lastExploredAt: new Date().toISOString(),
    },
    ...existing.filter((entry) => entry.href !== href),
  ]);

  await setStoredItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
