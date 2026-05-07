import { describe, it, expect } from 'vitest';
import { timezonesToPolygons } from '../src/timezones.js';

const W = 360;
const H = 180;

const featureCollection = (features: any[]) =>
  ({ type: 'FeatureCollection', features }) as any;

const polygon = (coords: number[][][], props: any) => ({
  type: 'Feature',
  properties: props,
  geometry: { type: 'Polygon', coordinates: coords },
});

const multiPolygon = (coords: number[][][][], props: any) => ({
  type: 'Feature',
  properties: props,
  geometry: { type: 'MultiPolygon', coordinates: coords },
});

describe('timezonesToPolygons', () => {
  it('emits one entry per feature with offset/offsetLabel/name/places/d', () => {
    const data = featureCollection([
      polygon(
        [[[10, 0], [20, 0], [20, 10], [10, 10], [10, 0]]],
        { zone: 1, time_zone: 'UTC+01:00', name: 'Central European Time', places: 'Test' },
      ),
    ]);
    const out = timezonesToPolygons(data, W, H);
    expect(out.length).toBe(1);
    expect(out[0]).toMatchObject({
      offset: 1,
      offsetLabel: 'UTC+01:00',
      name: 'Central European Time',
      places: 'Test',
    });
    expect(out[0].d.startsWith('M')).toBe(true);
    expect(out[0].d.endsWith('Z')).toBe(true);
  });

  it('sets name to null when no canonical name was supplied', () => {
    const data = featureCollection([
      polygon([[[0, 0], [1, 0], [1, 1], [0, 0]]], { zone: 0 }),
    ]);
    expect(timezonesToPolygons(data, W, H)[0].name).toBeNull();
  });

  it('uses raw time_zone label when present', () => {
    const data = featureCollection([
      polygon(
        [[[0, 0], [1, 0], [1, 1], [0, 0]]],
        { zone: 5.5, time_zone: 'UTC+05:30', places: 'India' },
      ),
    ]);
    expect(timezonesToPolygons(data, W, H)[0].offsetLabel).toBe('UTC+05:30');
  });

  it('synthesizes "UTC±HH:MM" when time_zone is missing', () => {
    const data = featureCollection([
      polygon([[[0, 0], [1, 0], [1, 1], [0, 0]]], { zone: -7 }),
    ]);
    expect(timezonesToPolygons(data, W, H)[0].offsetLabel).toBe('UTC-07:00');
  });

  it('synthesizes a fractional offset correctly', () => {
    const data = featureCollection([
      polygon([[[0, 0], [1, 0], [1, 1], [0, 0]]], { zone: -9.5 }),
    ]);
    expect(timezonesToPolygons(data, W, H)[0].offsetLabel).toBe('UTC-09:30');
  });

  it('truncates very long places lists to ≤ 80 chars', () => {
    const longPlaces = 'a'.repeat(200);
    const data = featureCollection([
      polygon(
        [[[0, 0], [1, 0], [1, 1], [0, 0]]],
        { zone: 0, time_zone: 'UTC+00:00', places: longPlaces },
      ),
    ]);
    const places = timezonesToPolygons(data, W, H)[0].places;
    expect(places.length).toBeLessThanOrEqual(80);
    expect(places.endsWith('…')).toBe(true);
  });

  it('handles MultiPolygon by concatenating sub-paths', () => {
    const data = featureCollection([
      multiPolygon(
        [
          [[[0, 0], [1, 0], [1, 1], [0, 0]]],
          [[[10, 10], [20, 10], [20, 20], [10, 10]]],
        ],
        { zone: 0, time_zone: 'UTC+00:00', places: 'Multi' },
      ),
    ]);
    const out = timezonesToPolygons(data, W, H);
    expect(out.length).toBe(1);
    expect((out[0].d.match(/M/g) ?? []).length).toBe(2);
    expect((out[0].d.match(/Z/g) ?? []).length).toBe(2);
  });

  it('splits a ring at the Greenwich seam (default centerLon=180)', () => {
    const data = featureCollection([
      polygon(
        [[[-10, 0], [10, 0], [10, 10], [-10, 10], [-10, 0]]],
        { zone: 0, time_zone: 'UTC+00:00', places: 'Crosses Greenwich' },
      ),
    ]);
    const out = timezonesToPolygons(data, W, H);
    expect(out.length).toBe(1);
    expect((out[0].d.match(/M/g) ?? []).length).toBeGreaterThan(1);
  });

  it('skips degenerate rings with fewer than 3 vertices', () => {
    const data = featureCollection([
      polygon([[[0, 0], [1, 1]]], { zone: 0, time_zone: 'UTC+00:00' }),
    ]);
    expect(timezonesToPolygons(data, W, H).length).toBe(0);
  });
});
