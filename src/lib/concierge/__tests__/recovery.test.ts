// Weather-triggered recovery (TODO.md Phase 3) — checkWeatherRecovery is the
// pure decision function _layout.tsx's effect calls on every weather
// refresh; this is where its logic actually gets tested, since the effect
// itself is just plumbing (schedule a reminder, mark it notified).
import { checkWeatherRecovery } from '@/lib/concierge/recovery';
import type { ScoperEvent } from '@/lib/data';
import type { WeatherHour } from '@/lib/weather';

const NOW = new Date('2026-08-01T20:00:00-07:00');

function event(overrides: Partial<ScoperEvent> & { id: string }): ScoperEvent {
  return {
    name: overrides.id,
    time: '8 PM',
    priceLabel: 'Free',
    travel: '',
    cats: [],
    date: '',
    venue: overrides.id,
    addr: '',
    lineup: '',
    know: '',
    priceFrom: 'Free',
    allIn: 'Free',
    ticketed: false,
    sourceUrl: '',
    verifiedLabel: '',
    image: '',
    startsAt: NOW.toISOString(),
    ...overrides,
  };
}

function hour(overrides: Partial<WeatherHour> = {}): WeatherHour {
  return {
    startsAt: new Date(NOW.getTime() - 30 * 60_000).toISOString(),
    endsAt: new Date(NOW.getTime() + 30 * 60_000).toISOString(),
    temperatureF: 62,
    shortForecast: 'Rain',
    precipProbability: 70,
    windLabel: null,
    isDaytime: false,
    ...overrides,
  };
}

describe('checkWeatherRecovery', () => {
  it('flags an outdoor plan when rain is at/above the threshold and offers the top-ranked indoor alternative', () => {
    const outdoor = event({ id: 'e-outdoor', cats: ['Outdoor'] });
    const indoor = event({ id: 'e-indoor', cats: [] });
    const alerts = checkWeatherRecovery(['e-outdoor'], [hour({ precipProbability: 70 })], NOW, [outdoor, indoor]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ eventId: 'e-outdoor', precipProbability: 70 });
    expect(alerts[0].alternative?.id).toBe('e-indoor');
  });

  it('offers null alternative when nothing indoor exists tonight, rather than skipping the alert', () => {
    const outdoor = event({ id: 'e-outdoor', cats: ['Outdoor'] });
    const alerts = checkWeatherRecovery(['e-outdoor'], [hour({ precipProbability: 80 })], NOW, [outdoor]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alternative).toBeNull();
  });

  it('does not flag an indoor event even under heavy rain', () => {
    const indoor = event({ id: 'e-indoor', cats: [] });
    expect(checkWeatherRecovery(['e-indoor'], [hour({ precipProbability: 90 })], NOW, [indoor])).toHaveLength(0);
  });

  it('does not flag an outdoor event below the rain threshold', () => {
    const outdoor = event({ id: 'e-outdoor', cats: ['Outdoor'] });
    expect(checkWeatherRecovery(['e-outdoor'], [hour({ precipProbability: 20 })], NOW, [outdoor])).toHaveLength(0);
  });

  it('does not flag when no forecast hour covers the event start', () => {
    const outdoor = event({ id: 'e-outdoor', cats: ['Outdoor'] });
    const farHour = hour({
      startsAt: new Date(NOW.getTime() + 6 * 3_600_000).toISOString(),
      endsAt: new Date(NOW.getTime() + 7 * 3_600_000).toISOString(),
    });
    expect(checkWeatherRecovery(['e-outdoor'], [farHour], NOW, [outdoor])).toHaveLength(0);
  });

  it('does not flag an event that is not tonight', () => {
    const tomorrow = event({ id: 'e-outdoor', cats: ['Outdoor'], startsAt: new Date(NOW.getTime() + 24 * 3_600_000).toISOString() });
    expect(checkWeatherRecovery(['e-outdoor'], [hour({ precipProbability: 90 })], NOW, [tomorrow])).toHaveLength(0);
  });

  it('ignores a planned id that is not in the event pool', () => {
    expect(checkWeatherRecovery(['ghost-id'], [hour({ precipProbability: 90 })], NOW, [])).toHaveLength(0);
  });

  it('returns no alerts for an empty plans list', () => {
    const outdoor = event({ id: 'e-outdoor', cats: ['Outdoor'] });
    expect(checkWeatherRecovery([], [hour({ precipProbability: 90 })], NOW, [outdoor])).toHaveLength(0);
  });
});
