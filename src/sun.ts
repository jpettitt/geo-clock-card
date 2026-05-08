// Subsolar point and sun-elevation math.
//
// Reference: USNO low-precision formulas
// (https://aa.usno.navy.mil/faq/sun_approx). Accurate to ~0.01° from
// 1950 to 2050 — far past anything a wall clock cares about.

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

export interface SubsolarPoint {
  /** degrees, positive north; equals solar declination */
  lat: number;
  /** degrees, positive east, normalized to [-180, 180] */
  lon: number;
}

const wrap180 = (deg: number): number =>
  ((((deg + 180) % 360) + 360) % 360) - 180;

export function subsolarPoint(date: Date): SubsolarPoint {
  const n = (date.getTime() - J2000_MS) / 86400000;

  const L = 280.460 + 0.9856474 * n;
  const g = (357.528 + 0.9856003 * n) * DEG;

  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG;
  const epsilon = (23.439 - 0.0000004 * n) * DEG;

  const declination = Math.asin(Math.sin(epsilon) * Math.sin(lambda)) * RAD;

  // Right ascension (degrees), atan2 keeps it in the same quadrant as λ.
  const alpha =
    Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda)) * RAD;

  // Equation of time, expressed in degrees of arc; positive means apparent
  // sun is ahead of mean sun. Wrap so jumps across α=0/360 don't blow up.
  const eotDeg = wrap180(L - alpha);

  const utcHours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600 +
    date.getUTCMilliseconds() / 3600000;

  // Sun moves 15°/hour westward; EoT shifts subsolar point by its arc value.
  const lon = wrap180(-15 * (utcHours - 12) - eotDeg);

  return { lat: declination, lon };
}

/**
 * Solar elevation (degrees above the horizon) at a given (lat, lon)
 * for a given subsolar point. Currently only consumed by the test
 * suite, where it's used as ground truth: a vertex on the terminator
 * polygon must produce a sun-elevation of ~0°. Exported (rather than
 * inlined into the test) to keep the surface area of `sun.ts` honest
 * — the trig is a public, testable formula, not test scaffolding.
 */
export function sunElevation(
  lat: number,
  lon: number,
  sub: SubsolarPoint,
): number {
  const latR = lat * DEG;
  const subLatR = sub.lat * DEG;
  const H = (lon - sub.lon) * DEG;
  return (
    Math.asin(
      Math.sin(latR) * Math.sin(subLatR) +
        Math.cos(latR) * Math.cos(subLatR) * Math.cos(H),
    ) * RAD
  );
}
