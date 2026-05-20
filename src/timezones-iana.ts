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

/**
 * Find the IANA tzid whose polygon contains (lat, lon).
 *
 * Operates on the raw GeoJSON coordinates rather than projected pixels
 * so the result is independent of map centering. Uses a ray-casting
 * point-in-polygon test on the outer ring of each (multi)polygon and
 * returns the FIRST match — there is no ocean fallback. Callers wanting
 * an offset fallback for points over open ocean should handle the
 * `null` return themselves.
 *
 * O(n × vertices) per call. The 1%-simplified dataset has ~419 zones
 * and ~12k vertices total, so a lookup is ~ms — fine for one-off marker
 * resolution; cache the result if you'd be calling on a tight loop.
 */
export function findIanaZoneForLatLon(
  data: IanaFeatureCollection,
  lat: number,
  lon: number,
): string | null {
  if (
    typeof lat !== 'number' ||
    typeof lon !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return null;
  }
  const normalizedLon = (((lon + 180) % 360) + 360) % 360 - 180;
  for (const f of data.features) {
    const polygons: number[][][][] =
      f.geometry.type === 'Polygon'
        ? [f.geometry.coordinates as number[][][]]
        : (f.geometry.coordinates as number[][][][]);
    for (const polygon of polygons) {
      if (polygon.length === 0) continue;
      // GeoJSON ring 0 is the outer boundary; subsequent rings are
      // holes. Holes are rare in TZ polygons and ignored here — the
      // simplified dataset has no enclaves we'd accidentally claim.
      if (pointInRing(polygon[0], normalizedLon, lat)) return f.properties.tzid;
    }
  }
  return null;
}

/** Standard ray-casting point-in-polygon, ring is `[lon, lat][]`. */
function pointInRing(ring: number[][], lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** "America/New_York" → "New York"; "Asia/Argentina/Buenos_Aires"
 *  → "Buenos Aires". Falls back to the raw tzid for malformed IDs. */
export function cityFromTzid(tzid: string): string {
  const parts = tzid.split('/');
  if (parts.length < 2) return tzid;
  return parts[parts.length - 1].replace(/_/g, ' ');
}

/** What we get back from `Intl.DateTimeFormat` for a given moment in
 *  a given IANA zone. All four fields are DST-aware: in summer for
 *  America/New_York you'll see e.g. `time: "1:42:15 PM"` (in en-US)
 *  or `"13:42:15"` (in en-GB), `name: "Eastern Daylight Time"`,
 *  `offset: "UTC-04:00"`, plus the local `date` (which may differ
 *  from the user's date when hovering the far side of the planet). */
export interface ZoneNow {
  time: string;
  date: string;
  name: string;
  offset: string;
}

interface FormatterSet {
  time: Intl.DateTimeFormat;
  date: Intl.DateTimeFormat;
  zoneName: Intl.DateTimeFormat;
  offset: Intl.DateTimeFormat;
}

const FORMATTER_CACHE = new Map<string, FormatterSet>();

function formatters(tzid: string, locale?: string | string[]): FormatterSet {
  // Cache key includes the locale so a user changing UI language
  // gets fresh formatters. `undefined` is encoded as the empty
  // string so the cache stays a plain Map.
  const key = `${tzid}|${
    Array.isArray(locale) ? locale.join(',') : locale ?? ''
  }`;
  let f = FORMATTER_CACHE.get(key);
  if (!f) {
    // `undefined` → Intl uses navigator.language (or runtime default
    // in Node). `hour12` left unspecified on purpose so the locale
    // decides 24-hour vs AM/PM.
    f = {
      time: new Intl.DateTimeFormat(locale, {
        timeZone: tzid,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      }),
      date: new Intl.DateTimeFormat(locale, {
        timeZone: tzid,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      // Long zone-name formatter: we still ask for time + name so
      // formatToParts gives us the timeZoneName part; the locale
      // here doesn't materially change what we extract.
      zoneName: new Intl.DateTimeFormat('en-US', {
        timeZone: tzid,
        hour: 'numeric',
        timeZoneName: 'long',
      }),
      offset: new Intl.DateTimeFormat('en-US', {
        timeZone: tzid,
        timeZoneName: 'longOffset',
      }),
    };
    FORMATTER_CACHE.set(key, f);
  }
  return f;
}

export function zoneNow(
  now: Date,
  tzid: string,
  locale?: string | string[],
): ZoneNow {
  const f = formatters(tzid, locale);
  const get = (
    parts: Intl.DateTimeFormatPart[],
    type: string,
  ): string => parts.find((p) => p.type === type)?.value ?? '';
  const nameParts = f.zoneName.formatToParts(now);
  const offsetParts = f.offset.formatToParts(now);
  return {
    time: f.time.format(now),
    date: f.date.format(now),
    name: get(nameParts, 'timeZoneName'),
    offset: get(offsetParts, 'timeZoneName').replace(/^GMT/, 'UTC'),
  };
}
