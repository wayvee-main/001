import { durationFrom, eventFacts, liveLineFor, restaurantFacts } from '@/lib/detail-facts';
import type { OpenState } from '@/lib/hours';

const OPEN: OpenState = { status: 'open', closesAt: '10:00 PM', closesInMinutes: 90 };
const ALWAYS: OpenState = { status: 'open', closesAt: null, closesInMinutes: null };
const CLOSED: OpenState = { status: 'closed', opensAt: 'Tue 11 AM' };
const UNKNOWN: OpenState = { status: 'unknown' };

describe('liveLineFor', () => {
  it('merges the open state and the walk into one line', () => {
    const line = liveLineFor({ openState: OPEN, walkMinutes: 12, walkBudgetMinutes: 20 });
    expect(line).toEqual({
      tone: 'open',
      label: 'Open till 10:00 PM · 12 min walk, in budget',
      note: expect.stringContaining('Walk measured from you.'),
    });
  });

  it('says when the walk is past the budget', () => {
    const line = liveLineFor({ openState: OPEN, walkMinutes: 34, walkBudgetMinutes: 20 });
    expect(line?.label).toBe('Open till 10:00 PM · 34 min walk, past your 20 min budget');
  });

  it('drops the budget clause when no budget is set', () => {
    const line = liveLineFor({ openState: OPEN, walkMinutes: 12, walkBudgetMinutes: 0 });
    expect(line?.label).toBe('Open till 10:00 PM · 12 min walk');
  });

  it('omits the walk clause entirely when there is no measured walk', () => {
    const line = liveLineFor({ openState: OPEN, walkMinutes: null });
    expect(line?.label).toBe('Open till 10:00 PM');
    expect(line?.note).not.toContain('Walk measured');
  });

  it('handles a round-the-clock spot without inventing a closing time', () => {
    expect(liveLineFor({ openState: ALWAYS })?.label).toBe('Open · 24 hours');
  });

  it('turns danger for a closed kitchen and carries the reopening', () => {
    const line = liveLineFor({ openState: CLOSED, walkMinutes: 5, walkBudgetMinutes: 20 });
    expect(line?.tone).toBe('danger');
    expect(line?.label).toBe('Closed · opens Tue 11 AM · 5 min walk, in budget');
  });

  it('says only "Closed now" when the rules never reopen', () => {
    expect(liveLineFor({ openState: { status: 'closed', opensAt: null } })?.label).toBe('Closed now');
  });

  it('renders nothing when the hours are unreadable and there is no walk', () => {
    expect(liveLineFor({ openState: UNKNOWN })).toBeNull();
    expect(liveLineFor({ openState: UNKNOWN, walkMinutes: null })).toBeNull();
  });

  it('still states a measured walk when the hours are unreadable', () => {
    const line = liveLineFor({ openState: UNKNOWN, walkMinutes: 8, walkBudgetMinutes: 20 });
    expect(line).toEqual({ tone: 'open', label: '8 min walk, in budget', note: 'Walk measured from you.' });
  });
});

describe('restaurantFacts', () => {
  it('says the price tier in words and marks it as the accent', () => {
    const [price] = restaurantFacts({ price: '$$$', reservable: true });
    expect(price).toEqual({ glyph: 'dollar', label: '$$$ · splurge', tone: 'accent' });
  });

  it('distinguishes reservable from walk-in', () => {
    expect(restaurantFacts({ price: '$$', reservable: true })[1].label).toBe('Reserves online');
    expect(restaurantFacts({ price: '$$', reservable: false })[1].label).toBe('Walk in');
  });

  it('carries a duration only when one was passed', () => {
    expect(restaurantFacts({ price: '$', reservable: false })).toHaveLength(2);
    expect(restaurantFacts({ price: '$', reservable: false, duration: '2.5–3 hours' })).toHaveLength(3);
  });

  it('never spends more than the strip can render on one line', () => {
    const facts = restaurantFacts({ price: '$$$', reservable: true, duration: '2.5–3 hours', distance: '10 min ride' });
    expect(facts).toHaveLength(3);
    expect(facts.map((fact) => fact.glyph)).toEqual(['dollar', 'check', 'clock']);
  });

  it('spends the third slot on the distance when there is no duration', () => {
    const facts = restaurantFacts({ price: '$$$', reservable: true, distance: '10 min ride' });
    expect(facts[2]).toEqual({ glyph: 'route', label: '10 min ride' });
  });

  it('leaves the price fact out rather than inventing a tier', () => {
    const facts = restaurantFacts({ reservable: false });
    expect(facts.map((fact) => fact.glyph)).not.toContain('dollar');
  });

  it('keeps an unrecognised tier verbatim instead of dropping it', () => {
    expect(restaurantFacts({ price: '$$$$', reservable: false })[0].label).toBe('$$$$');
  });

  it('never contains the open state or the walk — the live line owns those', () => {
    const labels = restaurantFacts({ price: '$$', reservable: true, duration: '2 hours' })
      .map((fact) => fact.label)
      .join(' ');
    expect(labels).not.toMatch(/open|closes|walk from/i);
  });
});

describe('eventFacts', () => {
  it('labels the start "On stage" only when doors were published', () => {
    expect(eventFacts({ startLabel: '8 PM' })[0].label).toBe('Starts 8 PM');
    expect(eventFacts({ doorsLabel: '7 PM', startLabel: '8 PM' })[1].label).toBe('On stage 8 PM');
  });

  it('greens a free admission and accents a paid one', () => {
    expect(eventFacts({ priceLabel: 'Free' })[0].tone).toBe('open');
    expect(eventFacts({ priceLabel: 'From $35' })[0].tone).toBe('accent');
  });

  it('produces nothing at all from an empty listing', () => {
    expect(eventFacts({})).toEqual([]);
  });

  it('is held to the same one-line budget', () => {
    const facts = eventFacts({ doorsLabel: '7 PM', startLabel: '8 PM', priceLabel: 'From $35', travel: '12 min BART' });
    expect(facts).toHaveLength(3);
    expect(facts.map((fact) => fact.label)).toEqual(['Doors 7 PM', 'On stage 8 PM', 'From $35']);
  });
});

describe('durationFrom', () => {
  it('reads a curated "allow" clause', () => {
    expect(durationFrom([{ label: 'Experience', value: 'Ten-course tasting menu · allow 2.5–3 hours' }]))
      .toBe('2.5–3 hours');
  });

  it('returns null rather than guessing', () => {
    expect(durationFrom([{ label: 'Phone', value: '(510) 653-3902' }])).toBeNull();
    expect(durationFrom([])).toBeNull();
  });
});
