import { describe, it, expect } from 'vitest';
import { latLonToPx, polygonToSvgPoints } from '../src/projection.js';

describe('latLonToPx — antimeridian-centered (default)', () => {
  const W = 2048;
  const H = 1024;

  it('places Greenwich at the left edge (and the right edge)', () => {
    expect(latLonToPx(0, 0, W, H).x).toBe(0);
    expect(latLonToPx(0, 360, W, H).x).toBe(0); // wraps
  });

  it('places the dateline at the center', () => {
    expect(latLonToPx(0, 180, W, H).x).toBe(W / 2);
    expect(latLonToPx(0, -180, W, H).x).toBe(W / 2);
  });

  it('latitude axis: +90° at top, -90° at bottom', () => {
    expect(latLonToPx(90, 0, W, H).y).toBe(0);
    expect(latLonToPx(-90, 0, W, H).y).toBe(H);
    expect(latLonToPx(0, 0, W, H).y).toBe(H / 2);
  });
});

describe('latLonToPx — Greenwich-centered (centerLon=0)', () => {
  const W = 2048;
  const H = 1024;

  it('places Greenwich at the center', () => {
    expect(latLonToPx(0, 0, W, H, 0).x).toBe(W / 2);
  });

  it('places the dateline at the edges', () => {
    expect(latLonToPx(0, -180, W, H, 0).x).toBe(0);
    expect(latLonToPx(0, 180, W, H, 0).x).toBe(0); // wraps to same edge
  });

  it('puts +90° E at x = 3W/4', () => {
    expect(latLonToPx(0, 90, W, H, 0).x).toBe((3 * W) / 4);
  });
});

describe('latLonToPx — California-centered (centerLon=-119)', () => {
  const W = 2048;
  const H = 1024;

  it('places -119° at the center', () => {
    expect(latLonToPx(0, -119, W, H, -119).x).toBeCloseTo(W / 2, 5);
  });

  it('places +61° (the antipode) at the edges', () => {
    // antipode of -119 is +61; that's where the seam falls
    expect(latLonToPx(0, 61, W, H, -119).x).toBeCloseTo(0, 5);
  });
});

describe('polygonToSvgPoints', () => {
  it('uses unwrapped eastward lon directly (no modulo) so x is monotonic', () => {
    const s = polygonToSvgPoints(
      [
        [0, 0],
        [180, 0],
        [360, 0],
      ],
      2048,
      1024,
    );
    expect(s).toBe('0.00,512.00 1024.00,512.00 2048.00,512.00');
  });

  it('formats vertices with 2 decimal places', () => {
    const s = polygonToSvgPoints([[180, 90]], 2048, 1024);
    expect(s).toBe('1024.00,0.00');
  });
});
