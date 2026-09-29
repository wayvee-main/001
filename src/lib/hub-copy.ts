// Every line the food hub's header says about itself, derived in one place.
// Kept out of the screen so it can be tested the way lib/daypart.ts is: this is
// the only spot in the app that turns catalog fields into a sentence, and the
// rules about what it may and may not claim live with the code that claims it.

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** Spelled out where a person would spell it out, digits past that. */
export function countWord(n: number): string {
  return n >= 0 && n < COUNT_WORDS.length ? COUNT_WORDS[n] : String(n);
}

/** The guest's words, capitalized enough to head a page — never reworded, so
 * the title always says back exactly what they searched for. */
export function asTitle(raw: string): string {
  const trimmed = raw.trim();
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

/** The guest's own words plus the one thing the page knows that they don't yet:
 * how many. "Mexican, ten ways" rather than "Mexican" — the subject is never
 * reworded and the number is counted, not guessed, so the whole title stays
 * something the app can stand behind. A single result gets its own form,
 * because "one ways" is not a sentence and "1 match" is not a headline. */
export function composedTitle(subject: string, count: number): string {
  const head = asTitle(subject);
  if (!head || count <= 0) return head;
  if (count === 1) return `${head}, just the one`;
  return `${head}, ${countWord(count)} ways`;
}

/** $ / $$ / $$$ say nothing on their own about how a night will feel. The
 * catalog stores no money — only these three symbols — so this mapping is the
 * app's own reading of its own shorthand, stated in one place rather than
 * implied in three. It is the one piece of hub copy that adds an opinion, and
 * it is deliberately the only one. */
const PRICE_WORDS: Record<string, string> = { $: 'budget', $$: 'mid-range', $$$: 'splurge' };

/** The word for one tier, unqualified — what a single place's price strip
 * wants. pricePhrase() below is for a set of results and reads "all splurge",
 * which is a summary of many and wrong on a page about one. */
export function priceWord(tier: string): string | null {
  return PRICE_WORDS[tier] ?? null;
}

/** "budget to splurge" for a spread, "all mid-range" when every match sits on
 * one tier, nothing at all when there are no prices to read. Expects tiers in
 * ascending order, as PRICE_TIERS supplies them. */
export function pricePhrase(tiers: string[]): string | null {
  const known = tiers.filter((tier) => PRICE_WORDS[tier]);
  if (!known.length) return null;
  const low = PRICE_WORDS[known[0]];
  const high = PRICE_WORDS[known[known.length - 1]];
  return low === high ? `all ${low}` : `${low} to ${high}`;
}
