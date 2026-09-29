import { recentAskDayLabel } from '@/lib/recent-asks';

describe('recentAskDayLabel', () => {
  const now = new Date('2026-08-14T19:00:00Z').getTime();

  it('labels the same calendar day as Today', () => {
    expect(recentAskDayLabel(new Date('2026-08-14T02:00:00Z').getTime(), now)).toBe('Today');
  });

  it('labels the previous day as Yesterday', () => {
    expect(recentAskDayLabel(new Date('2026-08-13T23:00:00Z').getTime(), now)).toBe('Yesterday');
  });

  it('uses a weekday inside the last week', () => {
    // 2026-08-11 is a Tuesday.
    expect(recentAskDayLabel(new Date('2026-08-11T19:00:00Z').getTime(), now)).toBe('Tue');
  });

  it('falls back to a date beyond a week', () => {
    expect(recentAskDayLabel(new Date('2026-08-01T19:00:00Z').getTime(), now)).toBe('Aug 1');
  });
});
