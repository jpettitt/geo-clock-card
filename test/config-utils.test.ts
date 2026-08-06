import { describe, it, expect, vi } from 'vitest';
import {
  clamp,
  num,
  validateLocale,
  parseFrozenNow,
  sanitizeCssColor,
  sanitizeImageryBase,
} from '../src/config-utils.js';

const BUNDLE_URL = 'https://ha.example/hacsfiles/geo-clock-card/geo-clock-card.js';

describe('num', () => {
  it('passes finite numbers through', () => {
    expect(num(5, 1)).toBe(5);
    expect(num(0, 1)).toBe(0);
    expect(num(-3.5, 1)).toBe(-3.5);
  });

  it('coerces numeric strings (YAML often delivers them)', () => {
    expect(num('30', 1)).toBe(30);
    expect(num('1.5', 1)).toBe(1.5);
  });

  it('falls back on garbage — NaN must never reach clamp()', () => {
    expect(num('fast', 1)).toBe(1);
    expect(num(NaN, 2)).toBe(2);
    expect(num(Infinity, 3)).toBe(3);
    expect(num(undefined, 4)).toBe(4);
    expect(num(null, 5)).toBe(5);
    expect(num({}, 6)).toBe(6);
  });

  it('composes with clamp without NaN leaking', () => {
    // The exact failure that motivated it: updateInterval: "fast"
    // → NaN → setInterval(fn, NaN) → ~4ms render storm.
    expect(clamp(num('fast', 1), 1, 600)).toBe(1);
  });
});

describe('validateLocale', () => {
  it('accepts valid BCP-47 tags', () => {
    expect(validateLocale('fr-FR')).toBe('fr-FR');
    expect(validateLocale('ja')).toBe('ja');
    expect(validateLocale('en-GB')).toBe('en-GB');
  });

  it('rejects the classic POSIX-style typo instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateLocale('en_US')).toBeUndefined();
    expect(validateLocale('not a locale')).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('maps empty/undefined to undefined (browser default)', () => {
    expect(validateLocale(undefined)).toBeUndefined();
    expect(validateLocale('')).toBeUndefined();
  });
});

describe('parseFrozenNow', () => {
  it('parses ISO strings and Date instances', () => {
    expect(parseFrozenNow('2024-12-21T09:21:00Z')?.toISOString()).toBe(
      '2024-12-21T09:21:00.000Z',
    );
    const d = new Date(Date.UTC(2024, 5, 20));
    expect(parseFrozenNow(d)?.getTime()).toBe(d.getTime());
  });

  it('returns undefined for unset or unparseable input', () => {
    expect(parseFrozenNow(undefined)).toBeUndefined();
    expect(parseFrozenNow('not a date')).toBeUndefined();
  });
});

describe('sanitizeCssColor', () => {
  it('accepts hex, rgb[a], hsl[a], and named colors', () => {
    expect(sanitizeCssColor('#3da9fc')).toBe('#3da9fc');
    expect(sanitizeCssColor('#abcd')).toBe('#abcd');
    expect(sanitizeCssColor('rgba(255, 255, 255, 0.18)')).toBe(
      'rgba(255, 255, 255, 0.18)',
    );
    expect(sanitizeCssColor('hsl(120 50% 50% / 0.5)')).toBe(
      'hsl(120 50% 50% / 0.5)',
    );
    expect(sanitizeCssColor('rebeccapurple')).toBe('rebeccapurple');
  });

  it('rejects declaration-injection payloads', () => {
    expect(
      sanitizeCssColor('red; background: url(http://attacker.tld/x)'),
    ).toBeUndefined();
    expect(sanitizeCssColor('url(javascript:alert(1))')).toBeUndefined();
    expect(sanitizeCssColor('rgb(0,0,0); }')).toBeUndefined();
    expect(sanitizeCssColor('var(--geo-tz-line)')).toBeUndefined();
  });

  it('rejects non-strings and empty-ish values', () => {
    expect(sanitizeCssColor(undefined)).toBeUndefined();
    expect(sanitizeCssColor('')).toBeUndefined();
  });
});

describe('sanitizeImageryBase', () => {
  it('accepts https origins and resolves relative inputs against the bundle', () => {
    expect(sanitizeImageryBase('https://cdn.example/assets/', BUNDLE_URL)).toBe(
      'https://cdn.example/assets/',
    );
    // Relative bases resolve against the bundle URL — the same base
    // the validation ran against, so check and use can't disagree.
    expect(sanitizeImageryBase('/local/geo-assets/', BUNDLE_URL)).toBe(
      'https://ha.example/local/geo-assets/',
    );
    expect(sanitizeImageryBase('./imagery/', BUNDLE_URL)).toBe(
      'https://ha.example/hacsfiles/geo-clock-card/imagery/',
    );
  });

  it('rejects script-ish and cross-protocol bases', () => {
    expect(
      sanitizeImageryBase('javascript:alert(1)//', BUNDLE_URL),
    ).toBeUndefined();
    expect(sanitizeImageryBase('data:text/html,x', BUNDLE_URL)).toBeUndefined();
    expect(sanitizeImageryBase('ftp://host/', BUNDLE_URL)).toBeUndefined();
  });

  it('returns undefined for unset/empty input', () => {
    expect(sanitizeImageryBase(undefined, BUNDLE_URL)).toBeUndefined();
    expect(sanitizeImageryBase('', BUNDLE_URL)).toBeUndefined();
  });
});
