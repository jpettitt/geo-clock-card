# GeoClock New Tab (Chrome extension)

Replaces Chrome's new-tab page with a live world day/night clock — the
same `geo-clock-card` that powers [geoclock.world](https://geoclock.world)
and the Home Assistant card, rendered full-window and letterboxed to fit.

Everything ships inside the extension — the card bundle, all 24 monthly
NASA Blue Marble frames, the Black Marble night image, and the timezone
GeoJSON — so it runs **fully offline**. No telemetry, no network calls
except the optional place-name search (Nominatim) when you add a marker
by name.

## Build

```sh
chrome-extension/build.sh        # rebuilds the card, then assembles build/
```

This produces `chrome-extension/build/` — a flat, loadable extension
directory (~15 MB). It is generated and git-ignored; the source lives in
`chrome-extension/` and the assets come from the card's `dist/`.

## Install (unpacked)

1. Run the build above.
2. Open `chrome://extensions`.
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked** and choose `chrome-extension/build/`.
5. Open a new tab.

## Use

- Click **⚙ Customize** (top-right) to set the center (sun / fixed
  longitude / your location), add markers by place name or your current
  location, pick day/night marker colors and a locale, and toggle the
  hour band, timezone hover, and UTC line.
- Settings are saved in the browser and restored on every new tab.

## Permissions

- **geolocation** — only used if you choose "center on my location" or add
  a "my location" marker; resolved live, never stored in a shareable link.
- **host access to `nominatim.openstreetmap.org`** — only used for
  place-name search when adding a marker by name.

## Layout

The page letterboxes (never crops): it shows the whole map with black
bars on the short axis, so the marker overlay always aligns with the map.
The card publishes its aspect ratio as the `--geo-frame-ar` CSS variable;
`newtab.js` mirrors that onto `<html>` so the CSS can size the card to the
largest box of that ratio which fits the window.
