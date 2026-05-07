import { describe, it, expect } from 'vitest';
import {
  ianaToPolygons,
  cityFromTzid,
  zoneNow,
} from '../src/timezones-iana.js';

const W = 360;
const H = 180;

const fc = (features: any[]) =>
  ({ type: 'FeatureCollection', features }) as any;

const polygon = (coords: number[][][], tzid: string) => ({
  type: 'Feature',
  properties: { tzid },
  geometry: { type: 'Polygon', coordinates: coords },
});

describe('cityFromTzid', () => {
  it('extracts the city after the slash', () => {
    expect(cityFromTzid('America/New_York')).toBe('New York');
    expect(cityFromTzid('Europe/London')).toBe('London');
    expect(cityFromTzid('Asia/Kolkata')).toBe('Kolkata');
  });

  it('handles three-segment tzids', () => {
    expect(cityFromTzid('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
  });

  it('replaces underscores with spaces', () => {
    expect(cityFromTzid('Pacific/Pago_Pago')).toBe('Pago Pago');
  });

  it('falls back to the raw value when there is no slash', () => {
    expect(cityFromTzid('UTC')).toBe('UTC');
  });
});

describe('ianaToPolygons', () => {
  it('emits one entry per feature with tzid + cityLabel + d', () => {
    const data = fc([
      polygon([[[10, 0], [20, 0], [20, 10], [10, 10], [10, 0]]], 'America/New_York'),
    ]);
    const out = ianaToPolygons(data, W, H);
    expect(out.length).toBe(1);
    expect(out[0].tzid).toBe('America/New_York');
    expect(out[0].cityLabel).toBe('New York');
    expect(out[0].d.startsWith('M')).toBe(true);
    expect(out[0].d.endsWith('Z')).toBe(true);
  });
});

describe('zoneNow', () => {
  it('returns DST-aware long name for America/New_York in summer', () => {
    // 2024-07-15 18:00 UTC = 14:00 EDT
    const r = zoneNow(new Date('2024-07-15T18:00:00Z'), 'America/New_York');
    expect(r.time).toBe('14:00:00');
    expect(r.name).toBe('Eastern Daylight Time');
    expect(r.offset).toBe('UTC-04:00');
  });

  it('returns standard time for America/New_York in winter', () => {
    // 2024-01-15 18:00 UTC = 13:00 EST
    const r = zoneNow(new Date('2024-01-15T18:00:00Z'), 'America/New_York');
    expect(r.time).toBe('13:00:00');
    expect(r.name).toBe('Eastern Standard Time');
    expect(r.offset).toBe('UTC-05:00');
  });

  it('handles fractional offsets like India (UTC+05:30, no DST)', () => {
    const r = zoneNow(new Date('2024-07-15T12:00:00Z'), 'Asia/Kolkata');
    expect(r.time).toBe('17:30:00');
    expect(r.offset).toBe('UTC+05:30');
  });

  it('handles Australia (UTC+10:00 AEST in winter, +11:00 AEDT in summer)', () => {
    // Southern hemisphere — January is Aussie summer (DST in NSW, etc.)
    const summer = zoneNow(new Date('2024-01-15T00:00:00Z'), 'Australia/Sydney');
    expect(summer.offset).toBe('UTC+11:00');
    const winter = zoneNow(new Date('2024-07-15T00:00:00Z'), 'Australia/Sydney');
    expect(winter.offset).toBe('UTC+10:00');
  });
});
