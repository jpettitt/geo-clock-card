// Equirectangular projection with a configurable center longitude.
//
// The map is centered on `centerLon`: at lon = centerLon, x = W/2.
// The seam (where x wraps from W back to 0) sits at lon = centerLon ± 180.
// Polygon walkers (e.g. the terminator) emit vertices in **eastward
// pixel-space longitude** lonE ∈ [0, 360], where lonE = 0 is the
// canvas's left edge and lonE = 360 is the right edge. That keeps x
// monotonic across the map regardless of centerLon, so a polygon
// walked from 0 → 360 never crosses the seam mid-walk.

import type { LonLat } from './terminator.js';

export interface PixelPoint {
  x: number;
  y: number;
}

const wrap360 = (deg: number): number => ((deg % 360) + 360) % 360;

/**
 * Convert a (lat, lon) pair to canvas pixels, given the longitude
 * the user wants centered on the map. Use this for ad-hoc lookups
 * (location pins, map-edge labels, etc.).
 */
export function latLonToPx(
  lat: number,
  lon: number,
  width: number,
  height: number,
  centerLon = 180,
): PixelPoint {
  const leftEdgeLon = centerLon - 180;
  const lonE = wrap360(lon - leftEdgeLon);
  return {
    x: (lonE / 360) * width,
    y: ((90 - lat) / 180) * height,
  };
}

/**
 * Convert a polygon (vertices already in eastward-pixel-space lonE
 * ∈ [0, 360]) to an SVG `points` string. The polygon's coords are
 * mapped straight through without re-wrapping — that's what keeps
 * x continuous across the 360° boundary at the right edge.
 */
export function polygonToSvgPoints(
  poly: readonly LonLat[],
  width: number,
  height: number,
): string {
  const out: string[] = [];
  for (const [lonE, lat] of poly) {
    const x = (lonE / 360) * width;
    const y = ((90 - lat) / 180) * height;
    out.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return out.join(' ');
}
