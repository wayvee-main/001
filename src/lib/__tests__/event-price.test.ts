import { isPrintablePrice } from '@/components/event-meta';

/** Event listings put two different things in one field. A real price is
 * information a guest decides on; boilerplate standing in for one ("See
 * tickets") is the longest string in the title row and repeats what the
 * tappable row already offers. Only the first earns text — the second becomes
 * a ticket glyph.
 *
 * The cost of getting this wrong is asymmetric. A price mistaken for
 * boilerplate silently hides the number, which is the one fact the guest came
 * for; boilerplate mistaken for a price just prints a few words that were
 * being printed before. So the predicate errs toward printing. */
describe('isPrintablePrice', () => {
  it('prints anything carrying a number', () => {
    // Every shape the bundled catalog and the Ticketmaster sync produce.
    for (const label of ['$40', '$89–$129', '$69-$109', '40', '£40', '€25', 'From $30', '$1,200']) {
      expect(isPrintablePrice(label)).toBe(true);
    }
  });

  it('prints free, which is a price with no number in it', () => {
    expect(isPrintablePrice('Free')).toBe(true);
    expect(isPrintablePrice('free')).toBe(true);
    expect(isPrintablePrice('  FREE  ')).toBe(true);
  });

  it('turns boilerplate into the glyph', () => {
    for (const label of ['See tickets', 'Official tickets', 'Tickets', '']) {
      expect(isPrintablePrice(label)).toBe(false);
    }
  });

  it('is not fooled by surrounding space', () => {
    expect(isPrintablePrice('  $40 ')).toBe(true);
    expect(isPrintablePrice('   ')).toBe(false);
  });
});
