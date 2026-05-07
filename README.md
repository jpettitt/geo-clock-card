# geo-clock-card

A Home Assistant Lovelace custom card that displays a world map with a live day/night terminator, modeled on the Geochron® world clock (no affiliation). Uses NASA Blue Marble (day) and Black Marble (night) imagery — both public domain.

> **Status:** stage 1 — minimum viable visual. Map + terminator + clock.
> Time-zone band, location pins, and projection options are coming in later stages.

## Features (stage 1)

- World map in equirectangular projection.
- Live terminator with a soft twilight fade, computed from real solar geometry (subsolar point + sun-elevation, accurate to ≤ 0.01°).
- Local time (with time-zone abbreviation) + UTC time + date.
- One config option that matters: how soft you want the dawn/dusk fade.

## Install

### HACS (custom repository)

1. HACS → Frontend → ⋮ → Custom repositories → add this repo, category "Lovelace".
2. Install **Geo Clock Card**.
3. Add the resource (HACS does this automatically) and refresh.

### Manual

1. Build the bundle: `npm install && npm run fetch-imagery && npm run build`.
2. Copy `dist/geo-clock-card.js`, `dist/blue-marble-2048.jpg`, and `dist/black-marble-2048.jpg` to `<config>/www/geo-clock-card/`.
3. Settings → Dashboards → ⋮ → Resources → add `/local/geo-clock-card/geo-clock-card.js` as a Module.

## Use

```yaml
type: custom:geo-clock-card
```

That's it for the default. With every option:

```yaml
type: custom:geo-clock-card
twilightDegrees: 9        # 1 = sharp edge, 18 = very soft. Default 9.
updateInterval: 60        # seconds between repaints. 10–600. Default 60.
showUTC: true             # show UTC time below local. Default true.
imageryBase: ""           # override imagery URL (e.g. host on a CDN).
                          # Default: alongside the bundle.
```

## Imagery

Both maps come from NASA public-domain sources:

- **Day:** Blue Marble Next Generation, August 2004 composite (5400×2700 source, downscaled to 2048×1024). [visibleearth.nasa.gov](https://visibleearth.nasa.gov/collection/1484/blue-marble)
- **Night:** Black Marble 2012, "Earth at Night" (3600×1800 source, downscaled to 2048×1024). [eoimages.gsfc.nasa.gov](https://earthobservatory.nasa.gov/features/IntotheBlack)

Run `npm run fetch-imagery` to download and resize them into `assets/`. The build step copies them into `dist/` alongside the JS bundle.

## How the day/night fade works

The night map is overlaid on the day map and clipped by an SVG `<mask>` whose shape is the terminator polygon — i.e., the boundary where the sun is exactly on the horizon. A `feGaussianBlur` on the mask edge feathers the boundary so the transition isn't a hard line. The width of the fade is controlled by `twilightDegrees`: 9° is roughly civil + a touch of nautical twilight, which looks like real dusk/dawn.

See [DESIGN.md](DESIGN.md) for the full breakdown including alternate approaches considered, solar math, and roadmap.

## Develop

```bash
npm install
npm run fetch-imagery   # one-time: pulls + resizes NASA imagery into assets/
npm test                # vitest, math + projection
npm run build           # rollup → dist/geo-clock-card.js + copies imagery
npm run dev             # rollup --watch
```

## Roadmap

See [TODO.md](TODO.md). High-level:

1. **Stage 1** *(now)* — visual right and working.
2. **Stage 2** — time-zone band across the top (A–Z letters, hour numbers, dateline indicator).
3. **Stage 3** — decisions: monthly Blue Marble variants, atmospheric fade via WebGL, bundling strategy.

## License

MIT for the code. NASA imagery is public domain.

Geochron® is a registered trademark of Geochron Enterprises Inc.; this project is not affiliated with or endorsed by them.
