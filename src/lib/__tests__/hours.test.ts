import { openStateFor, openStateLabel, parseOpeningHours, weekSchedule } from '@/lib/hours';

/** Local-time Date — hours are evaluated against the device clock, same as dayparts. */
function at(weekday: number, hour: number, minute = 0): Date {
  // 2026-07-26 is a Sunday, so adding `weekday` lands on that day of the week.
  return new Date(2026, 6, 26 + weekday, hour, minute, 0);
}

describe('parseOpeningHours', () => {
  it('reads the plain forms', () => {
    expect(parseOpeningHours('24/7')).toEqual([{ days: [0, 1, 2, 3, 4, 5, 6], intervals: [{ start: 0, end: 1440 }] }]);
    expect(parseOpeningHours('Mo-Fr 11:00-22:00')).toEqual([
      { days: [1, 2, 3, 4, 5], intervals: [{ start: 660, end: 1320 }] },
    ]);
    expect(parseOpeningHours('11:00-22:00')).toEqual([
      { days: [0, 1, 2, 3, 4, 5, 6], intervals: [{ start: 660, end: 1320 }] },
    ]);
  });

  it('reads split service and explicit closures', () => {
    expect(parseOpeningHours('Mo-Fr 11:00-14:00,17:00-22:00; Su off')).toEqual([
      { days: [1, 2, 3, 4, 5], intervals: [{ start: 660, end: 840 }, { start: 1020, end: 1320 }] },
      { days: [0], intervals: [] },
    ]);
  });

  it('carries an after-midnight close past 1440 rather than wrapping it to a shorter day', () => {
    expect(parseOpeningHours('Fr-Sa 18:00-02:00')).toEqual([
      { days: [5, 6], intervals: [{ start: 1080, end: 1560 }] },
    ]);
  });

  it('refuses syntax it cannot model instead of half-reading it', () => {
    for (const spec of [
      'Mo-Su sunrise-sunset',
      'Apr-Sep 10:00-18:00',
      'Mo[1] 10:00-12:00',
      'Mo-Fr 10:00-18:00 "by appointment"',
      'week 1-53 10:00-12:00',
      'Mo-Fr 10:00',
      'Xx-Fr 10:00-12:00',
      '',
      null,
    ]) {
      expect(parseOpeningHours(spec)).toBeNull();
    }
  });

  it('skips holiday rules rather than discarding an otherwise readable spec', () => {
    expect(parseOpeningHours('Mo-Su 08:00-20:00; PH off')).toEqual([
      { days: [1, 2, 3, 4, 5, 6, 0], intervals: [{ start: 480, end: 1200 }] },
    ]);
  });
});

describe('openStateFor', () => {
  it('reports open with the real closing time', () => {
    expect(openStateFor('Mo-Fr 11:00-22:00', at(1, 19))).toEqual({ status: 'open', closesAt: '10 PM', closesInMinutes: 180 });
    expect(openStateFor('Mo-Fr 11:00-21:30', at(1, 19))).toEqual({ status: 'open', closesAt: '9:30 PM', closesInMinutes: 150 });
  });

  it('names no closing time for a 24-hour spot', () => {
    expect(openStateFor('24/7', at(3, 4))).toEqual({ status: 'open', closesAt: null, closesInMinutes: null });
  });

  it('stays open after midnight on the previous day rule', () => {
    // Saturday 01:00 is still inside Friday's 18:00-02:00 block.
    expect(openStateFor('Fr-Sa 18:00-02:00', at(6, 1))).toEqual({ status: 'open', closesAt: '2 AM', closesInMinutes: 60 });
  });

  it('closes between split services and names the next opening', () => {
    expect(openStateFor('Mo-Fr 11:00-14:00,17:00-22:00', at(2, 15, 30))).toEqual({
      status: 'closed',
      opensAt: '5 PM',
    });
  });

  it('carries the weekday when the next opening is not today', () => {
    // Sunday, closed; the Monday rule is the next one that applies.
    expect(openStateFor('Mo-Fr 09:00-17:00; Su off', at(0, 12))).toEqual({ status: 'closed', opensAt: 'Mon 9 AM' });
  });

  it('is unknown, never closed, when the hours cannot be read', () => {
    expect(openStateFor('Mo-Su sunrise-sunset', at(1, 12))).toEqual({ status: 'unknown' });
    expect(openStateFor(null, at(1, 12))).toEqual({ status: 'unknown' });
  });
});

describe('weekSchedule', () => {
  it('returns the week Monday-first, with explicit closures kept', () => {
    expect(weekSchedule('Mo-Fr 09:00-17:00; Su off')).toEqual([
      { day: 1, intervals: [{ start: 540, end: 1020 }] },
      { day: 2, intervals: [{ start: 540, end: 1020 }] },
      { day: 3, intervals: [{ start: 540, end: 1020 }] },
      { day: 4, intervals: [{ start: 540, end: 1020 }] },
      { day: 5, intervals: [{ start: 540, end: 1020 }] },
      { day: 0, intervals: [] },
    ]);
  });

  it('omits days no rule covers rather than calling them closed', () => {
    expect(weekSchedule('Sa 10:00-14:00')).toEqual([{ day: 6, intervals: [{ start: 600, end: 840 }] }]);
  });

  it('applies the later rule when two cover the same day', () => {
    expect(weekSchedule('Mo-Su 09:00-17:00; Mo 12:00-15:00')?.find((entry) => entry.day === 1)).toEqual({
      day: 1,
      intervals: [{ start: 720, end: 900 }],
    });
  });

  it('is null when the spec cannot be read', () => {
    expect(weekSchedule('Mo-Su sunrise-sunset')).toBeNull();
    expect(weekSchedule(null)).toBeNull();
  });
});

describe('openStateLabel', () => {
  it('omits a line entirely when hours are unknown', () => {
    expect(openStateLabel({ status: 'unknown' })).toBeNull();
    expect(openStateLabel({ status: 'open', closesAt: '10 PM', closesInMinutes: 180 })).toBe('Open now · till 10 PM');
    expect(openStateLabel({ status: 'open', closesAt: null, closesInMinutes: null })).toBe('Open now · 24 hours');
    expect(openStateLabel({ status: 'closed', opensAt: 'Mon 9 AM' })).toBe('Closed · opens Mon 9 AM');
    expect(openStateLabel({ status: 'closed', opensAt: null })).toBe('Closed');
  });
});

describe('closesInMinutes', () => {
  const at = (day: number, hour: number, minute = 0) => new Date(2026, 6, 26 + day, hour, minute);

  it('counts down to the closing time it names', () => {
    const state = openStateFor('Mo-Fr 11:00-22:00', at(1, 21, 30));
    expect(state).toEqual({ status: 'open', closesAt: '10 PM', closesInMinutes: 30 });
  });

  it('carries past midnight without going negative', () => {
    // Friday 18:00-02:00, read at 1 AM Saturday — still Friday's interval.
    const state = openStateFor('Fr-Sa 18:00-02:00', at(6, 1));
    expect(state.status).toBe('open');
    expect(state.status === 'open' && state.closesInMinutes).toBe(60);
  });

  it('is null for a round-the-clock spot, which is never about to close', () => {
    const state = openStateFor('24/7', at(3, 4));
    expect(state).toEqual({ status: 'open', closesAt: null, closesInMinutes: null });
  });

  it('agrees with the label it ships alongside', () => {
    // 11:00-22:00 read at 19:00 → "10 PM" and 180 minutes are the same moment.
    const state = openStateFor('Mo-Fr 11:00-22:00', at(1, 19));
    expect(state.status === 'open' && state.closesAt).toBe('10 PM');
    expect(state.status === 'open' && state.closesInMinutes).toBe(180);
  });
});
