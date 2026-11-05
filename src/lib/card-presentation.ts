/** Shared display limits. Source records and full detail content stay intact. */
export const CARD_DESCRIPTION_LIMIT = 80;
export const CARD_METADATA_LIMIT = 28;
export const CARD_TITLE_LIMIT = 40;

export function compactCardText(text: string, limit = CARD_DESCRIPTION_LIMIT): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const characters = Array.from(clean);
  if (characters.length <= limit) return clean;
  let cut = characters.slice(0, Math.max(0, limit - 1)).join('').trimEnd();
  const space = cut.lastIndexOf(' ');
  if (space > limit * .55) cut = cut.slice(0, space);
  return cut.replace(/[\s.,;:–—-]+$/u, '') + '…';
}

export function shortCardTitle(title: string): string {
  const words = title.trim().split(/\s+/);
  const first = words.slice(0, 5).join(' ').replace(words.length > 5 ? /\s+(?:vs\.?|versus|at|with|and|w\/)$/i : /$^/, '');
  const limited = compactCardText(first, CARD_TITLE_LIMIT);
  return words.length > 5 && !limited.endsWith('…') ? compactCardText(first + '…', CARD_TITLE_LIMIT) : limited;
}

/** Normalize cached distance labels too, without changing price comparisons
 * or claiming that a travel-time estimate is a measured distance. */
export function numericDistanceLabel(text: string): string {
  return text.replace(/(?:\b(?:less\s+than|more\s+than|under|over|at\s+least|at\s+most)\s*|[<>≤≥≈~]\s*=?\s*)(?=\d+(?:\.\d+)?\s*(?:mi(?:les?)?|km|m|kilomet(?:er|re)s?|met(?:er|re)s?|min(?:ute)?s?)\b)/gi, '').trim();
}

export function metadataParts(text: string): string[] {
  return numericDistanceLabel(text).split(/\s*[·•]\s*/).map(part => part.trim()).filter(Boolean);
}
