import { CARD_DESCRIPTION_LIMIT, compactCardText, metadataParts, numericDistanceLabel, shortCardTitle } from '@/lib/card-presentation';

it('limits long card copy to 80 characters, ending at a word boundary', () => {
  const source = 'California Golden Bears take on their next opponent with a full evening of college football, food and entertainment.';
  const result = compactCardText(source);
  expect(Array.from(result).length).toBeLessThanOrEqual(CARD_DESCRIPTION_LIMIT);
  expect(result.endsWith('…')).toBe(true);
  expect(source.startsWith(result.slice(0, -1))).toBe(true);
  expect(compactCardText('A short snapshot.')).toBe('A short snapshot.');
});

it('keeps long event names to five words and 40 characters without a dangling vs', () => {
  const result = shortCardTitle('California Golden Bears Football vs Stanford Cardinal Football');
  expect(result).toBe('California Golden Bears Football…');
  expect(result.split(/\s+/).length).toBeLessThanOrEqual(5);
  expect(Array.from(result).length).toBeLessThanOrEqual(40);
});

it.each(['<0.1 mi', 'less than 0.1 mi', 'more than 2 miles', '≥ 3 km'])('removes a cached distance qualifier: %s', source => {
  expect(numericDistanceLabel(source)).not.toMatch(/less than|more than|[<>≤≥]/i);
  expect(numericDistanceLabel(source)).toMatch(/^\d/);
});

it('keeps prices and measurement provenance intact while splitting metadata', () => {
  expect(numericDistanceLabel('More than $20')).toBe('More than $20');
  expect(numericDistanceLabel('Estimated 2.0 mi')).toBe('Estimated 2.0 mi');
  expect(metadataParts('Café · <0.1 mi')).toEqual(['Café', '0.1 mi']);
});
