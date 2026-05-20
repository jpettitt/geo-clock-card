import { describe, it, expect } from 'vitest';
import {
  ianaToPolygons,
  cityFromTzid,
  zoneNow,
  findIanaZoneForLatLon,
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

describe('findIanaZoneForLatLon', () => {
  // Two non-overlapping rectangles: one over the eastern Pacific (NY-ish
  // longitudes are too cluttered to mock cleanly) and one over a chunk
  // of central Africa. The point-in-polygon test only cares that the
  // shapes don't overlap and that the input falls inside one of them.
  const data = fc([
    polygon(
      [
        [
          [-90, 25],
          [-70, 25],
          [-70, 45],
          [-90, 45],
          [-90, 25],
        ],
      ],
      'Test/Atlantic',
    ),
    polygon(
      [
        [
          [10, -10],
          [40, -10],
          [40, 10],
          [10, 10],
          [10, -10],
        ],
      ],
      'Test/Africa',
    ),
  ]);

  it('returns the tzid of the polygon containing the point', () => {
    expect(findIanaZoneForLatLon(data, 35, -80)).toBe('Test/Atlantic');
    expect(findIanaZoneForLatLon(data, 0, 25)).toBe('Test/Africa');
  });

  it('handles wrapped longitudes correctly', () => {
    expect(findIanaZoneForLatLon(data, 35, -80 + 360)).toBe('Test/Atlantic');
    expect(findIanaZoneForLatLon(data, 35, -80 - 360)).toBe('Test/Atlantic');
    expect(findIanaZoneForLatLon(data, 0, 25 + 720)).toBe('Test/Africa');
  });

  it('returns null when the point is outside every polygon', () => {
    expect(findIanaZoneForLatLon(data, 60, 60)).toBeNull();
    expect(findIanaZoneForLatLon(data, -50, -50)).toBeNull();
  });

  it('rejects non-finite lat/lon inputs without scanning the dataset', () => {
    expect(findIanaZoneForLatLon(data, NaN, 0)).toBeNull();
    expect(findIanaZoneForLatLon(data, 0, Infinity)).toBeNull();
    expect(
      findIanaZoneForLatLon(data, undefined as unknown as number, 0),
    ).toBeNull();
  });
});

describe('zoneNow', () => {
  // Pin tests to en-GB so the locale-default time format is 24-hour
  // and the date format is predictable across CI runners.
  const LOC = 'en-GB';

  it('returns DST-aware long name for America/New_York in summer', () => {
    // 2024-07-15 18:00 UTC = 14:00 EDT
    const r = zoneNow(new Date('2024-07-15T18:00:00Z'), 'America/New_York', LOC);
    expect(r.time).toBe('14:00:00');
    expect(r.name).toBe('Eastern Daylight Time');
    expect(r.offset).toBe('UTC-04:00');
    // Same calendar date as UTC since the offset only shifts hours.
    expect(r.date).toMatch(/Mon.*15.*Jul/);
  });

  it('returns standard time for America/New_York in winter', () => {
    // 2024-01-15 18:00 UTC = 13:00 EST
    const r = zoneNow(new Date('2024-01-15T18:00:00Z'), 'America/New_York', LOC);
    expect(r.time).toBe('13:00:00');
    expect(r.name).toBe('Eastern Standard Time');
    expect(r.offset).toBe('UTC-05:00');
  });

  it('returns AM/PM time format under en-US locale', () => {
    const r = zoneNow(new Date('2024-07-15T18:00:00Z'), 'America/New_York', 'en-US');
    // en-US default is 12-hour with AM/PM marker
    expect(r.time).toMatch(/2:00:00\s?PM/);
  });

  it('handles fractional offsets like India (UTC+05:30, no DST)', () => {
    const r = zoneNow(new Date('2024-07-15T12:00:00Z'), 'Asia/Kolkata', LOC);
    expect(r.time).toBe('17:30:00');
    expect(r.offset).toBe('UTC+05:30');
  });

  it('handles Australia (UTC+10:00 AEST in winter, +11:00 AEDT in summer)', () => {
    // Southern hemisphere — January is Aussie summer (DST in NSW, etc.)
    const summer = zoneNow(new Date('2024-01-15T00:00:00Z'), 'Australia/Sydney', LOC);
    expect(summer.offset).toBe('UTC+11:00');
    const winter = zoneNow(new Date('2024-07-15T00:00:00Z'), 'Australia/Sydney', LOC);
    expect(winter.offset).toBe('UTC+10:00');
  });

  it('returns a different `date` from UTC when the zone has rolled over', () => {
    // Sunday 2024-12-29 23:30 UTC; in Auckland (UTC+13 with DST) it's
    // already Monday 2024-12-30 12:30.
    const r = zoneNow(new Date('2024-12-29T23:30:00Z'), 'Pacific/Auckland', LOC);
    expect(r.date).toMatch(/Mon.*30.*Dec/);
  });
});
