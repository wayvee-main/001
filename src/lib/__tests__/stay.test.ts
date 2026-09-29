import { addDaysIso, currentNightIso, isStayActive, nightsBetween, parseUsDate, stayArcPosition, stayProgress, todayIso } from '@/lib/stay';

describe('parseUsDate', () => {
  it('parses a valid MM/DD/YYYY date to ISO', () => {
    expect(parseUsDate('07/23/2026')).toBe('2026-07-23');
  });

  it('pads single-digit month/day', () => {
    expect(parseUsDate('7/3/2026')).toBe('2026-07-03');
  });

  it('rejects malformed input', () => {
    expect(parseUsDate('not a date')).toBeNull();
    expect(parseUsDate('2026-07-23')).toBeNull();
    expect(parseUsDate('')).toBeNull();
  });

  it('rejects calendar-invalid dates (e.g. Feb 30) instead of silently rolling over', () => {
    expect(parseUsDate('02/30/2026')).toBeNull();
    expect(parseUsDate('13/01/2026')).toBeNull();
  });
});

describe('stayProgress', () => {
  const stay = { propertyName: 'Test Hotel', checkIn: '2026-07-20', checkOut: '2026-07-25' };

  it('computes total nights from check-in/out', () => {
    expect(stayProgress(stay, new Date(2026, 6, 20)).totalNights).toBe(5);
  });

  it('reports night 1 on check-in day', () => {
    expect(stayProgress(stay, new Date(2026, 6, 20)).currentNight).toBe(1);
  });

  it('advances currentNight as days pass', () => {
    expect(stayProgress(stay, new Date(2026, 6, 22)).currentNight).toBe(3);
  });

  it('clamps currentNight at totalNights instead of going past checkout', () => {
    const progress = stayProgress(stay, new Date(2026, 6, 30));
    expect(progress.currentNight).toBe(5);
    expect(progress.nightsLeft).toBe(1);
  });
});

describe('addDaysIso', () => {
  it('advances by whole days', () => {
    expect(addDaysIso('2026-07-20', 1)).toBe('2026-07-21');
  });

  it('rolls over month and year boundaries', () => {
    expect(addDaysIso('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles leap day', () => {
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('nightsBetween', () => {
  it('counts nights across the range', () => {
    expect(nightsBetween('2026-07-20', '2026-07-25')).toBe(5);
  });

  it('reports zero for a same-day or inverted range instead of clamping to one', () => {
    expect(nightsBetween('2026-07-20', '2026-07-20')).toBe(0);
    expect(nightsBetween('2026-07-25', '2026-07-20')).toBe(0);
  });

  it('is unaffected by a DST shift inside the range', () => {
    // US DST ends 2026-11-01 — a naive ms/86400000 divide would give 5.04 here.
    expect(nightsBetween('2026-10-30', '2026-11-04')).toBe(5);
  });
});

describe('stayArcPosition', () => {
  // 5 nights: 20 (arrival), 21/22 (middle), 23 (climax — the night before
  // checkout), 24 (departure — checkout is the 25th, so 24 is the last night).
  const stay = { propertyName: 'Test Hotel', checkIn: '2026-07-20', checkOut: '2026-07-25' };

  it('marks check-in night as arrival', () => {
    expect(stayArcPosition(stay, '2026-07-20')).toBe('arrival');
  });

  it('marks the middle nights as middle', () => {
    expect(stayArcPosition(stay, '2026-07-21')).toBe('middle');
    expect(stayArcPosition(stay, '2026-07-22')).toBe('middle');
  });

  it('marks the night before checkout as climax', () => {
    expect(stayArcPosition(stay, '2026-07-23')).toBe('climax');
  });

  it('marks the last night as departure', () => {
    expect(stayArcPosition(stay, '2026-07-24')).toBe('departure');
  });

  it('a single-night stay has no arc — reads as middle', () => {
    const oneNight = { propertyName: 'Test Hotel', checkIn: '2026-07-20', checkOut: '2026-07-21' };
    expect(stayArcPosition(oneNight, '2026-07-20')).toBe('middle');
  });

  it('a date outside the stay reads as middle rather than throwing', () => {
    expect(stayArcPosition(stay, '2026-08-01')).toBe('middle');
  });
});

describe('isStayActive', () => {
  const stay = { propertyName: 'Test Hotel', checkIn: '2026-07-20', checkOut: '2026-07-25' };

  it('is active before and on checkout day', () => {
    expect(isStayActive(stay, new Date(2026, 6, 25))).toBe(true);
  });

  it('is inactive the day after checkout', () => {
    expect(isStayActive(stay, new Date(2026, 6, 26))).toBe(false);
  });
});

describe('currentNightIso', () => {
  const stay = { propertyName: 'Test Hotel', checkIn: '2026-07-20', checkOut: '2026-07-25' };

  it('is today when there is no stay', () => {
    const now = new Date(2026, 6, 22);
    expect(currentNightIso(null, now)).toBe(todayIso(now));
  });

  it('is the first night of a stay that has not started yet', () => {
    // isStayActive only asks whether checkout has passed, so a booked-but-not-
    // begun trip is planned from its opening night rather than from today.
    expect(currentNightIso(stay, new Date(2026, 6, 1))).toBe('2026-07-20');
  });

  it('is today once the stay has ended', () => {
    const after = new Date(2026, 7, 30);
    expect(currentNightIso(stay, after)).toBe(todayIso(after));
  });

  it('is the stay night the guest is currently on', () => {
    expect(currentNightIso(stay, new Date(2026, 6, 20))).toBe('2026-07-20');
    expect(currentNightIso(stay, new Date(2026, 6, 22))).toBe('2026-07-22');
  });

  it('clamps to the last night rather than running past checkout', () => {
    expect(currentNightIso(stay, new Date(2026, 6, 24))).toBe('2026-07-24');
  });
});
