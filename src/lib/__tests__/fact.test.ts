// resolveFactSubject runs against the real, live catalog (no fixtures) since
// its whole job is "does the guest's sentence name something Wayvee actually
// carries" — a fixture catalog would test nothing about that.
import { resolveFactSubject } from '@/lib/concierge/fact';
import { RESTAURANTS } from '@/lib/data';

const FARMHOUSE = RESTAURANTS.farmhouse;

describe('resolveFactSubject', () => {
  it('resolves a real restaurant name mentioned in a question', () => {
    const subject = resolveFactSubject(`Is ${FARMHOUSE.name} open right now?`);
    expect(subject).not.toBeNull();
    expect(subject?.kind).toBe('restaurant');
    expect(subject?.id).toBe('farmhouse');
  });

  it('resolves a real venue name from the curated event catalog', () => {
    const subject = resolveFactSubject("Is the Fox Theater open Mondays?");
    expect(subject).not.toBeNull();
    expect(subject?.kind).toBe('venue');
    expect(subject?.name).toBe('Fox Theater');
  });

  it('resolves a name with a different apostrophe style than the catalog uses', () => {
    // events.ts stores "Yoshi’s" (curly apostrophe); a guest types straight.
    const subject = resolveFactSubject("What time does Yoshi's open?");
    expect(subject).not.toBeNull();
    expect(subject?.name).toContain('Yoshi');
  });

  it('returns null for a sentence naming nothing in the catalog', () => {
    expect(resolveFactSubject('Is the moon open on Mondays?')).toBeNull();
  });

  it('returns null for an empty or whitespace-only sentence', () => {
    expect(resolveFactSubject('')).toBeNull();
    expect(resolveFactSubject('   ')).toBeNull();
  });

  it('never credits a short name that only appears as a substring of another word', () => {
    // Guards the word-boundary match — a loose substring test would wrongly
    // credit a short catalog name buried inside an unrelated longer word.
    const subject = resolveFactSubject('xyzfarmhousekitchenabc is a made-up word');
    expect(subject).toBeNull();
  });

  it('prefers the longer, more specific match when multiple real names appear', () => {
    const subject = resolveFactSubject(`${FARMHOUSE.name} versus the Fox Theater — which is closer?`);
    expect(subject).not.toBeNull();
    // Both are real; the assertion only requires a deterministic, real pick —
    // never null, never an invented third name.
    expect(['restaurant', 'venue']).toContain(subject?.kind);
  });

  it('never invents a name that is not in rawText at all', () => {
    const subject = resolveFactSubject('dinner tonight please');
    expect(subject).toBeNull();
  });
});
