# TODO

## Stage 1 — minimum viable visual

- [x] Project scaffold (rollup, ts, vitest, hacs.json)
- [x] Solar math (`sun.ts`) with tests
- [x] Terminator polygon (`terminator.ts`) with tests
- [x] Equirectangular projection (`projection.ts`) with tests
- [x] Lit element with SVG mask + feathered terminator
- [x] Local time + UTC + date readout
- [x] NASA Blue/Black Marble fetch script
- [x] First in-Home-Assistant test
- [x] HACS metadata polish + first tagged release (v0.1.x shipped, v0.2.0 in flight)

## Stage 2 — time-zone affordances

- [x] Hour band across the top: 1..12 numbers per 15° column, noon/midnight highlighted
- [x] Tick marks at 15° intervals
- [x] CSS theming hooks (`--geo-tz-*`)
- [x] Recenter the map on the antimeridian (Geochron-style: Pacific in the middle, dateline at center)
- [x] Real political time-zone boundary overlay (Natural Earth 10m, simplified to ~62 KB via mapshaper)
- [x] Tick on seconds (default `updateInterval: 1`)
- [ ] Dateline indicator (`Friday ◀ ▶ Thursday`) — now feasible since the dateline runs through the center; deferred for user feedback first

## Stage 3 — decisions deferred to here

- [x] Monthly Blue Marble variant (auto-pick by current month) — 24 frames (start + mid each month) shipped via day-image.ts
- [ ] Better terminator: WebGL/canvas with sun-elevation alpha + tinted twilight
- [x] Bundling strategy: imagery ships alongside the JS bundle in dist/, copied by HACS / manual install
- [x] Location pins (config + HA zones) — `markers:` array with per-marker label + color, always-visible or hover label modes
- [x] Configurable main-clock time source (home/device/entity, default `home`) — **breaking change** in 0.2.0: pre-0.2.0 cards behaved like `device`
- [ ] Optional: alternate projection (Mercator)
- [x] Lovelace visual config editor

## Quality / housekeeping (ongoing)

- [ ] Add a render snapshot test using JSDOM to lock in SVG output for fixed timestamps
- [ ] Storybook-ish demo page in `dev/` for local visual iteration without HA
- [ ] CI: GitHub Actions running `npm test` and `npm run build`
