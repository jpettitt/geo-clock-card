// Aggregate Natural Earth time-zones GeoJSON: group features by `zone`,
// merge their geometries into a single MultiPolygon per zone, build a
// deduplicated `places` string ordered by population priority, and
// attach a canonical zone name (e.g. "Atlantic Standard Time").
//
// The source has 2–6 polygons per zone (continental + ocean + polar
// strips), each with its own `places` value. If mapshaper's
// `-dissolve` is asked to merge by zone it only keeps the first
// feature's `places`, which is often a polar/oceanic strip. By doing
// the aggregation here we preserve the country info AND surface the
// most populous countries first, so the popup truncation in the card
// never hides the biggest places in a zone.
//
// Usage: node scripts/aggregate-tz.mjs <in.geojson> <out.geojson>

import { readFileSync, writeFileSync } from 'node:fs';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('Usage: node aggregate-tz.mjs <in.geojson> <out.geojson>');
  process.exit(1);
}

// Canonical, internationally-recognizable name per offset. Keys are
// the numeric `zone` value from Natural Earth (negatives = west of
// Greenwich, fractional for half/quarter-hour offsets). Where two
// names compete (e.g. UTC+3 = Moscow Time or East Africa Time), we
// pick whichever is more globally recognised.
const ZONE_NAMES = {
  '-12': 'International Date Line West',
  '-11': 'Samoa Standard Time',
  '-10': 'Hawaii–Aleutian Standard Time',
  '-9.5': 'Marquesas Time',
  '-9': 'Alaska Standard Time',
  '-8': 'Pacific Standard Time',
  '-7': 'Mountain Standard Time',
  '-6': 'Central Standard Time',
  '-5': 'Eastern Standard Time',
  '-4.5': 'Venezuelan Standard Time',
  '-4': 'Atlantic Standard Time',
  '-3.5': 'Newfoundland Standard Time',
  '-3': 'Brazil Time',
  '-2': 'Mid-Atlantic Time',
  '-1': 'Cape Verde Time',
  '0': 'Greenwich Mean Time',
  '1': 'Central European Time',
  '2': 'Eastern European Time',
  '3': 'Moscow / East Africa Time',
  '3.5': 'Iran Standard Time',
  '4': 'Gulf Standard Time',
  '4.5': 'Afghanistan Time',
  '5': 'Pakistan Standard Time',
  '5.5': 'India Standard Time',
  '5.75': 'Nepal Time',
  '6': 'Bangladesh Standard Time',
  '6.5': 'Myanmar Time',
  '7': 'Indochina Time',
  '8': 'China Standard Time',
  '8.75': 'Australian Central Western Time',
  '9': 'Japan Standard Time',
  '9.5': 'Australian Central Standard Time',
  '10': 'Australian Eastern Standard Time',
  '10.5': 'Lord Howe Standard Time',
  '11': 'Solomon Islands Time',
  '11.5': 'Norfolk Time',
  '12': 'New Zealand Standard Time',
  '12.75': 'Chatham Standard Time',
  '13': 'Tonga Time',
  '14': 'Line Islands Time',
};

// Rough population priority. A token is matched if it *starts with*
// any of these names (so "United States (California, …)" matches
// "United States"). Lower index → higher priority. Tokens not in
// this list keep their original ordering relative to each other.
// List is ~top 50 by population, plus a handful of well-known
// medium-population countries to fill out smaller zones.
const POPULATION_PRIORITY = [
  'China', 'India', 'United States', 'Indonesia', 'Pakistan',
  'Brazil', 'Nigeria', 'Bangladesh', 'Russia', 'Mexico',
  'Japan', 'Ethiopia', 'Philippines', 'Egypt', 'Vietnam',
  'DR Congo', 'Iran', 'Turkey', 'Germany', 'Thailand',
  'France', 'United Kingdom', 'South Africa', 'Italy', 'Tanzania',
  'Myanmar', 'South Korea', 'Colombia', 'Kenya', 'Spain',
  'Argentina', 'Algeria', 'Sudan', 'Uganda', 'Iraq',
  'Poland', 'Canada', 'Morocco', 'Saudi Arabia', 'Ukraine',
  'Angola', 'Uzbekistan', 'Peru', 'Malaysia', 'Mozambique',
  'Ghana', 'Yemen', 'Nepal', 'Venezuela', 'Madagascar',
  'Australia', 'North Korea', 'Cameroon', 'Niger', 'Sri Lanka',
  'Romania', 'Côte d’Ivoire', "Côte d'Ivoire", 'Mali',
  'Chile', 'Kazakhstan', 'Zambia', 'Guatemala', 'Ecuador',
  'Cuba', 'Belgium', 'Greece', 'Portugal', 'Sweden',
  'Czech Republic', 'Czechia', 'Hungary', 'Israel', 'Austria',
  'Switzerland', 'Norway', 'Finland', 'Denmark', 'Ireland',
  'New Zealand', 'Singapore', 'Iceland',
];

const PRIORITY_INDEX = new Map();
POPULATION_PRIORITY.forEach((name, i) => {
  if (!PRIORITY_INDEX.has(name)) PRIORITY_INDEX.set(name, i);
});

const isGeneric = (token) =>
  /\b(Ocean|Sea|Antarctica|Station|Stations|Arctic|Southern Ocean)\b/i.test(token);

const tokenPriority = (token) => {
  for (const [name, idx] of PRIORITY_INDEX) {
    if (token.startsWith(name)) return idx;
  }
  return Number.MAX_SAFE_INTEGER;
};

const data = JSON.parse(readFileSync(inPath, 'utf8'));

const groups = new Map();
for (const f of data.features) {
  const zone = f.properties.zone;
  let g = groups.get(zone);
  if (!g) {
    g = {
      zone,
      time_zone: f.properties.time_zone ?? null,
      polygons: [],
      tokenOrder: [],
      tokenSet: new Set(),
    };
    groups.set(zone, g);
  }
  if (!g.time_zone && f.properties.time_zone) {
    g.time_zone = f.properties.time_zone;
  }
  for (const raw of (f.properties.places ?? '').split(',')) {
    const t = raw.trim();
    if (t && !g.tokenSet.has(t)) {
      g.tokenSet.add(t);
      g.tokenOrder.push(t);
    }
  }
  const geom = f.geometry;
  if (!geom) continue;
  if (geom.type === 'Polygon') {
    g.polygons.push(geom.coordinates);
  } else if (geom.type === 'MultiPolygon') {
    for (const p of geom.coordinates) g.polygons.push(p);
  }
}

// Build clean rectangular zone bands instead of using the source's
// country-shaped polygons. Three reasons:
//   1. The Natural Earth source represents each zone as one big
//      polygon that includes both the continental landmass AND its
//      Antarctic strip, joined by an ocean corridor. Simplifying
//      that for the visible overlay produces ugly diagonal
//      "triangular" artifacts at the poles.
//   2. The visible offset overlay's job is to mark the 15°
//      meridian zones — country shapes belong on the IANA layer.
//   3. Rectangles are trivially valid polygons; no simplification
//      noise, no seam edge cases beyond the standard wrap.
//
// Fractional zones (5:30, 5:45, etc.) are dropped from the
// rectangle set — their accurate info comes via the IANA layer.
// We still aggregate their `places` into the parent whole-hour
// band so the offset hover fallback still mentions them.
const features = [];
for (const g of groups.values()) {
  // Skip fractional zones for visible boundaries.
  if (!Number.isInteger(g.zone)) continue;
  if (g.zone < -12 || g.zone > 12) continue;

  // Sort places: country-priority first, generics last.
  const ranked = g.tokenOrder
    .map((t, i) => ({
      t,
      i,
      generic: isGeneric(t),
      pri: tokenPriority(t),
    }))
    .sort((a, b) => {
      if (a.generic !== b.generic) return a.generic ? 1 : -1;
      if (a.pri !== b.pri) return a.pri - b.pri;
      return a.i - b.i;
    })
    .map((x) => x.t);

  const name = ZONE_NAMES[String(g.zone)] ?? null;
  const lonWest = g.zone * 15 - 7.5;
  const lonEast = g.zone * 15 + 7.5;

  features.push({
    type: 'Feature',
    properties: {
      zone: g.zone,
      time_zone: g.time_zone,
      name,
      places: ranked.join(', '),
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [lonWest, 90],
        [lonEast, 90],
        [lonEast, -90],
        [lonWest, -90],
        [lonWest, 90],
      ]],
    },
  });
}

writeFileSync(outPath, JSON.stringify({ type: 'FeatureCollection', features }));
console.error(`Aggregated ${data.features.length} → ${features.length} zones`);
