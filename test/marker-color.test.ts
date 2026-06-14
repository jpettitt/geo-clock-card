import { describe, it, expect } from 'vitest';
import { subsolarPoint } from '../src/sun.js';
import { isDaylightAt, pickDayNightColor } from '../src/marker-color.js';

describe('pickDayNightColor', () => {
  it('returns undefined when neither color is set (day/night OFF)', () => {
    expect(pickDayNightColor(undefined, undefined, true)).toBeUndefined();
    expect(pickDayNightColor(undefined, undefined, false)).toBeUndefined();
  });

  it('picks the side matching the daylight flag when both are set', () => {
    expect(pickDayNightColor('#ff9933', '#3da9fc', true)).toBe('#ff9933');
    expect(pickDayNightColor('#ff9933', '#3da9fc', false)).toBe('#3da9fc');
  });

  it('uses the single set color for both sides (partial override)', () => {
    // day-only override
    expect(pickDayNightColor('#ff9933', undefined, true)).toBe('#ff9933');
    expect(pickDayNightColor('#ff9933', undefined, false)).toBe('#ff9933');
    // night-only override
    expect(pickDayNightColor(undefined, '#3da9fc', true)).toBe('#3da9fc');
    expect(pickDayNightColor(undefined, '#3da9fc', false)).toBe('#3da9fc');
  });
});

describe('isDaylightAt', () => {
  // A fixed instant; the subsolar point is the literal "directly
  // overhead" location, so it is unambiguously in daylight and its
  // antipode is unambiguously in night.
  const sub = subsolarPoint(new Date('2024-06-20T12:00:00Z'));

  it('is true at the subsolar point', () => {
    expect(isDaylightAt(sub.lat, sub.lon, sub)).toBe(true);
  });

  it('is false at the antisolar point', () => {
    const antiLat = -sub.lat;
    const antiLon = ((sub.lon + 360) % 360) - 180; // opposite meridian
    expect(isDaylightAt(antiLat, antiLon, sub)).toBe(false);
  });

  it('flips across the terminator (90° from subsolar in longitude)', () => {
    // On the equator, 90° east/west of the subsolar meridian sits on
    // the terminator; nudging in1° to either side flips daylight.
    const justDay = isDaylightAt(0, sub.lon + 89, sub);
    const justNight = isDaylightAt(0, sub.lon + 91, sub);
    expect(justDay).toBe(true);
    expect(justNight).toBe(false);
  });
});
