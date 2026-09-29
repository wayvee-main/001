// Seeded randomness for the concierge's variety picks (adapter.ts). The same
// sentence asked at the same moment should produce the same plan — useful for
// eval and for a guest who screenshots a plan and asks again — while manual
// "Another set"/Regenerate taps (create.tsx, plan-draft.tsx) keep using
// Math.random() untouched, since those exist specifically to feel different
// on every tap.

/** FNV-1a — stable across platforms/runs, unlike Array#reduce over charCodes
 * which can differ under different JS engine string internals. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 — small, fast, good-enough distribution for picking among a
 * handful of top-tier candidates. Not cryptographic; nothing here needs it. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
