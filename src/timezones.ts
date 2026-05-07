// Time-zone boundary overlay. Loads a simplified GeoJSON
// (assets/timezones.json, ~97 KB) of polygon features per zone, then
// projects them into SVG `<path>` data — one path per zone (or per
// connected piece, when a zone crosses the canvas seam).
//
// Each path exposes the zone's UTC offset, a human-readable offset
// label, and a places string so the card can build a custom popup.
//
// Source: Natural Earth 10m time-zones, dissolved by `zone`,
// simplified to 2% retention. See scripts/fetch-tz.sh.

import { ringToWrappedD } from './timezones-iana.js';

interface TzFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: {
      zone: number;
      time_zone?: string | null;
      name?: string | null;
      places?: string | null;
    };
    geometry: {
      type: 'Polygon' | 'MultiPolygon';
      coordinates: number[][][] | number[][][][];
    };
  }>;
}

export interface TzPolygon {
  /** UTC offset in hours (e.g. -8, +5.5). Used to compute the local
   *  time displayed in the popup. */
  offset: number;
  /** Human-readable offset label, e.g. "UTC-08:00" or "UTC+05:30". */
  offsetLabel: string;
  /** Canonical time-zone name when available, e.g. "Atlantic Standard
   *  Time", "India Standard Time". null when the offset has no
   *  widely-used name. */
  name: string | null;
  /** Truncated places string, e.g. "United States (California), …". */
  places: string;
  /** SVG path `d` string. May contain multiple `M…Z` sub-paths when
   *  the zone has multiple polygons or wraps the canvas seam. */
  d: string;
}

let cachedDataPromise: Promise<TzFeatureCollection> | null = null;
let cachedDataUrl: string | null = null;

export function loadTimezones(url: string): Promise<TzFeatureCollection> {
  if (cachedDataPromise && cachedDataUrl === url) return cachedDataPromise;
  cachedDataUrl = url;
  cachedDataPromise = fetch(url).then((r) => {
    if (!r.ok) throw new Error(`tz fetch failed: ${r.status}`);
    return r.json();
  });
  return cachedDataPromise;
}

/**
 * Build an array of per-zone SVG paths from the GeoJSON feature
 * collection, projected onto a map centered on `centerLon`. See
 * `ringToWrappedD` in timezones-iana.ts for how seam-crossing
 * polygons are kept as single continuous loops + duplicated for
 * the wrap.
 */
export function timezonesToPolygons(
  data: TzFeatureCollection,
  width: number,
  height: number,
  centerLon = 180,
): TzPolygon[] {
  const out: TzPolygon[] = [];
  for (const f of data.features) {
    const polygons: number[][][][] =
      f.geometry.type === 'Polygon'
        ? [f.geometry.coordinates as number[][][]]
        : (f.geometry.coordinates as number[][][][]);
    let d = '';
    for (const polygon of polygons) {
      if (polygon.length === 0) continue;
      d += ringToWrappedD(polygon[0], width, height, centerLon);
    }
    if (!d) continue;
    out.push({
      offset: f.properties.zone,
      offsetLabel: formatOffset(f.properties.zone, f.properties.time_zone),
      name: f.properties.name ?? null,
      places: trimPlaces(f.properties.places ?? ''),
      d,
    });
  }
  return out;
}

function formatOffset(offset: number, raw?: string | null): string {
  if (raw && /^UTC[+−\-]\d/.test(raw)) return raw;
  // Fall back to building "UTC±HH:MM" from the numeric offset.
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const hh = String(Math.trunc(abs)).padStart(2, '0');
  const mm = String(Math.round((abs - Math.trunc(abs)) * 60)).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}

function trimPlaces(places: string): string {
  const s = places.trim();
  if (s.length <= 80) return s;
  return s.slice(0, 77) + '…';
}
