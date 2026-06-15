# geo-clock-card

[![GitHub Release](https://img.shields.io/github/release/jpettitt/geo-clock-card.svg?style=for-the-badge)](https://github.com/jpettitt/geo-clock-card/releases)
[![License](https://img.shields.io/github/license/jpettitt/geo-clock-card.svg?style=for-the-badge)](LICENSE)
[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://hacs.xyz)
[![Maintenance](https://img.shields.io/maintenance/yes/2026?style=for-the-badge)](https://github.com/jpettitt/geo-clock-card)

[![Add Repository](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jpettitt&repository=geo-clock-card&category=plugin)

A Home Assistant Lovelace card that turns one of your dashboards into a live
world clock, modeled on the Geochron® style (no affiliation). NASA Blue Marble
(day) and Black Marble (night) imagery, a real day/night terminator computed
from solar geometry, and DST-aware hover popups for every IANA time zone on
the planet.

🌍 **Live demo:** <https://geoclock.world>

![preview](docs/web/preview.png)

## What it does

- **World map** — NASA Blue Marble + Black Marble imagery, with the live
  day/night boundary recomputed from the subsolar point. 24 daylight
  composites (start + mid of each month, sampled from NASA SVS daily frames)
  swap automatically through the year so vegetation and snow cover follow
  the seasons.
- **Twilight glow** — warm sunrise/sunset rim along the terminator, screen-
  blended over the day side.
- **Hour band** — 25 column meridians at every 15° of longitude, with the
  current local hour highlighted at noon and midnight.
- **Time-zone overlay**:
  - 25 visible 15° offset bands across the globe.
  - 419 IANA polygons sitting invisibly on top — hover (or tap on
    mobile) and a popup shows DST-aware live time, the long zone name
    (EDT vs EST auto-switches), the current offset, the IANA tzid, the
    local date (handy when the remote zone has rolled to a different
    day), and the hovered region outlines itself for visual feedback.
  - Time and date follow the **browser's locale** (24-hour vs AM/PM,
    weekday/month language).
  - Open ocean / Antarctic strips with no IANA polygon fall through to
    the offset band's popup.
- **Centering modes** — `sun` (default, subsolar point — the daylit
  hemisphere stays in the middle and the map slowly drifts),
  `home` (your HA-configured longitude), `longitude` (any numeric
  value), or `entity` (follow a zone / person / device-tracker entity).
  All non-`sun` modes fall back to **Greenwich (lon=0°)** with a
  console warning when their data isn't available — so a misconfigured
  mode looks visibly different from `sun` instead of silently behaving
  the same.
- **Home marker** — optional dot at your HA-configured location that
  tracks the map's drift, with an opt-in label + current local time
  beneath it.
- **Location markers** — pin any list of HA entities (zones, persons,
  device-trackers) on the map; each shows the entity's label and the
  current local time at that zone (DST-aware, looked up from its
  longitude/latitude). Labels are always-visible by default; flip to
  hover-only if you'd rather keep the map tidy. The weekday is
  appended to the time so a marker on the far side of the planet
  whose date has rolled over is obvious at a glance — toggle off if
  you want time-only. Per-marker color, or a card-wide default that
  themes can override via `--geo-marker-color`.
- **Main-clock time source** — the wall-clock readout can read from
  your HA location (default), the viewing device, or any HA entity
  with a longitude/latitude. *(Breaking change in v0.2.0: pre-0.2.0
  cards behaved as if the source was the viewing device. Set
  `mainTimeSource: device` to keep the old behavior.)*
- **Time scrubbing** — freeze the clock at any UTC moment via `now: …`
  for screenshots or to preview the look at, say, the December solstice.
- **Visual editor** — opens automatically when adding the card; advanced
  visual knobs collapse into an expansion panel so the form stays clean.
- **Tunable** — twilight band size, glow color/opacity, day brightness,
  night contrast, time-zone line color, all via card config or CSS
  variables.
- **Cheap** — clock readout ticks every second; the map only recomputes
  when the subsolar point would have moved ≥ 0.5 px on a 4K display
  (≈ every 10.5 s). When the card is off-screen or the browser tab is
  backgrounded the timer drops to a 30-minute cadence; refreshes
  immediately when the card becomes visible again.

## Install

### HACS (recommended)

[![Add Repository](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jpettitt&repository=geo-clock-card&category=plugin)

1. Click the badge above (it deep-links to your HA instance) — or
   manually go HACS → ⋮ → **Custom repositories** → add
   `https://github.com/jpettitt/geo-clock-card`, category **Lovelace**.
2. Install **Geo Clock Card** from HACS.
3. Refresh the browser. HACS adds the resource for you; otherwise:
   Settings → Dashboards → ⋮ → **Resources** → add
   `/hacsfiles/geo-clock-card/geo-clock-card.js` as a **JavaScript Module**.
4. Add a card to your dashboard:

   ```yaml
   type: custom:geo-clock-card
   ```

### Manual

1. Clone the repo and build:

   ```bash
   git clone https://github.com/jpettitt/geo-clock-card
   cd geo-clock-card
   npm install
   npm run fetch-assets   # downloads NASA imagery + IANA TZ polygons
   npm run build
   ```

2. Copy the entire `dist/` directory into your Home Assistant config:

   ```text
   <config>/www/community/geo-clock-card/
       geo-clock-card.js
       blue-marble-*-2048.jpg
       black-marble-2048.jpg
       timezones.json
       timezones-iana.json
   ```

3. Add the resource:
   Settings → Dashboards → ⋮ → **Resources** →
   `/local/community/geo-clock-card/geo-clock-card.js`, type **JavaScript Module**.
4. Add the card with `type: custom:geo-clock-card`.

## Configuration

A visual editor opens automatically when you add the card from the Lovelace
picker. Every option is also settable in YAML:

```yaml
type: custom:geo-clock-card

# Map centering — sun (default) | home | longitude | entity
center: sun
centerLongitude: -119       # required when center: longitude. -180..180.
centerEntity: zone.home     # required when center: entity. Must expose a longitude attribute.
showHomeMarker: false       # render a dot at hass.config.latitude/longitude
showHomeMarkerLabel: false  # also show home name + current local time under the dot

# Imagery + atmosphere (under "Advanced visual settings" in the editor)
dayBrightness: 1.15         # CSS brightness() on the day layer (0.5..2.0)
nightContrast: 1.0          # CSS contrast() on the night layer (0.5..3.0)
twilightDegrees: 8          # half-band of the day/night fade, sun-elevation degrees (1..18)
twilightColor: "#463701"    # hex / rgb / rgba / hsl / named color
twilightOpacity: 0.26       # 0..1
timezoneLineColor: "rgba(255, 255, 255, 0.18)"  # any CSS color string

# Time
updateInterval: 1           # seconds between clock-readout ticks (1..600).
                            # The map repaints on a separate auto-throttled timer;
                            # both drop to 30 minutes when the card is off-screen.
now: "2024-12-21T09:21:00Z" # freeze the clock at this moment (omit for live)

# Main-clock time source — home (default) | device | entity
# - 'home'   reads hass.config.time_zone (the HA-configured zone)
# - 'device' uses the viewing browser's zone (pre-0.2.0 behavior)
# - 'entity' picks the IANA zone of an HA entity's lat/lon
mainTimeSource: home
mainTimeEntity: zone.work   # required when mainTimeSource: entity

# Location markers — list of HA entities to pin on the map.
# Each entity must expose numeric `latitude` and `longitude` attributes.
markers:
  - entity: zone.work
    label: Office            # optional — defaults to the entity's friendly_name
    color: "#3da9fc"         # optional — defaults to markerColor
  - entity: person.alice
markerLabelMode: always     # always | hover
markerColor: "#3da9fc"      # default fill for markers without their own color
                            # — omit (or unset) to let `--geo-marker-color` win
markerShowDay: true         # append weekday after the time (e.g. "12:22 PM Friday")

# Overlays
showTimezoneBand: true      # hour-of-day numbers across the top
showTimezoneBoundaries: true # IANA hover/identify popup hit layer
showTimezoneRegions: true   # 15° offset rectangle bands (defaults to
                            # showTimezoneBoundaries; set independently to
                            # show the bands as chrome without the popup)
showTimezonePopup: true     # live-time popup on hover/tap
showUTC: true               # UTC time below the local clock

# Localization (optional; defaults to the browser/runtime locale)
locale: ""                  # BCP-47 tag, e.g. "fr-FR" or "ja-JP".
                            # Governs the popup's localized timezone
                            # name, the clock readout, marker times, and
                            # the 12/24-hour choice. Empty = follow the
                            # viewer's browser language.

# Bundle resolution (rarely needed; not exposed in the visual editor)
imageryBase: ""             # override the assets URL (e.g. host on a CDN)
```

### Centering modes

- **`sun`** (default) — centered on the current subsolar longitude. The map
  drifts westward as the sun moves; the daylit hemisphere stays in the middle.
- **`home`** — centered on `hass.config.longitude`. Falls back to **Greenwich
  (0°)** with a `console.warn` if HA hasn't reported a longitude.
- **`longitude`** — centered on a numeric `centerLongitude` value. Falls back
  to **Greenwich (0°)** if the value is missing or non-numeric.
- **`entity`** — centered on the longitude attribute of an HA entity. Works
  with `zone.*`, `person.*`, and most `device_tracker.*` entities. Falls back
  to **Greenwich (0°)** if the entity is missing or has no numeric longitude.

The Greenwich fallback is deliberate — it's visually distinct from `sun`
mode so a misconfiguration doesn't silently look right. Watch the browser
console for a one-off warn line that names the broken field.

### Theme via CSS variables

The card respects HA dashboard themes via custom-element CSS variables. Drop
these in your theme YAML (or use `card-mod`) to override without touching the
card config:

```yaml
geo-clock-card:
  --geo-day-brightness: 1.2
  --geo-night-contrast: 1.0
  --geo-twilight-color: "#5a4a1a"
  --geo-twilight-opacity: 0.3
  --geo-tz-bg: rgba(8, 14, 28, 0.85)
  --geo-tz-noon: "#ffd866"
  --geo-tz-mid: "#6ab0ff"
  --geo-tz-line: rgba(255, 255, 255, 0.18)
  --geo-home-marker: var(--accent-color, "#ff7a3d")
  --geo-marker-color: "#3da9fc"
```

Most of these have a matching named config option (e.g. `dayBrightness`
→ `--geo-day-brightness`); set in YAML when you're tweaking a single
card, or in a theme when you want every dashboard's geo-clock to match.

## Imagery sources (all public domain)

| Layer | Source | Resolution |
| --- | --- | --- |
| Day (Blue Marble) | NASA SVS dataset 3523, daily frames interpolating monthly Blue Marble Next Generation composites | 2048 × 1024 JPEG, 24 frames (start + mid of each month) |
| Night (Black Marble) | NASA "Earth at Night" 2012 composite | 2048 × 1024 JPEG |
| Time-zone offsets | Generated as 25 × 15° rectangle bands | 8 KB GeoJSON |
| Time-zone IANA | [timezone-boundary-builder](https://github.com/evansiroky/timezone-boundary-builder) 2026b, simplified to 1% retention | ~960 KB GeoJSON |

## Develop

```bash
npm install
npm run fetch-assets    # one-time: pulls + resizes imagery, downloads + simplifies TZ data
npm test                # vitest — solar math, projection, polygon, IANA helpers
npm run build           # rollup → dist/geo-clock-card.js + copies assets
npm run dev             # rollup --watch
```

A standalone preview lives at [`dev/index.html`](dev/index.html). Run a static
server from the repo root (`python3 -m http.server 8765`) and open
<http://localhost:8765/dev/index.html>. The preview gives you sliders for
twilight band, day brightness, night contrast, twilight color/opacity,
center mode, time-scrubbing with solstice/equinox presets, etc.

## How the pieces fit together

- [`src/sun.ts`](src/sun.ts) — subsolar point + sun-elevation math (USNO low-precision formulas).
- [`src/terminator.ts`](src/terminator.ts) — terminator polygon and curve, parameterized by center longitude.
- [`src/projection.ts`](src/projection.ts) — equirectangular projection with arbitrary center.
- [`src/timezones.ts`](src/timezones.ts) — offset overlay (25 rectangle bands + popup data).
- [`src/timezones-iana.ts`](src/timezones-iana.ts) — IANA polygon hit-testing layer + DST-aware `Intl.DateTimeFormat` wrapper.
- [`src/timezone-band.ts`](src/timezone-band.ts) — top-of-map hour band + tick lines.
- [`src/day-image.ts`](src/day-image.ts) — picks the right monthly daylight image for a given date.
- [`src/geo-clock-card.ts`](src/geo-clock-card.ts) — the Lit element that wires it all together.
- [`src/geo-clock-card-editor.ts`](src/geo-clock-card-editor.ts) — visual config editor (HA `ha-textfield` / `ha-switch` / `ha-formfield` / `ha-selector` / `ha-expansion-panel`, plus native `<select>` for the centering / time-source / marker-mode dropdowns where `ha-select` was unreliable). Awaits `loadCardHelpers()` before rendering so the entity selectors register correctly. Lazy-loaded by the card via `getConfigElement()` and bundled inline.

The original design notes are in [`DESIGN.md`](DESIGN.md).

## License

MIT for the code. NASA imagery is public domain. timezone-boundary-builder
data is ODbL.

Geochron® is a registered trademark of Geochron Enterprises Inc.; this
project is not affiliated with or endorsed by them.
