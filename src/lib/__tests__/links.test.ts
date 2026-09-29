import { mapsDirectionsLink, siteLogoLink, streetAddress, uberRideLink } from '@/lib/links';

describe('streetAddress', () => {
  it('takes the segment before the first separator', () => {
    expect(streetAddress('510 Embarcadero W · ride 6 min · ~$9')).toBe('510 Embarcadero W');
  });

  it('returns the whole string when there is no separator', () => {
    expect(streetAddress('123 Main St')).toBe('123 Main St');
  });
});

describe('siteLogoLink', () => {
  it('returns the curated logo for a known domain', () => {
    expect(siteLogoLink('https://yoshis.com/shows')).toBe('https://yoshis.com/images/yoshi-logo.png');
  });

  it('strips a www. prefix before matching', () => {
    expect(siteLogoLink('https://www.thecookandherfarmer.com/menu')).toContain('thecookandherfarmer.com');
  });

  it('falls back to a favicon lookup for unknown domains', () => {
    expect(siteLogoLink('https://some-random-restaurant.example')).toBe(
      'https://www.google.com/s2/favicons?domain=some-random-restaurant.example&sz=256',
    );
  });

  it('falls back gracefully on an unparsable URL instead of throwing', () => {
    expect(() => siteLogoLink('not a url')).not.toThrow();
  });
});

describe('uberRideLink', () => {
  it('uses my_location pickup when no coordinates are given', () => {
    const link = uberRideLink('123 Main St');
    expect(link).toContain('pickup=my_location');
    expect(link).toContain('123+Main+St');
  });

  it('uses precise pickup coordinates when provided', () => {
    const link = uberRideLink('123 Main St', 'The Fox', { latitude: 37.8, longitude: -122.27, label: 'Here' });
    expect(link).toContain('pickup%5Blatitude%5D=37.8');
    expect(link).toContain('pickup%5Blongitude%5D=-122.27');
  });
});

describe('mapsDirectionsLink', () => {
  it('includes an origin when given', () => {
    const link = mapsDirectionsLink('The Fox Theater', { latitude: 37.8, longitude: -122.27 });
    expect(link).toContain('origin=37.8%2C-122.27');
  });

  it('omits origin when not given', () => {
    expect(mapsDirectionsLink('The Fox Theater')).not.toContain('origin=');
  });
});
