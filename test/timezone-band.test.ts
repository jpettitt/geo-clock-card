import { describe, it, expect } from 'vitest';
import { buildHourCells } from '../src/timezone-band.js';

const MAP_W = 2048;

describe('buildHourCells (antimeridian-centered, hours only)', () => {
  it('produces 25 cells: Greenwich at both edges, dateline at the center', () => {
    const cells = buildHourCells(new Date('2024-06-21T12:00:00Z'), MAP_W);
    expect(cells.length).toBe(25);
    expect(cells[0]).toMatchObject({ offset: 0, realLon: 0, centerX: 0 });
    expect(cells[12]).toMatchObject({
      offset: 12,
      realLon: 180,
      centerX: MAP_W / 2,
    });
    expect(cells[24]).toMatchObject({
      offset: 0, // back at Greenwich after walking a full 360°
      realLon: 360,
      centerX: MAP_W,
    });
  });

  it('Z column (Greenwich, k=0 or k=24) reads UTC noon at UTC 12:00', () => {
    const cells = buildHourCells(new Date('2024-06-21T12:00:00Z'), MAP_W);
    expect(cells[0].isNoon).toBe(true);
    expect(cells[0].hour12).toBe(12);
    expect(cells[24].isNoon).toBe(true); // same physical column on the right edge
    expect(cells[24].hour12).toBe(12);
  });

  it('dateline column reads noon at UTC 00:00', () => {
    // At UTC 00:00, local hour at +12 offset = 12.
    const cells = buildHourCells(new Date('2024-06-21T00:00:00Z'), MAP_W);
    expect(cells[12].isNoon).toBe(true);
    expect(cells[12].hour12).toBe(12);
  });

  it('exactly two columns flag noon (Greenwich shows up at both edges)', () => {
    const cells = buildHourCells(new Date('2024-06-21T12:00:00Z'), MAP_W);
    const noonCells = cells.filter((c) => c.isNoon);
    expect(noonCells.length).toBe(2);
    // Both noon cells are at the same physical longitude (Greenwich),
    // just at the left edge (realLon=0) and the right-edge wrap (360).
    expect(noonCells.map((c) => c.realLon)).toEqual([0, 360]);
  });

  it('exactly one column flags noon when noon is mid-map (not on the seam)', () => {
    // At UTC 06:00, local hour = 12 in zone offset +6 → eastward k=6,
    // realLon = 0 + 6*15 = 90.
    const cells = buildHourCells(new Date('2024-06-21T06:00:00Z'), MAP_W);
    const noonCells = cells.filter((c) => c.isNoon);
    expect(noonCells.length).toBe(1);
    expect(noonCells[0].realLon).toBe(90);
  });

  it('hour12 walks 1..12 going east from a noon column', () => {
    const cells = buildHourCells(new Date('2024-06-21T12:00:00Z'), MAP_W);
    // Z=12, k=1 → 1 PM (hour12=1), k=2 → 2, ..., k=12 → 12 (midnight).
    expect(cells[1].hour12).toBe(1);
    expect(cells[2].hour12).toBe(2);
    expect(cells[11].hour12).toBe(11);
    expect(cells[12].hour12).toBe(12);
    expect(cells[12].isMidnight).toBe(true);
  });

  it('column centerX increments by exactly mapWidth/24', () => {
    const cells = buildHourCells(new Date(), MAP_W);
    const step = MAP_W / 24;
    for (let i = 1; i < cells.length; i++) {
      expect(cells[i].centerX - cells[i - 1].centerX).toBeCloseTo(step, 5);
    }
  });

  it('Greenwich-centered band: noon at center column when UTC = 12:00', () => {
    const cells = buildHourCells(new Date('2024-06-21T12:00:00Z'), MAP_W, 0);
    // centerLon=0 → leftEdge=-180 (dateline), centerCol (k=12) → realLon=0 (Greenwich).
    expect(cells[12].realLon).toBe(0);
    expect(cells[12].isNoon).toBe(true);
    expect(cells[12].hour12).toBe(12);
  });

  it('California-centered band: noon at center column when local solar noon there', () => {
    // California is roughly UTC-8 (PST). Solar noon at -119° happens
    // at UTC ≈ 19:56 (since solar noon at lon L is UTC = 12 - L/15
    // ≈ 12 + 7.93 = 19:56). Use 20:00 UTC for a clean test boundary.
    const cells = buildHourCells(new Date('2024-06-21T20:00:00Z'), MAP_W, -119);
    // Center column (k=12) sits on lon = -119
    expect(cells[12].realLon).toBe(-119);
    // local24 at -119 = (20 + (-119)/15) mod 24 = (20 - 7.933) mod 24 = 12.067 → floor = 12 (noon)
    expect(cells[12].isNoon).toBe(true);
  });

  it('sun-centered band: noon is always at the center', () => {
    // Whatever the time, when centerLon = subsolar.lon, the center
    // column should read noon (or at most a hair off due to floor).
    // Use UTC 18:00 with subsolar at lon = -90 (UTC 18:00 → subsolar
    // ≈ -90° ignoring EoT).
    const cells = buildHourCells(new Date('2024-06-21T18:00:00Z'), MAP_W, -90);
    expect(cells[12].realLon).toBe(-90);
    expect(cells[12].isNoon).toBe(true);
  });
});
