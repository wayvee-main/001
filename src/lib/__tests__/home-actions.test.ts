import { HOME_ACTION_LINKS } from '@/lib/data';
import { homeActionLinks } from '@/lib/daypart';

function at(hour: number): Date {
  return new Date(2026, 6, 25, hour, 0, 0);
}

const labelsAt = (hour: number) => homeActionLinks(at(hour)).map((link) => link.label);

describe('homeActionLinks', () => {
  it('leads with the intent that matches the hour', () => {
    expect(labelsAt(8)[0]).toBe('Coffee near me');
    expect(labelsAt(12)[0]).toBe('Fast delivery');
    expect(labelsAt(15)[0]).toBe('Happy hours');
    expect(labelsAt(19)[0]).toBe('Reserve tonight');
    expect(labelsAt(23)[0]).toBe('Open late');
  });

  it('never adds or drops a launcher — only reorders', () => {
    for (const hour of [0, 8, 12, 15, 19, 23]) {
      expect([...labelsAt(hour)].sort()).toEqual(HOME_ACTION_LINKS.map((link) => link.label).sort());
    }
  });

  it('keeps the declared order for everything past the leaders', () => {
    expect(labelsAt(8)).toEqual(['Coffee near me', 'Fast delivery', 'Happy hours', 'Open late', 'Reserve tonight']);
  });
});
