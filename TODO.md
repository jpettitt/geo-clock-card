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
- [x] CI: GitHub Actions running `npm test` and `npm run build` (release.yml + deploy-site.yml)
- [x] Optimize IANA timezone lookup performance via 4-decimal coordinates caching (v0.2.3)
- [x] Fix out-of-bounds wrapped longitudes in timezone polygon searches (v0.2.3)
- [x] Retain and preserve custom alpha transparency in Lovelace visual color editor pickers (v0.2.3)

## v0.2.6

- [x] Day/night marker colors (opt-in): per-marker `dayColor`/`nightColor`
      + card-level `markerDayColor`/`markerNightColor`; each dot recolors
      live as the terminator crosses its location (matches the wallpaper
      app). Exposed in the visual editor and YAML. Existing single-color
      cards unchanged.
- [x] geoclock.world config panel: slide-out "Customize" — set center
      (sun / fixed longitude / your location), add markers by place name
      (Nominatim) or geolocation, day/night marker colors, and toggle the
      hour band / TZ boundaries / UTC line. Round-trips through readable
      URL params (History API) for shareable links + opt-in localStorage.
- [x] Refactor the HA-impedance-matching (expandShortcuts) + mount helpers
      out of wallpaper.html into a shared headless module
      (geoclock-config.js) imported by both web pages.

## v0.2.5 (stable)

- [x] Ultrawide / letterbox rendering: night mask, twilight glow, hour band,
      and TZ boundaries wrap-tile across the seam so they fill displays wider
      than the 2048×1068 viewBox (fullscreen + wallpaper use cases)
- [x] Render performance: memoized terminator geometry, rAF-throttled hover,
      quantized TZ re-projection (0.5° threshold), `<use>`-ref wrap copies
      instead of duplicated subtrees, non-reactive TZ polygon fields (no
      double render)
- [x] Work around WebKit filtered-mask viewport clip (night layer truncating
      with a hard edge that moved with aspect-fit mode)
- [x] Coarsen + cap the IANA tz cache (~1 km keys, 512-entry bound) so moving
      device_trackers can't grow it unbounded
- [x] Restrict `imageryBase` to http(s)/page-scheme (config can arrive from a
      URL param on the demo page)
- [x] Editor: NaN guard on number fields, twilight-color hex normalization,
      corrected brightness/contrast ranges and entity-fallback help text
- [x] Short weekday in marker times ("Wed" not "Wednesday")
- [x] Deploy hygiene: CI enforces ASSET_BASE pins match package.json and
      refuses to overwrite an immutable versioned path with changed content
