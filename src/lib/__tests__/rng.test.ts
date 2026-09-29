import { hashString, mulberry32 } from '@/lib/rng';

describe('hashString', () => {
  it('is deterministic for the same input', () => {
    expect(hashString('dinner and a show')).toBe(hashString('dinner and a show'));
  });

  it('differs for different inputs', () => {
    expect(hashString('dinner and a show')).not.toBe(hashString('dinner and a movie'));
  });

  it('is sensitive to input order, not just content', () => {
    expect(hashString('ab')).not.toBe(hashString('ba'));
  });

  it('always returns a non-negative 32-bit integer', () => {
    for (const input of ['', 'a', 'a very long sentence about Downtown Oakland tonight', '🎉']) {
      const hash = hashString(input);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('mulberry32', () => {
  it('produces the same sequence for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('produces a different sequence for a different seed', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('stays within [0, 1)', () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 200; i += 1) {
      const value = rand();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('does not repeat the same value on every draw from one generator', () => {
    const rand = mulberry32(99);
    const values = new Set(Array.from({ length: 20 }, () => rand()));
    expect(values.size).toBeGreaterThan(1);
  });
});
