import { describe, it, expect } from 'vitest';
import { subsolarPoint, sunElevation } from '../src/sun.js';

// Tolerances reflect the ~0.01° accuracy of the low-precision formulas;
// we test to a looser ~0.3° because the well-known reference values for
// equinox/solstice fall on calendar days that aren't perfectly tied to
// the J2000 epoch in this approximation.
const LAT_TOL = 0.5;
const ELEV_TOL = 1.0;

describe('subsolarPoint', () => {
  it('places the sun on the equator at the March equinox (within tolerance)', () => {
    // 2024 vernal equinox: 2024-03-20 03:06 UTC
    const sub = subsolarPoint(new Date('2024-03-20T03:06:00Z'));
    expect(Math.abs(sub.lat)).toBeLessThan(LAT_TOL);
  });

  it('places the sun near the Tropic of Cancer at the June solstice', () => {
    // 2024 June solstice: 2024-06-20 20:51 UTC
    const sub = subsolarPoint(new Date('2024-06-20T20:51:00Z'));
    expect(sub.lat).toBeGreaterThan(23.0);
    expect(sub.lat).toBeLessThan(23.5);
  });

  it('places the sun near the Tropic of Capricorn at the December solstice', () => {
    // 2024 December solstice: 2024-12-21 09:21 UTC
    const sub = subsolarPoint(new Date('2024-12-21T09:21:00Z'));
    expect(sub.lat).toBeLessThan(-23.0);
    expect(sub.lat).toBeGreaterThan(-23.5);
  });

  it('places the sun near 0° longitude at solar noon at Greenwich', () => {
    // Choose a date near an equinox so equation of time is small (~7 min).
    // 2024-03-20 12:00 UTC — sun should be a few degrees west of 0
    // (positive EoT → subsolar lon slightly negative).
    const sub = subsolarPoint(new Date('2024-03-20T12:00:00Z'));
    expect(Math.abs(sub.lon)).toBeLessThan(3);
  });

  it('moves subsolar longitude by ~15° per hour westward', () => {
    const t0 = new Date('2024-06-21T12:00:00Z');
    const t1 = new Date('2024-06-21T13:00:00Z');
    const lon0 = subsolarPoint(t0).lon;
    const lon1 = subsolarPoint(t1).lon;
    const delta = lon0 - lon1; // should be ~+15
    expect(delta).toBeGreaterThan(14.9);
    expect(delta).toBeLessThan(15.1);
  });

  it('returns longitude in [-180, 180]', () => {
    for (let h = 0; h < 24; h++) {
      const sub = subsolarPoint(new Date(Date.UTC(2024, 5, 21, h, 0, 0)));
      expect(sub.lon).toBeGreaterThanOrEqual(-180);
      expect(sub.lon).toBeLessThanOrEqual(180);
    }
  });
});

describe('sunElevation', () => {
  it('is +90° at the subsolar point itself', () => {
    const sub = subsolarPoint(new Date('2024-06-21T12:00:00Z'));
    expect(sunElevation(sub.lat, sub.lon, sub)).toBeCloseTo(90, 4);
  });

  it('is -90° at the antipode of the subsolar point', () => {
    const sub = subsolarPoint(new Date('2024-06-21T12:00:00Z'));
    const antipodeLon = sub.lon > 0 ? sub.lon - 180 : sub.lon + 180;
    expect(sunElevation(-sub.lat, antipodeLon, sub)).toBeCloseTo(-90, 4);
  });

  it('is ~0° on the terminator great circle', () => {
    // 90° away from subsolar on the equator (when sub.lat ≈ 0)
    const sub = subsolarPoint(new Date('2024-03-20T03:06:00Z'));
    const lon = sub.lon + 90;
    expect(Math.abs(sunElevation(0, lon, sub))).toBeLessThan(ELEV_TOL);
  });
});
