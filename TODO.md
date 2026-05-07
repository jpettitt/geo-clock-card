# TODO

## Stage 1 — minimum viable visual

- [x] Project scaffold (rollup, ts, vitest, hacs.json)
- [x] Solar math (`sun.ts`) with tests
- [x] Terminator polygon (`terminator.ts`) with tests
- [x] Equirectangular projection (`projection.ts`) with tests
- [x] Lit element with SVG mask + feathered terminator
- [x] Local time + UTC + date readout
- [x] NASA Blue/Black Marble fetch script
- [ ] First in-Home-Assistant test (pending user verification)
- [ ] HACS metadata polish + first tagged release

## Stage 2 — time-zone affordances

- [x] Hour band across the top: 1..12 numbers per 15° column, noon/midnight highlighted
- [x] Tick marks at 15° intervals
- [x] CSS theming hooks (`--geo-tz-*`)
- [x] Recenter the map on the antimeridian (Geochron-style: Pacific in the middle, dateline at center)
- [x] Real political time-zone boundary overlay (Natural Earth 10m, simplified to ~62 KB via mapshaper)
- [x] Tick on seconds (default `updateInterval: 1`)
- [ ] Dateline indicator (`Friday ◀ ▶ Thursday`) — now feasible since the dateline runs through the center; deferred for user feedback first

## Stage 3 — decisions deferred to here

- [ ] Monthly Blue Marble variant (auto-pick by current month)
- [ ] Better terminator: WebGL/canvas with sun-elevation alpha + tinted twilight
- [ ] Bundling strategy: ship imagery in HACS package vs. fetch on first load vs. CDN
- [ ] Optional: location pins (config + HA zones)
- [ ] Optional: alternate projection (Mercator)
- [ ] Optional: Lovelace visual config editor

## Quality / housekeeping (ongoing)

- [ ] Add a render snapshot test using JSDOM to lock in SVG output for fixed timestamps
- [ ] Storybook-ish demo page in `dev/` for local visual iteration without HA
- [ ] CI: GitHub Actions running `npm test` and `npm run build`
