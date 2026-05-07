# geo-clock-card — Design Document

A Home Assistant custom Lovelace card that displays the world map with a live day/night terminator, modeled on the Geochron® world clock (no affiliation). Uses NASA Blue Marble (day) and Black Marble (night) imagery, both public domain.

> Status: **Draft v0.1** — design only, no code yet. Open questions flagged at the end.

---

## 1. Goals

- A self-contained Lovelace card installable via HACS or manual drop-in.
- Live world map that visibly tracks the sun: day side shows lit Earth, night side shows city lights, with a soft twilight transition between them.
- Local time, UTC time, and date readout.
- Time-zone band across the top (letters A–Z + the standard hour offsets), like the commercial clock.
- Minimal config — works out of the box; advanced options (projection, locations, twilight softness, monthly imagery) available.

## 2. Non-Goals (v0.1)

- No solar/lunar analemma overlay.
- No animated time-scrubbing or "fast-forward" mode.
- No high-precision astronomy (sub-arcminute accuracy). Sun position correct to ≤ 0.1° is fine for a wall clock.
- No 3D / globe view. Flat map only.

## 3. Name

`geo-clock-card`. Generic and descriptive, no trademark on "geo" or "clock". HACS slug, npm package, repo, and Lit element tag will all align (`<geo-clock-card>`).

## 4. Tech Stack

- **Lit 3 + TypeScript** — the standard for HA custom cards.
- **Rollup** + `@rollup/plugin-typescript` for bundling to a single ESM file (`dist/geo-clock-card.js`).
- **Vitest** for unit tests on the math modules.
- **No runtime dependencies** beyond Lit. Everything else (solar math, terminator generation) is in-tree and tiny.
- Rendered output is **SVG**. Reasoning below in §7.

## 5. Map Imagery

### 5.1 Sources

| Layer | Source | License | Native projection |
|-------|--------|---------|-------------------|
| Day   | NASA Blue Marble Next Generation (monthly composites) | Public domain | Equirectangular (Plate Carrée), 2:1 |
| Night | NASA Black Marble (city lights composite) | Public domain | Equirectangular, 2:1 |

Both layers must be the **same projection, same extent, same pixel grid** so they overlay perfectly. NASA distributes both natively in equirectangular at multiple resolutions (up to 86400×43200). For a Lovelace card we want something in the 1024×512 to 4096×2048 range.

### 5.2 Resolution strategy

Ship two sizes:

- `world-2048.jpg` (2048×1024, ~400 KB JPEG q85) — default.
- `world-4096.jpg` (4096×2048, ~1.4 MB) — opt-in for 4K dashboards.

Card picks based on rendered element width × devicePixelRatio.

### 5.3 Monthly variants (optional, v0.2)

Blue Marble Next Generation publishes one composite per month — snow cover and vegetation shift visibly through the year. v0.1 ships a single composite (probably September: balanced snow vs. vegetation). v0.2 may bundle all 12 and pick by current month.

### 5.4 Projection

**Default: equirectangular.** Reasoning:
- NASA imagery is native equirectangular — no resampling, no interpolation artifacts.
- Terminator math is closed-form: a sinusoid in (lon, lat) space.
- Time-zone meridians are vertical lines, evenly spaced — matches the Geochron-style top band exactly.
- 2:1 aspect ratio fits Lovelace tiles well.
- Polar regions remain legible (Mercator destroys them).

**Optional: Mercator** via `projection: mercator` config. Requires:
- Pre-resampling the imagery (the user offered to do this).
- Re-deriving terminator latitudes through the Mercator y = ln(tan(π/4 + φ/2)) transform — straightforward but worth flagging.
- Clipping at ~±85° latitude (Mercator goes to infinity at the poles).

The card's render module abstracts projection behind a single `latLonToPx(lat, lon) → {x, y}` function so adding more projections later is mechanical.

## 6. Solar Geometry

All times internal are UTC. Local time is derived for display only.

### 6.1 Subsolar point

Given UTC date `d` and time `t`:

```
n = days since J2000.0 (= 2000-01-01T12:00:00Z)
L = 280.460° + 0.9856474° · n           # mean longitude
g = 357.528° + 0.9856003° · n           # mean anomaly
λ = L + 1.915°·sin(g) + 0.020°·sin(2g)  # ecliptic longitude
ε = 23.439° − 0.0000004° · n            # obliquity
δ = asin( sin(ε) · sin(λ) )             # declination → subsolar latitude
EoT = (L − α) in minutes                # equation of time, α = right ascension
subsolar_lon = −15° · (UTC_hours − 12) − EoT/4
```

Accurate to ~0.01° — well past what we need. Implemented in `src/sun.ts`, ~40 lines.

### 6.2 Sun elevation at any point

For any (lat, lon) and a known subsolar (δ, λ_s):

```
H = lon − λ_s                           # hour angle
sin(elev) = sin(lat)·sin(δ) + cos(lat)·cos(δ)·cos(H)
```

This is the function we'll evaluate per-pixel (or per terminator vertex).

### 6.3 Terminator curve (equirectangular)

The terminator is the locus where `elev = 0`:

```
tan(lat) = −cos(lon − λ_s) / tan(δ)
```

Sample at 1° lon increments → 360 vertices → close into a polygon by walking around the night-side pole (whichever has |lat_pole| > 90° − |δ|). Special cases:
- `δ ≈ 0` (equinox): terminator is the meridian λ_s ± 90°.
- `|δ|` near max (solstice): polar day/night caps cover the relevant pole.

Implemented in `src/terminator.ts`. Returns an SVG polygon points string.

## 7. Day / Night Compositing — the Fade

This is the heart of the card. The user explicitly asked for the fade design. Three approaches considered; spec'd approach is **A**.

### 7.1 Approach A — SVG `<mask>` with Gaussian-feathered terminator (chosen for v0.1)

Layer stack:

```
<svg>
  <defs>
    <mask id="night-mask">
      <!-- white = show night, black = show day -->
      <rect fill="black" width="100%" height="100%"/>
      <polygon points="..." fill="white" filter="url(#feather)"/>
    </mask>
    <filter id="feather">
      <feGaussianBlur stdDeviation="{σ_px}"/>
    </filter>
  </defs>

  <image href="blue-marble.jpg"  width="100%" height="100%"/>
  <image href="black-marble.jpg" width="100%" height="100%" mask="url(#night-mask)"/>

  <!-- time-zone band, location pins, hour ticks, etc. -->
</svg>
```

**How the fade works:** the mask is a hard-edged terminator polygon. Gaussian blur on the polygon turns the hard edge into a soft gradient — pixels well inside the night polygon end up at full opacity (mask = 255), pixels well outside end up at 0, and pixels near the boundary blend smoothly. The width of the blend equals roughly 2σ on each side.

**Choosing σ.** We want the visual fade band to match real twilight. Civil twilight is sun elevation 0° to −6°. Nautical twilight extends to −12°. A "soft but believable" fade covers ~±9° of sun elevation, i.e. ~18° of arc total. In a 2048-wide equirectangular image:

```
1° arc ≈ 2048 / 360 ≈ 5.7 px
18° fade ≈ 102 px
σ ≈ fade_px / 4 ≈ 25 px           # 4σ ≈ full transition
```

Default `twilightDegrees: 9` (sun elevation half-band, ±9°), tunable from 1 (sharp) to 18 (very soft). Card recomputes σ when the rendered size changes.

**Cost.** Single SVG redraw. Browser GPU-accelerates the blur. Imagery is two `<image>` tags loaded once and never re-fetched. Per tick we update only the polygon `points` attribute → diff is small, no full re-layout.

**Caveats / cosmetic limits.**
1. The blur is symmetric and uniform — twilight in real life isn't (atmosphere refraction, scattering colors). The result looks good, not real.
2. At high latitudes near solstices, the terminator polygon wraps around a pole. The Gaussian blur is computed in pixel space, so near the poles the feather looks slightly squashed in latitude. Acceptable; the polar regions are tiny on the map anyway.
3. The mask has anti-aliased edges in the imagery. JPEG encoding artifacts in the night map (city lights especially) become slightly visible during fade. We'll use q90 JPEG to mitigate.

### 7.2 Approach B — per-pixel canvas with sun-elevation alpha (deferred to v0.2)

Render to `<canvas>`. Each pixel:

```
α_night = smoothstep(+twilight, −twilight, sun_elev_at_pixel)
out = mix(day_pixel, night_pixel, α_night)
```

This is the "physically motivated" version — the fade follows actual sun elevation rather than approximating with a Gaussian. Optionally tint the twilight band (warm orange near elev=0, blue-purple at elev=−6°) for a sunrise/sunset look.

**Cost.** Whole-canvas redraw every tick. At 2048×1024 in JS that's ~2 ms in WASM/typed-array land, ~30 ms in naive JS. With WebGL it's free. Worth doing in v0.2 — the visual upgrade is significant.

**Why not v0.1.** Lovelace cards run inside many other cards on a dashboard. Canvas-based per-tick redraw cost adds up. SVG mask is cheap and good enough. Ship it, then iterate.

### 7.3 Approach C — pre-rendered gradient strip aligned to terminator (rejected)

Build a vertical gradient texture and rotate/position it on the terminator. Works passably in equirectangular but breaks in any non-cylindrical projection, and the fade's *shape* near the poles is wrong (terminator curvature varies with latitude). Rejected.

### 7.4 Day-side dimming (proposed, ask user)

Optional `dayBrightness: 0..1` (default 1.0) and `nightBrightness: 0..1` (default 1.0). Lets users tune the contrast — e.g. dim the city lights to 0.7 if Black Marble looks too vivid against a dark dashboard. Implemented as a CSS `filter: brightness(...)` on each `<image>`.

> **Open UX question:** should the card auto-dim with the dashboard's light/dark theme? E.g. a dark theme dashboard → push night brightness up so cities glow more. Want your input.

## 8. Rendering Architecture

```
GeoClockCard (LitElement)
  ├─ properties
  │    ├─ hass             ← Home Assistant state object
  │    ├─ config           ← lovelace card config
  │    └─ now              ← Date, ticked every updateInterval
  ├─ render()              ← returns html`<svg>...</svg>`
  ├─ updated(changedProps)
  │    └─ if (now changed) recompute terminator polygon + clock text
  └─ disconnectedCallback() ← clear interval

Modules
  src/sun.ts          ← subsolar(date) → {lat, lon}, elevation(lat, lon, sub) → deg
  src/terminator.ts   ← terminatorPolygon(sub, projection, viewport) → SVG points string
  src/projection.ts   ← latLonToPx for equirectangular | mercator
  src/render.ts       ← composeSVG(now, hass, config) → TemplateResult
  src/types.ts        ← GeoClockCardConfig type
  src/geo-clock-card.ts ← LitElement registration + HA lifecycle
```

Pure-function modules (`sun`, `terminator`, `projection`) are unit-tested. `render` is integration-tested via a couple of golden-snapshot SVGs at fixed timestamps (e.g. 2024-06-21T12:00:00Z, 2024-12-21T00:00:00Z, 2024-03-20T06:00:00Z).

## 9. HA Card Configuration

```yaml
type: custom:geo-clock-card
projection: equirectangular     # or mercator
imageSet: world-2048            # world-2048 | world-4096 | custom
month: auto                     # auto | jan..dec   (v0.2)
twilightDegrees: 9              # 1..18, sun-elevation half-band
dayBrightness: 1.0
nightBrightness: 1.0
showTimezoneBand: true
showHourTicks: true
showDateline: true              # the "Friday/Thursday" indicator
showUTC: true
locale: auto                    # auto follows HA user; or e.g. en-US, de-DE
locations:                      # optional pins
  - name: Home
    lat: 39.7392
    lon: -104.9903
  - name: Office
    entity: zone.office         # or pull from HA zones
updateInterval: 60              # seconds. min 10, max 600.
```

Defaults are chosen so `type: custom:geo-clock-card` alone produces something good.

## 10. Update Cadence & Performance

Sun moves 0.25°/min ≈ 1.4 px/min on a 2048-wide map. **60 s tick** is plenty; the eye won't see a stutter. Configurable down to 10 s for the impatient.

Per tick:
- Recompute subsolar (≈ 5 µs).
- Recompute terminator polygon (≈ 0.1 ms; 360 verts, two trig calls each).
- Update one SVG attribute (`points=`) and 1–3 text nodes.
- No image reload, no layout reflow.

Idle cost ≈ 0. Tick cost ≈ < 1 ms. Memory ≈ size of two JPEGs (decoded ≈ 8 MB at 2048×1024 RGBA, kept by the browser image cache; once per card).

## 11. Project Structure

```
geo-clock-card/
├── DESIGN.md                  ← this file
├── README.md                  ← user-facing install + config
├── TODO.md                    ← roadmap, tracked checkboxes
├── package.json
├── tsconfig.json
├── rollup.config.mjs
├── vitest.config.ts
├── src/
│   ├── geo-clock-card.ts
│   ├── render.ts
│   ├── sun.ts
│   ├── terminator.ts
│   ├── projection.ts
│   ├── timezone-band.ts
│   └── types.ts
├── assets/
│   ├── world-2048.jpg         ← merged Blue+Black? no, two files (see §7.1)
│   ├── blue-marble-2048.jpg
│   └── black-marble-2048.jpg
├── test/
│   ├── sun.test.ts
│   ├── terminator.test.ts
│   ├── projection.test.ts
│   └── render.snapshot.test.ts
├── dist/
│   └── geo-clock-card.js      ← built bundle (committed for HACS)
└── hacs.json
```

## 12. Roadmap

**v0.1 — minimum delightful clock**
- [ ] Solar math + tests (`sun.ts`)
- [ ] Terminator polygon + tests (`terminator.ts`)
- [ ] Equirectangular projection + tests
- [ ] Lit element shell + HA lifecycle
- [ ] Blue/Black Marble assets at 2048
- [ ] SVG compositing with feathered mask (Approach A)
- [ ] Local + UTC time display, current date
- [ ] HACS manifest + README

**v0.2 — feature parity with the commercial inspiration**
- [ ] Time-zone band across top (A–Z letters, hour numbers)
- [ ] Dateline indicator (Friday/Thursday triangle markers)
- [ ] Hour ticks across the top edge
- [ ] Mercator projection option
- [ ] 4096 imagery option

**v0.3 — polish**
- [ ] Monthly Blue Marble variants
- [ ] Location pins (configured + HA zones)
- [ ] Lovelace visual editor (gui-config form)
- [ ] WebGL/canvas atmospheric fade (Approach B) as opt-in `renderer: webgl`
- [ ] Light/dark theme auto-dim

## 13. Open Questions for the User

1. **Theme integration** (§7.4) — auto-dim with HA dark/light theme, or always full brightness?
2. **Time-zone band** — do you want the full Geochron-style band (A-Z letters + hour numbers + tick marks) in v0.1, or push it to v0.2?
3. **Default location for the local-time display** — pull from the HA `home` zone, or require explicit config?
4. **Imagery delivery** — bundle JPEGs into the HACS package (~800 KB total), or fetch from a CDN/NASA on first load?
5. **Date format** — follow HA user locale, or expose `dateFormat:` config?
6. **Card aspect ratio** — fix at 2:1 (matches equirectangular), or let Lovelace size freely with the map letterboxed?

---

*End of design.*
