import { describe, it, expect } from 'vitest';
import { dayImageForDate } from '../src/day-image.js';

describe('dayImageForDate', () => {
  it('uses {month}-start for early-month days (1..7)', () => {
    expect(dayImageForDate(new Date('2024-03-01T12:00:00Z'))).toBe('blue-marble-03-start-2048.jpg');
    expect(dayImageForDate(new Date('2024-03-07T12:00:00Z'))).toBe('blue-marble-03-start-2048.jpg');
  });

  it('uses {month}-mid for mid-month days (8..22)', () => {
    expect(dayImageForDate(new Date('2024-03-08T12:00:00Z'))).toBe('blue-marble-03-mid-2048.jpg');
    expect(dayImageForDate(new Date('2024-03-15T12:00:00Z'))).toBe('blue-marble-03-mid-2048.jpg');
    expect(dayImageForDate(new Date('2024-03-22T12:00:00Z'))).toBe('blue-marble-03-mid-2048.jpg');
  });

  it('uses next-month-start for late-month days (23..end)', () => {
    expect(dayImageForDate(new Date('2024-03-23T12:00:00Z'))).toBe('blue-marble-04-start-2048.jpg');
    expect(dayImageForDate(new Date('2024-03-31T12:00:00Z'))).toBe('blue-marble-04-start-2048.jpg');
  });

  it('wraps December → January at end of year', () => {
    expect(dayImageForDate(new Date('2024-12-23T12:00:00Z'))).toBe('blue-marble-01-start-2048.jpg');
    expect(dayImageForDate(new Date('2024-12-31T23:59:00Z'))).toBe('blue-marble-01-start-2048.jpg');
  });

  it('honors UTC, not local time, at the day boundary', () => {
    // 2024-01-08 00:30 UTC is mid (day 8 in UTC), but might be Jan 7 in
    // the test runner's local zone. Verify we follow UTC.
    expect(dayImageForDate(new Date('2024-01-08T00:30:00Z'))).toBe('blue-marble-01-mid-2048.jpg');
  });

  it('handles all 12 months correctly', () => {
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const d = new Date(`2024-${mm}-15T12:00:00Z`);
      expect(dayImageForDate(d)).toBe(`blue-marble-${mm}-mid-2048.jpg`);
    }
  });
});
