/**
 * Meeting-planner math: numeric UTC offsets, local time-of-day, and
 * tiered "how good is this instant for a meeting" scoring across a
 * set of IANA time zones.
 *
 * Pure module — no DOM, no card imports — so it is unit-testable and
 * can be re-exported from the bundle entry for the web planner UI.
 *
 * Everything is computed per-instant from Intl, never by adding a
 * fixed offset across a range: DST boundaries can fall inside a
 * planning window, and zones like Lord Howe shift by 30 minutes.
 */

export type MeetingTier = 'work' | 'awake' | 'asleep';

/** Tier boundaries as fractional local hours (e.g. 8.5 = 08:30). */
export interface TierHours {
  workStart: number;
  workEnd: number;
  awakeStart: number;
  awakeEnd: number;
}

export interface ParticipantAt {
  tzid: string;
  /** Local wall-clock time as minutes past local midnight, 0..1439. */
  localMinutes: number;
  tier: MeetingTier;
}

export interface InstantScore {
  /** Worst participant's tier — a meeting is only as good as its
   *  most-inconvenienced attendee. */
  tier: MeetingTier;
  participants: ParticipantAt[];
}

export interface MeetingWindow {
  start: Date;
  /** Exclusive: the instant one step after the last qualifying cell. */
  end: Date;
  tier: MeetingTier;
}

// One formatter per tzid. Pinned to en-US so the "GMT±HH:MM" token is
// stable; the numeric offset itself is language-neutral.
const OFFSET_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(tzid: string): Intl.DateTimeFormat {
  let f = OFFSET_FORMATTERS.get(tzid);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tzid,
      timeZoneName: 'longOffset',
    });
    OFFSET_FORMATTERS.set(tzid, f);
  }
  return f;
}

const OFFSET_RE = /^GMT(?:([+-])(\d{1,2}):(\d{2}))?$/;

/**
 * Signed UTC offset of `tzid` at `date`, in minutes (Kolkata → +330).
 * Throws RangeError on an unknown tzid (same as Intl itself).
 */
export function zoneOffsetMinutes(date: Date, tzid: string): number {
  const parts = offsetFormatter(tzid).formatToParts(date);
  const token = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  // Bare "GMT" (no digits) is how longOffset spells a zero offset.
  const m = OFFSET_RE.exec(token);
  if (!m) return 0;
  if (!m[1]) return 0;
  const minutes = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -minutes : minutes;
}

/** Local wall-clock time in `tzid` at `date`, as minutes past local
 *  midnight (0..1439). */
export function localMinutesOfDay(date: Date, tzid: string): number {
  const utcMinutes =
    date.getUTCHours() * 60 + date.getUTCMinutes();
  const local = utcMinutes + zoneOffsetMinutes(date, tzid);
  return ((local % 1440) + 1440) % 1440;
}

// Ranges are [start, end) in minutes; start > end means the range
// wraps midnight (night-shift hours) and is handled rather than
// misclassifying everything.
function inRange(minutes: number, startH: number, endH: number): boolean {
  const s = startH * 60;
  const e = endH * 60;
  return s <= e
    ? minutes >= s && minutes < e
    : minutes >= s || minutes < e;
}

const TIER_RANK: Record<MeetingTier, number> = {
  asleep: 0,
  awake: 1,
  work: 2,
};

function tierAt(minutes: number, hours: TierHours): MeetingTier {
  if (inRange(minutes, hours.workStart, hours.workEnd)) return 'work';
  if (inRange(minutes, hours.awakeStart, hours.awakeEnd)) return 'awake';
  return 'asleep';
}

/**
 * Score one instant for a meeting across `tzids`. The overall tier is
 * the worst participant's tier. An empty participant list scores
 * 'work' — callers render that as neutral, not as a recommendation.
 */
export function scoreInstant(
  date: Date,
  tzids: string[],
  hours: TierHours,
): InstantScore {
  let worst: MeetingTier = 'work';
  const participants = tzids.map((tzid) => {
    const localMinutes = localMinutesOfDay(date, tzid);
    const tier = tierAt(localMinutes, hours);
    if (TIER_RANK[tier] < TIER_RANK[worst]) worst = tier;
    return { tzid, localMinutes, tier };
  });
  return { tier: worst, participants };
}

/** Score `steps` instants starting at `start`, `stepMinutes` apart. */
export function scoreRange(
  start: Date,
  stepMinutes: number,
  steps: number,
  tzids: string[],
  hours: TierHours,
): InstantScore[] {
  const out: InstantScore[] = [];
  for (let i = 0; i < steps; i++) {
    out.push(
      scoreInstant(
        new Date(start.getTime() + i * stepMinutes * 60_000),
        tzids,
        hours,
      ),
    );
  }
  return out;
}

/**
 * Contiguous runs of the best tier present in `cells` ('work' if any,
 * else 'awake'; none if everything is 'asleep'), longest first, ties
 * broken by earliest start. `minMinutes` drops shorter runs (default
 * 0); `max` caps the result (default 3).
 */
export function bestWindows(
  cells: InstantScore[],
  start: Date,
  stepMinutes: number,
  opts?: { minMinutes?: number; max?: number },
): MeetingWindow[] {
  const minMinutes = opts?.minMinutes ?? 0;
  const max = opts?.max ?? 3;
  const best = cells.some((c) => c.tier === 'work')
    ? 'work'
    : cells.some((c) => c.tier === 'awake')
      ? 'awake'
      : null;
  if (!best) return [];

  const runs: Array<{ from: number; len: number }> = [];
  let run: { from: number; len: number } | null = null;
  cells.forEach((c, i) => {
    if (c.tier === best) {
      if (run) run.len++;
      else runs.push((run = { from: i, len: 1 }));
    } else {
      run = null;
    }
  });

  return runs
    .filter((r) => r.len * stepMinutes >= minMinutes)
    .sort((a, b) => b.len - a.len || a.from - b.from)
    .slice(0, max)
    .map((r) => ({
      start: new Date(start.getTime() + r.from * stepMinutes * 60_000),
      end: new Date(
        start.getTime() + (r.from + r.len) * stepMinutes * 60_000,
      ),
      tier: best as MeetingTier,
    }));
}
