import { countdownLabel, currentDaypart, daypartGreeting, eventsLeadNow, homeSuggestions } from '@/lib/daypart';

/** Local-time Date for a given hour/minute today — dayparts are guest-local. */
function at(hour: number, minute = 0): Date {
  return new Date(2026, 6, 25, hour, minute, 0);
}

describe('currentDaypart', () => {
  it('splits the day at the boundaries the catalog is written around', () => {
    expect(currentDaypart(at(2))).toBe('lateNight');
    expect(currentDaypart(at(5))).toBe('morning');
    expect(currentDaypart(at(10, 59))).toBe('morning');
    expect(currentDaypart(at(11))).toBe('midday');
    expect(currentDaypart(at(14))).toBe('afternoon');
    expect(currentDaypart(at(17))).toBe('evening');
    expect(currentDaypart(at(22, 59))).toBe('evening');
    expect(currentDaypart(at(23))).toBe('lateNight');
  });
});

describe('daypartGreeting', () => {
  it('greets by the hour', () => {
    expect(daypartGreeting(at(1))).toBe('Good night');
    expect(daypartGreeting(at(8))).toBe('Good morning');
    expect(daypartGreeting(at(12))).toBe('Good afternoon');
    expect(daypartGreeting(at(15))).toBe('Good afternoon');
    expect(daypartGreeting(at(19))).toBe('Good evening');
  });
});

describe('eventsLeadNow', () => {
  it('puts the live calendar on top from the evening onward', () => {
    expect(eventsLeadNow(at(9))).toBe(false);
    expect(eventsLeadNow(at(13))).toBe(false);
    expect(eventsLeadNow(at(16, 59))).toBe(false);
    expect(eventsLeadNow(at(17))).toBe(true);
    expect(eventsLeadNow(at(23, 30))).toBe(true);
    expect(eventsLeadNow(at(1))).toBe(true);
  });
});

describe('homeSuggestions', () => {
  it('offers short discovery searches that follow the local daypart', () => {
    expect(homeSuggestions(at(8)).map((suggestion) => suggestion.label)).toEqual(['Coffee', 'Breakfast', 'Brunch', 'Bakeries']);
    expect(homeSuggestions(at(12)).map((suggestion) => suggestion.label)).toEqual(['Lunch', 'Coffee', 'Quick bites', 'Patios']);
    expect(homeSuggestions(at(15)).map((suggestion) => suggestion.label)).toEqual(['Coffee', 'Happy hour', 'Dinner', 'Live music']);
    expect(homeSuggestions(at(19)).map((suggestion) => suggestion.label)).toEqual(['Dinner', 'Live music', 'Cocktails', 'Late shows']);
    expect(homeSuggestions(at(23)).map((suggestion) => suggestion.label)).toEqual(['Late bites', 'Open late', 'Cocktails', 'Live music']);
  });

  it('routes each suggestion to a browsable result surface rather than Plans', () => {
    for (const hour of [2, 8, 12, 15, 19, 23]) {
      const suggestions = homeSuggestions(at(hour));
      expect(suggestions).toHaveLength(4);
      expect(new Set(suggestions.map((suggestion) => suggestion.label)).size).toBe(4);
      expect(suggestions.every((suggestion) => suggestion.query.trim().length > 0)).toBe(true);
      expect(suggestions.every((suggestion) => suggestion.glyph.trim().length > 0)).toBe(true);
      expect(suggestions.every((suggestion) => suggestion.destination === 'food' || suggestion.destination === 'discover')).toBe(true);
    }
  });
});

describe('countdownLabel', () => {
  const now = at(18);

  it('counts minutes, then hours', () => {
    expect(countdownLabel(at(18, 40).toISOString(), now)).toBe('in 40 min');
    expect(countdownLabel(at(20, 0).toISOString(), now)).toBe('in 2 hr');
    expect(countdownLabel(at(21, 10).toISOString(), now)).toBe('in 3 hr 10 min');
  });

  it('reads "starting now" through the first half hour past start', () => {
    expect(countdownLabel(at(18, 0).toISOString(), now)).toBe('starting now');
    expect(countdownLabel(at(17, 45).toISOString(), now)).toBe('starting now');
  });

  it('stays silent when there is nothing real to count', () => {
    expect(countdownLabel(undefined, now)).toBeNull();
    expect(countdownLabel('not a date', now)).toBeNull();
    expect(countdownLabel(at(16, 0).toISOString(), now)).toBeNull();
    expect(countdownLabel(new Date(2026, 6, 27, 20).toISOString(), now)).toBeNull();
  });
});
