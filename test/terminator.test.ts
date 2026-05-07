import { describe, it, expect } from 'vitest';
import { terminatorPolygon } from '../src/terminator.js';
import { sunElevation, type SubsolarPoint } from '../src/sun.js';

describe('terminatorPolygon (antimeridian-centered, eastward lons)', () => {
  it('every sampled vertex sits on the terminator (sun elevation ≈ 0)', () => {
    const sub: SubsolarPoint = { lat: 23.4, lon: 0 };
    const poly = terminatorPolygon(sub);
    // Last two points are the closing pole vertices — skip them.
    const curveVerts = poly.slice(0, poly.length - 2);
    for (const [lonE, lat] of curveVerts) {
      // sunElevation accepts any longitude (cos is periodic); pass lonE
      // unchanged.
      const elev = sunElevation(lat, lonE, sub);
      expect(Math.abs(elev)).toBeLessThan(0.01);
    }
  });

  it('polygon walks lonE monotonically from 0 to 360 (no seam crossing)', () => {
    const poly = terminatorPolygon({ lat: 23.4, lon: 0 });
    const curve = poly.slice(0, poly.length - 2);
    expect(curve[0][0]).toBe(0);
    expect(curve[curve.length - 1][0]).toBe(360);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i][0]).toBeGreaterThan(curve[i - 1][0]);
    }
  });

  it('closes around the south pole at northern declination', () => {
    const poly = terminatorPolygon({ lat: 23.4, lon: 0 });
    const last2 = poly.slice(-2);
    expect(last2[0]).toEqual([360, -90]);
    expect(last2[1]).toEqual([0, -90]);
  });

  it('closes around the north pole at southern declination', () => {
    const poly = terminatorPolygon({ lat: -23.4, lon: 0 });
    const last2 = poly.slice(-2);
    expect(last2[0]).toEqual([360, 90]);
    expect(last2[1]).toEqual([0, 90]);
  });

  it('terminator dips to ±(90-|δ|) at the subsolar/antisolar meridians', () => {
    const decl = 23.4;
    const sub: SubsolarPoint = { lat: decl, lon: 0 };
    const poly = terminatorPolygon(sub);
    // Subsolar at lon=0 → eastward lonE=0 (left edge) AND lonE=360 (right edge).
    // Antisolar at lon=±180 → lonE=180 (center).
    const atLeft = poly.find(([lonE]) => lonE === 0)!;
    const atRight = poly.find(([lonE]) => lonE === 360)!;
    const atCenter = poly.find(([lonE]) => lonE === 180)!;
    expect(atLeft[1]).toBeCloseTo(-(90 - decl), 1);
    expect(atRight[1]).toBeCloseTo(-(90 - decl), 1);
    expect(atCenter[1]).toBeCloseTo(90 - decl, 1);
  });

  it('terminator crosses the equator 90° from the subsolar point', () => {
    const sub: SubsolarPoint = { lat: 10, lon: 30 };
    const poly = terminatorPolygon(sub);
    // Subsolar at lon=+30 → lonE=30. ±90° from that is lonE=120 and lonE=300
    // (where lonE=300 corresponds to lon=-60).
    const at120 = poly.find(([lonE]) => lonE === 120)!;
    const at300 = poly.find(([lonE]) => lonE === 300)!;
    expect(at120[1]).toBeCloseTo(0, 4);
    expect(at300[1]).toBeCloseTo(0, 4);
  });

  it('handles near-equinox declination without NaN', () => {
    const poly = terminatorPolygon({ lat: 0, lon: 0 });
    for (const [lonE, lat] of poly) {
      expect(Number.isFinite(lonE)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
    }
  });

  it('respects custom step size', () => {
    const poly = terminatorPolygon({ lat: 23, lon: 0 }, { stepDeg: 2 });
    // 360°/2° + 1 endpoint = 181 curve vertices, +2 closing = 183.
    expect(poly.length).toBe(181 + 2);
  });

  it('honors a custom centerLon — terminator vertex at center should match real subsolar geometry', () => {
    // With centerLon = sub.lon, the canvas center (lonE=180) corresponds
    // to lon = sub.lon + 0 (the subsolar meridian). Wait — leftEdge =
    // centerLon - 180 = sub.lon - 180, so lonE=180 → realLon = sub.lon.
    // At the subsolar meridian the terminator latitude is ±(90-|δ|) on
    // the dark-pole side. For sub.lat=+23, that's -67°.
    const sub = { lat: 23.4, lon: -119 };
    const poly = terminatorPolygon(sub, { centerLon: -119 });
    const atCenter = poly.find(([lonE]) => lonE === 180)!;
    expect(atCenter[1]).toBeCloseTo(-(90 - 23.4), 1);
  });

  it('with centerLon=sub.lon, terminator is symmetric around lonE=180', () => {
    // Symmetry: lat at lonE=k matches lat at lonE=360-k (mirror across center).
    const sub = { lat: 10, lon: 30 };
    const poly = terminatorPolygon(sub, { centerLon: 30 });
    const at90 = poly.find(([lonE]) => lonE === 90)![1];
    const at270 = poly.find(([lonE]) => lonE === 270)![1];
    expect(at90).toBeCloseTo(at270, 4);
  });
});
