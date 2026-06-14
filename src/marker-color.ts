// Day/night marker color selection — pure, testable helpers shared
// by the card's marker renderer. Kept out of the Lit component so
// the logic can be unit-tested without a DOM.

import { sunElevation, type SubsolarPoint } from './sun.js';

/**
 * True when the sun is above the horizon at (lat, lon) for the given
 * subsolar point — i.e. the location is in daylight. Uses the same
 * elevation formula the terminator is drawn from, so a marker flips
 * exactly as the rendered terminator sweeps over it.
 */
export function isDaylightAt(
  lat: number,
  lon: number,
  sub: SubsolarPoint,
): boolean {
  return sunElevation(lat, lon, sub) > 0;
}

/**
 * Choose a marker's fill from its resolved day/night colors and a
 * daylight flag.
 *
 *   - Neither set → undefined (caller falls back to the single
 *     `color` path; day/night mode is OFF for this marker).
 *   - Both set → the side matching `isDay`.
 *   - Only one set → that one is used for both day and night (a
 *     partial override still beats nothing, and keeps the marker
 *     visible rather than vanishing on the unset side).
 */
export function pickDayNightColor(
  dayColor: string | undefined,
  nightColor: string | undefined,
  isDay: boolean,
): string | undefined {
  if (!dayColor && !nightColor) return undefined;
  return isDay ? dayColor ?? nightColor : nightColor ?? dayColor;
}
