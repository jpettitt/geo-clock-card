import { describe, expect, it } from 'vitest';
import {
  bestWindows,
  localMinutesOfDay,
  scoreInstant,
  scoreRange,
  zoneOffsetMinutes,
  type InstantScore,
  type TierHours,
} from '../src/meeting-plan.js';

// Assumes full-ICU Node (same as timezones-iana.test.ts).

const HOURS: TierHours = {
  workStart: 9,
  workEnd: 17,
  awakeStart: 7,
  awakeEnd: 21,
};

describe('zoneOffsetMinutes', () => {
  it('returns 0 for UTC (bare "GMT" token)', () => {
    expect(zoneOffsetMinutes(new Date('2024-07-15T12:00:00Z'), 'UTC')).toBe(0);
  });

  it('tracks the US fall-back transition (2024-11-03, America/New_York)', () => {
    // 01:59 EDT, one minute before the clocks go back…
    expect(
      zoneOffsetMinutes(new Date('2024-11-03T05:59:00Z'), 'America/New_York'),
    ).toBe(-240);
    // …and 01:01 EST just after.
    expect(
      zoneOffsetMinutes(new Date('2024-11-03T06:01:00Z'), 'America/New_York'),
    ).toBe(-300);
  });

  it('handles half-hour zones (Asia/Kolkata +05:30, no DST)', () => {
    expect(
      zoneOffsetMinutes(new Date('2024-01-15T12:00:00Z'), 'Asia/Kolkata'),
    ).toBe(330);
    expect(
      zoneOffsetMinutes(new Date('2024-07-15T12:00:00Z'), 'Asia/Kolkata'),
    ).toBe(330);
  });

  it('handles 45-minute zones with DST (Pacific/Chatham)', () => {
    // Southern-hemisphere summer: +13:45; winter: +12:45.
    expect(
      zoneOffsetMinutes(new Date('2024-01-15T12:00:00Z'), 'Pacific/Chatham'),
    ).toBe(825);
    expect(
      zoneOffsetMinutes(new Date('2024-07-15T12:00:00Z'), 'Pacific/Chatham'),
    ).toBe(765);
  });

  it('handles 30-minute DST shifts (Australia/Lord_Howe)', () => {
    expect(
      zoneOffsetMinutes(new Date('2024-01-15T12:00:00Z'), 'Australia/Lord_Howe'),
    ).toBe(660);
    expect(
      zoneOffsetMinutes(new Date('2024-07-15T12:00:00Z'), 'Australia/Lord_Howe'),
    ).toBe(630);
  });
});

describe('localMinutesOfDay', () => {
  it('converts to local wall-clock minutes', () => {
    // 18:00Z in Denver (MDT, -6) = 12:00.
    expect(
      localMinutesOfDay(new Date('2024-07-15T18:00:00Z'), 'America/Denver'),
    ).toBe(720);
  });

  it('wraps past local midnight', () => {
    // 18:30Z + 5:30 (Kolkata) = 24:00 → 0.
    expect(
      localMinutesOfDay(new Date('2024-07-15T18:30:00Z'), 'Asia/Kolkata'),
    ).toBe(0);
    // 20:00Z + 5:30 = 01:30 next day.
    expect(
      localMinutesOfDay(new Date('2024-07-15T20:00:00Z'), 'Asia/Kolkata'),
    ).toBe(90);
  });
});

describe('scoreInstant', () => {
  it('scores work when every participant is in work hours', () => {
    // 16:00Z: Denver 10:00 (MDT), London 17:00 BST → boundary check below
    // uses 15:00Z instead: Denver 09:00, London 16:00.
    const s = scoreInstant(
      new Date('2024-07-15T15:00:00Z'),
      ['America/Denver', 'Europe/London'],
      HOURS,
    );
    expect(s.tier).toBe('work');
    expect(s.participants.map((p) => p.localMinutes)).toEqual([540, 960]);
  });

  it('treats workEnd as exclusive and workStart as inclusive', () => {
    // London 17:00 BST exactly → out of work hours, still awake.
    const end = scoreInstant(
      new Date('2024-07-15T16:00:00Z'),
      ['Europe/London'],
      HOURS,
    );
    expect(end.tier).toBe('awake');
    // London 09:00 exactly → in.
    const start = scoreInstant(
      new Date('2024-07-15T08:00:00Z'),
      ['Europe/London'],
      HOURS,
    );
    expect(start.tier).toBe('work');
  });

  it('is worst-case: one sleeping participant makes the instant asleep', () => {
    // 15:00Z: London 16:00 (work) but Tokyo 00:00 (asleep).
    const s = scoreInstant(
      new Date('2024-07-15T15:00:00Z'),
      ['Europe/London', 'Asia/Tokyo'],
      HOURS,
    );
    expect(s.tier).toBe('asleep');
    expect(s.participants[0].tier).toBe('work');
    expect(s.participants[1].tier).toBe('asleep');
  });

  it('scores neutral work for an empty participant list', () => {
    expect(scoreInstant(new Date(), [], HOURS).tier).toBe('work');
    expect(scoreInstant(new Date(), [], HOURS).participants).toEqual([]);
  });

  it('supports ranges that wrap midnight (night-shift hours)', () => {
    const night: TierHours = {
      workStart: 22,
      workEnd: 6,
      awakeStart: 20,
      awakeEnd: 8,
    };
    // London 23:00 BST (22:00Z).
    expect(
      scoreInstant(new Date('2024-07-15T22:00:00Z'), ['Europe/London'], night)
        .tier,
    ).toBe('work');
    // London 12:00 → outside both wrapped ranges.
    expect(
      scoreInstant(new Date('2024-07-15T11:00:00Z'), ['Europe/London'], night)
        .tier,
    ).toBe('asleep');
  });
});

describe('scoreRange', () => {
  it('recomputes offsets per instant across a DST transition', () => {
    // Four half-hour steps spanning New York's 2024 fall-back
    // (05:00Z=01:00 EDT … 06:30Z=01:30 EST): local wall time repeats.
    const cells = scoreRange(
      new Date('2024-11-03T05:00:00Z'),
      30,
      4,
      ['America/New_York'],
      HOURS,
    );
    expect(cells.map((c) => c.participants[0].localMinutes)).toEqual([
      60, 90, 60, 90,
    ]);
    for (const c of cells) expect(c.tier).toBe('asleep');
  });
});

describe('bestWindows', () => {
  const T0 = new Date('2024-07-15T00:00:00Z');
  const cell = (tier: InstantScore['tier']): InstantScore => ({
    tier,
    participants: [],
  });

  it('returns contiguous green runs, longest first, capped', () => {
    const tiers = [
      'asleep', 'work', 'work', 'awake', 'work', 'work', 'work',
      'asleep', 'work', 'awake',
    ] as const;
    const wins = bestWindows(tiers.map(cell), T0, 30, { max: 2 });
    expect(wins).toHaveLength(2);
    expect(wins[0]).toEqual({
      start: new Date('2024-07-15T02:00:00Z'),
      end: new Date('2024-07-15T03:30:00Z'),
      tier: 'work',
    });
    expect(wins[1]).toEqual({
      start: new Date('2024-07-15T00:30:00Z'),
      end: new Date('2024-07-15T01:30:00Z'),
      tier: 'work',
    });
  });

  it('falls back to awake windows when nothing is green', () => {
    const wins = bestWindows(
      (['asleep', 'awake', 'awake', 'asleep'] as const).map(cell),
      T0,
      30,
    );
    expect(wins).toHaveLength(1);
    expect(wins[0].tier).toBe('awake');
    expect(wins[0].start).toEqual(new Date('2024-07-15T00:30:00Z'));
    expect(wins[0].end).toEqual(new Date('2024-07-15T01:30:00Z'));
  });

  it('returns nothing when every cell is asleep', () => {
    expect(bestWindows((['asleep', 'asleep'] as const).map(cell), T0, 30)).toEqual([]);
  });

  it('drops runs shorter than minMinutes', () => {
    const wins = bestWindows(
      (['work', 'asleep', 'work', 'work'] as const).map(cell),
      T0,
      30,
      { minMinutes: 60 },
    );
    expect(wins).toHaveLength(1);
    expect(wins[0].start).toEqual(new Date('2024-07-15T01:00:00Z'));
  });

  it('breaks length ties by earliest start', () => {
    const wins = bestWindows(
      (['work', 'asleep', 'work'] as const).map(cell),
      T0,
      30,
    );
    expect(wins[0].start).toEqual(T0);
  });
});
