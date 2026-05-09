// Hour-of-day band rendered above the map.
//
// One column per 15° of longitude (24 zones around the planet). Each
// column shows the current local hour at that meridian. The noon and
// midnight columns are highlighted; everything else is just a number.
//
// Cells are positioned at xK = k · (mapWidth / 24) for k ∈ [0, 24].
// The leftmost cell (k=0) maps to the longitude at the canvas's left
// edge (centerLon - 180) and the rightmost (k=24) wraps back to the
// same physical column on the right edge.

import { svg, type SVGTemplateResult } from 'lit';

export const BAND_H = 44;
const TICK_OVERSHOOT = 12;

export interface HourCell {
  /** UTC offset in hours (signed; nominal value used for inspection) */
  offset: number;
  /** Physical longitude this column represents */
  realLon: number;
  /** Cell center x in map pixels */
  centerX: number;
  /** 1..12 in 12-hour-clock form */
  hour12: number;
  /** Local 24-hour hour-of-day is 12 */
  isNoon: boolean;
  /** Local 24-hour hour-of-day is 0 */
  isMidnight: boolean;
}

export function buildHourCells(
  now: Date,
  mapWidth: number,
  centerLon = 180,
): HourCell[] {
  const utcH =
    now.getUTCHours() +
    now.getUTCMinutes() / 60 +
    now.getUTCSeconds() / 3600;
  const colW = mapWidth / 24;
  const leftEdgeLon = centerLon - 180;

  const cells: HourCell[] = [];
  for (let k = 0; k <= 24; k++) {
    const realLon = leftEdgeLon + k * 15;
    // UTC offset of this meridian (in hours), normalized to (-12, +12].
    let offset = realLon / 15;
    while (offset > 12) offset -= 24;
    while (offset <= -12) offset += 24;
    // Round (not floor) so a column whose true local time is a few
    // minutes either side of a whole hour displays the closest hour.
    // Floor truncation here was visibly wrong in sun-centered mode:
    // because of the equation of time, the subsolar longitude is
    // fractional (typically ±1°), and the cell at the center column
    // computed e.g. 11.95 → floored to 11, making the entire band
    // read one hour low. The outer `% 24` handles Math.round wrapping
    // 23.7 → 24 → midnight.
    const local24 =
      Math.round((((utcH + realLon / 15) % 24) + 24) % 24) % 24;
    cells.push({
      offset,
      realLon,
      centerX: k * colW,
      hour12: ((local24 + 11) % 12) + 1,
      isNoon: local24 === 12,
      isMidnight: local24 === 0,
    });
  }
  return cells;
}

export function timezoneBand(
  now: Date,
  mapWidth: number,
  centerLon = 180,
): SVGTemplateResult {
  const cells = buildHourCells(now, mapWidth, centerLon);
  const bandY = -BAND_H;
  const textY = bandY + BAND_H / 2 + 1;
  const colW = mapWidth / 24;

  // Tick at every column boundary inside the canvas (skip the
  // canvas edges themselves, they read as the seam).
  const tickXs: number[] = [];
  for (let k = 1; k < 24; k++) tickXs.push(k * colW);

  return svg`
    <g class="tz-band">
      <rect class="tz-bg"
            x="0" y="${bandY}"
            width="${mapWidth}" height="${BAND_H}"/>

      ${cells.map(
        (c) => svg`
        <text class="tz-hour${c.isNoon ? ' noon' : ''}${c.isMidnight ? ' mid' : ''}"
              x="${c.centerX}" y="${textY}"
              text-anchor="middle" dominant-baseline="central">${c.hour12}</text>`,
      )}

      ${tickXs.map(
        (x) => svg`
        <line class="tz-tick"
              x1="${x}" y1="${bandY + BAND_H}"
              x2="${x}" y2="${TICK_OVERSHOOT}"/>`,
      )}
    </g>
  `;
}
