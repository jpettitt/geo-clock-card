// Time-zone boundary overlay. Loads a simplified GeoJSON
// (assets/timezones.json, ~60 KB) and converts it to a single SVG
// `<path>` `d` string in antimeridian-centered pixel space.
//
// The source is Natural Earth's 10m time-zones layer, dissolved by
// `zone` and reduced to lines so we only render the boundaries
// (not filled polygons). See scripts/fetch-tz.sh for the pipeline.
//
// Each line segment crossing the Greenwich seam (where x jumps from
// near W to near 0 in our antimeridian-centered projection) is broken
// into two sub-paths so the polyline never draws a horizontal stripe
// across the map.

interface TzGeometryCollection {
  type: 'GeometryCollection';
  geometries: Array<{
    type: 'LineString' | 'MultiLineString';
    coordinates: number[][] | number[][][];
  }>;
}

let cachedDataPromise: Promise<TzGeometryCollection> | null = null;
let cachedDataUrl: string | null = null;

export function loadTimezones(url: string): Promise<TzGeometryCollection> {
  if (cachedDataPromise && cachedDataUrl === url) return cachedDataPromise;
  cachedDataUrl = url;
  cachedDataPromise = fetch(url).then((r) => {
    if (!r.ok) throw new Error(`tz fetch failed: ${r.status}`);
    return r.json();
  });
  return cachedDataPromise;
}

/**
 * Build the `d` attribute for an SVG path from a GeoJSON
 * GeometryCollection of LineString / MultiLineString geometries,
 * projected onto a map centered on `centerLon`.
 *
 * Each lon is wrapped to its eastward offset from the canvas's left
 * edge (centerLon - 180). When two consecutive vertices on the same
 * polyline land on opposite sides of the seam (|x diff| > halfWidth),
 * we split into a new sub-path with `M` so the polyline never draws
 * a flat stripe across the map.
 */
export function timezonesToPathD(
  data: TzGeometryCollection,
  width: number,
  height: number,
  centerLon = 180,
): string {
  const halfW = width / 2;
  const leftEdgeLon = centerLon - 180;
  const out: string[] = [];

  const project = (lon: number, lat: number): [number, number] => {
    const lonE = (((lon - leftEdgeLon) % 360) + 360) % 360;
    const x = (lonE / 360) * width;
    const y = ((90 - lat) / 180) * height;
    return [x, y];
  };

  const emitLine = (line: number[][]): void => {
    if (line.length < 2) return;
    let [px, py] = project(line[0][0], line[0][1]);
    out.push(`M${px.toFixed(1)},${py.toFixed(1)}`);
    for (let i = 1; i < line.length; i++) {
      const [x, y] = project(line[i][0], line[i][1]);
      // Detect seam crossing — if x jumps by more than half the canvas
      // width between adjacent vertices, the chord went around the
      // back of the globe and we don't want to draw a flat line
      // across the map.
      if (Math.abs(x - px) > halfW) {
        out.push(`M${x.toFixed(1)},${y.toFixed(1)}`);
      } else {
        out.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
      }
      px = x;
      py = y;
    }
  };

  for (const g of data.geometries) {
    if (g.type === 'LineString') {
      emitLine(g.coordinates as number[][]);
    } else if (g.type === 'MultiLineString') {
      for (const line of g.coordinates as number[][][]) {
        emitLine(line);
      }
    }
  }

  return out.join('');
}
