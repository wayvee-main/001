// How a set of chosen vibes reads on one pill.
//
// The builder used to spend a heading and three chips saying this. On a pill
// there is room for one value, so a second choice becomes "+1" and the full
// list is kept for the screen reader — the pill is a summary, the spoken label
// is the answer.

/** What the pill shows. Empty is a real state and says so: "Any vibe" is the
 * honest reading of "no filter", where a blank chip reads as broken. */
export function vibeLabel(vibes: readonly string[]): string {
  if (!vibes.length) return 'Any vibe';
  if (vibes.length === 1) return vibes[0];
  return `${vibes[0]} +${vibes.length - 1}`;
}

/** What a screen reader hears — every choice, never "+1". */
export function spokenVibes(vibes: readonly string[]): string {
  if (!vibes.length) return 'any vibe';
  if (vibes.length === 1) return vibes[0];
  return `${vibes.slice(0, -1).join(', ')} and ${vibes[vibes.length - 1]}`;
}
