// IANA time-zone polygon overlay for DST-aware hover hit-testing.
//
// Source: timezone-boundary-builder's "now" GeoJSON (~64 currently-
// distinct zones), simplified to 1% retention (~400 KB on disk).
// See scripts/fetch-tz-iana.sh.
//
// Each polygon is tagged with an IANA `tzid` (e.g. "America/New_York")
// — the input that `Intl.DateTimeFormat({ timeZone })` needs to apply
// the correct DST/standard offset for any given moment.

interface IanaFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: { tzid: string };
    geometry: {
      type: 'Polygon' | 'MultiPolygon';
      coordinates: number[][][] | number[][][][];
    };
  }>;
}

export interface IanaPolygon {
  /** Full IANA name, e.g. "America/New_York", "Asia/Kolkata". */
  tzid: string;
  /** Pretty form of the city name, e.g. "New York" → for the popup. */
  cityLabel: string;
  /** SVG path `d` (may contain multiple `M…Z` sub-paths for seam
   *  crossings or multi-polygon zones). */
  d: string;
}

let cachedDataPromise: Promise<IanaFeatureCollection> | null = null;
let cachedDataUrl: string | null = null;

export function loadIanaTimezones(url: string): Promise<IanaFeatureCollection> {
  if (cachedDataPromise && cachedDataUrl === url) return cachedDataPromise;
  cachedDataUrl = url;
  cachedDataPromise = fetch(url).then((r) => {
    if (!r.ok) throw new Error(`iana tz fetch failed: ${r.status}`);
    return r.json();
  });
  return cachedDataPromise;
}

export function ianaToPolygons(
  data: IanaFeatureCollection,
  width: number,
  height: number,
  centerLon = 180,
): IanaPolygon[] {
  const out: IanaPolygon[] = [];
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
      tzid: f.properties.tzid,
      cityLabel: cityFromTzid(f.properties.tzid),
      d,
    });
  }
  return out;
}

/**
 * Convert one closed ring to one or more `M…Z` sub-paths.
 *
 * Naïvely splitting at the canvas seam (where x wraps W → 0) breaks
 * filled polygons: each half closes with a synthetic chord that
 * carves a wedge through the wrong part of the map. Instead we
 * **unwrap** longitudes during projection so the ring stays a single
 * continuous closed loop in user-space — even if it extends past the
 * canvas edge — then draw an additional copy shifted by ±W when the
 * polygon's bounding box exceeds the canvas extent. SVG viewBox
 * clipping shows only the visible portion, and the union of the
 * copies covers the seam wrap correctly for both rendering and
 * hit-testing.
 */
export function ringToWrappedD(
  ring: number[][],
  width: number,
  height: number,
  centerLon = 180,
): string {
  if (ring.length < 3) return '';
  const leftEdgeLon = centerLon - 180;

  // Unwrap eastward longitudes so consecutive vertices never jump
  // by more than 180°.
  const points: Array<[number, number]> = [];
  let prevLonE: number | null = null;
  let xMin = Infinity;
  let xMax = -Infinity;
  for (const [lon, lat] of ring) {
    let lonE = (((lon - leftEdgeLon) % 360) + 360) % 360;
    if (prevLonE !== null) {
      while (lonE - prevLonE > 180) lonE -= 360;
      while (lonE - prevLonE < -180) lonE += 360;
    }
    prevLonE = lonE;
    const x = (lonE / 360) * width;
    const y = ((90 - lat) / 180) * height;
    points.push([x, y]);
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
  }

  const pts = points;
  const subpath = (shift: number): string => {
    let d = '';
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      d += `${i === 0 ? 'M' : 'L'}${(x + shift).toFixed(1)},${y.toFixed(1)}`;
    }
    return d + 'Z';
  };

  let d = subpath(0);
  // If the polygon extends past either canvas edge, draw the wrap
  // copy so the off-edge portion shows on the opposite side.
  if (xMax > width) d += subpath(-width);
  if (xMin < 0) d += subpath(width);
  return d;
}

/** "America/New_York" → "New York"; "Asia/Argentina/Buenos_Aires"
 *  → "Buenos Aires". Falls back to the raw tzid for malformed IDs. */
export function cityFromTzid(tzid: string): string {
  const parts = tzid.split('/');
  if (parts.length < 2) return tzid;
  return parts[parts.length - 1].replace(/_/g, ' ');
}

/** What we get back from `Intl.DateTimeFormat` for a given moment in
 *  a given IANA zone. All three fields are DST-aware: in summer for
 *  America/New_York you'll see e.g. `time: "13:42:15"`, `name:
 *  "Eastern Daylight Time"`, `offset: "GMT-04:00"`. */
export interface ZoneNow {
  time: string;
  name: string;
  offset: string;
}

const PART_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();
const OFFSET_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function partFormatter(tzid: string): Intl.DateTimeFormat {
  let f = PART_FORMATTER_CACHE.get(tzid);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tzid,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'long',
    });
    PART_FORMATTER_CACHE.set(tzid, f);
  }
  return f;
}

function offsetFormatter(tzid: string): Intl.DateTimeFormat {
  let f = OFFSET_FORMATTER_CACHE.get(tzid);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tzid,
      timeZoneName: 'longOffset',
    });
    OFFSET_FORMATTER_CACHE.set(tzid, f);
  }
  return f;
}

export function zoneNow(now: Date, tzid: string): ZoneNow {
  const parts = partFormatter(tzid).formatToParts(now);
  const offParts = offsetFormatter(tzid).formatToParts(now);
  const get = (arr: Intl.DateTimeFormatPart[], type: string) =>
    arr.find((p) => p.type === type)?.value ?? '';
  // hour can come back as "24" for midnight in some locales — clamp.
  const hh = get(parts, 'hour') === '24' ? '00' : get(parts, 'hour');
  return {
    time: `${hh}:${get(parts, 'minute')}:${get(parts, 'second')}`,
    name: get(parts, 'timeZoneName'),
    offset: get(offParts, 'timeZoneName').replace(/^GMT/, 'UTC'),
  };
}
