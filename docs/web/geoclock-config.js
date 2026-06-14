// geoclock-config.js — shared, HEADLESS config plumbing for the
// web deployments of geo-clock-card.
//
// Imported by BOTH index.html (the configurable demo page) and
// wallpaper.html (the chrome-less screenshot/wallpaper renderer).
// It contains only the impedance-matching between a plain config
// object and the HA-shaped `(config, hass)` the card expects —
// NO UI, NO URL parsing, NO storage. Keep it that way:
//
//   - The macOS wallpaper app loads wallpaper.html, which imports
//     this module. Anything UI-ish added here would leak controls
//     into the wallpaper renderer.
//   - The config PANEL (markers editor, geocoding, param codec,
//     localStorage) lives in geoclock-webconfig.js, which ONLY
//     index.html imports.
//   - The HA card bundle (built from src/) never imports either of
//     these files, so none of this reaches Home Assistant.

/**
 * Walk a plain config and synthesize a `hass` stub for the
 * convenience shortcuts the web/wallpaper callers use instead of a
 * real Home Assistant back-end:
 *
 *   - markers: [{label, latitude, longitude, color}] (no entity)
 *       → a synthetic entity ID + hass.states entry per marker
 *   - centerLatitude + centerLongitude
 *       → hass.config.latitude/longitude (+ center:'home' if unset)
 *   - mainTimeZone
 *       → hass.config.time_zone (+ mainTimeSource:'home')
 *
 * Returns `{ config, hass }` ready for setConfig() + the card's
 * `hass` property. The input config is not mutated (shallow clone).
 */
export function expandShortcuts(cfg, hass) {
  const out = { ...(cfg || {}) };
  const stub = {
    config: { ...(hass?.config || {}) },
    states: { ...(hass?.states || {}) },
  };

  // mainTimeZone shortcut → push to hass.config.time_zone and pin
  // mainTimeSource to 'home' (which reads that field).
  if (typeof out.mainTimeZone === 'string' && out.mainTimeZone) {
    stub.config.time_zone = out.mainTimeZone;
    out.mainTimeSource = 'home';
    delete out.mainTimeZone;
  }

  // centerLatitude + centerLongitude shortcut → hass.config
  // latitude/longitude, which the 'home' centering mode reads
  // directly.
  //
  // DELIBERATE: this requires BOTH coordinates. The macOS app's
  // manual-centering mode sends `center: 'longitude'` +
  // `centerLongitude` only, and that case must fall through to the
  // card's native center:'longitude' handling untouched —
  // synthesizing a home from it would re-introduce a phantom
  // home-marker at the centering point (a bug we fixed). Don't
  // "improve" this into a longitude-only branch.
  if (
    typeof out.centerLatitude === 'number' &&
    typeof out.centerLongitude === 'number' &&
    !out.centerEntity
  ) {
    stub.config.latitude = out.centerLatitude;
    stub.config.longitude = out.centerLongitude;
    if (!out.center) out.center = 'home';
  }

  // Inline-coordinate markers → synthesize an entity per marker so
  // the card's hass-based resolution finds them.
  if (Array.isArray(out.markers)) {
    out.markers = out.markers.map((m, i) => {
      if (m.entity) return m;
      const id = `web.marker_${i}`;
      stub.states[id] = {
        attributes: {
          latitude: m.latitude,
          longitude: m.longitude,
          // `||` not `??`: callers sometimes send label:"" — an
          // empty string should still fall back to a generated name.
          friendly_name: m.label || `Marker ${i + 1}`,
        },
      };
      // Pass through every per-marker style field — color (legacy
      // single) and the day/night overrides — so the card's marker
      // resolver sees them. Only the coords move into the synthetic
      // entity's attributes.
      return {
        entity: id,
        label: m.label,
        color: m.color,
        dayColor: m.dayColor,
        nightColor: m.nightColor,
      };
    });
  }

  return { config: out, hass: stub };
}

// Idempotent dynamic-import guard so repeated mounts don't re-fetch
// the (already cached) bundle module record.
let bundleLoaded = null;

/**
 * Import the card bundle from `${assetBase}/geo-clock-card.js`
 * exactly once. Resolves when `customElements.get('geo-clock-card')`
 * is defined. Throws on import failure so callers can show a
 * stage-error fallback.
 */
export function loadCardBundle(assetBase) {
  if (!bundleLoaded) {
    bundleLoaded = import(`${assetBase}/geo-clock-card.js`);
  }
  return bundleLoaded;
}

/**
 * Apply a plain config (+ optional hass) to an existing
 * `<geo-clock-card>` element. Runs expandShortcuts, calls
 * setConfig with the card type prefixed, and sets the hass
 * property. Safe to call repeatedly on the same element — the
 * card rebuilds its internal config and restarts its timers, so
 * this is the live re-render path for the config panel.
 */
export function applyConfig(card, rawConfig, rawHass) {
  const { config, hass } = expandShortcuts(rawConfig, rawHass);
  card.setConfig({ type: 'custom:geo-clock-card', ...config });
  // Property binding (not attribute) so the card sees the object
  // reference directly.
  card.hass = hass;
  return { config, hass };
}

/**
 * Resolve when the card's imagery has decoded and (when the
 * boundary overlay is enabled) the TZ polygons have rendered, or
 * after `timeoutMs` — whichever comes first. Used by screenshot
 * embedders (wallpaper.html) that must not snapshot a half-painted
 * frame; the demo page doesn't need it but it's generic and lives
 * here so both callers share one implementation.
 *
 * Imagery: collect distinct hrefs from the SVG <image> elements and
 * decode them through Image() — same URL, same HTTP cache entry, so
 * this resolves as soon as the bytes the SVG needs are decodable.
 * TZ overlay: the card inserts .tz-region paths only after its async
 * JSON fetch lands, so poll the shadow root for them.
 */
export async function waitForCardAssets(card, config, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const sr = card.shadowRoot;
  if (!sr) return;

  const hrefs = new Set();
  sr.querySelectorAll('svg image').forEach((im) => {
    const h = im.getAttribute('href');
    if (h) hrefs.add(h);
  });
  const imageWaits = [...hrefs].map((h) => {
    const img = new Image();
    img.src = h;
    return img.decode().catch(() => {});
  });

  const wantTz = config?.showTimezoneBoundaries !== false;
  const tzWait = wantTz
    ? (async () => {
        while (Date.now() < deadline) {
          if (sr.querySelector('.tz-region, .tz-iana-region')) return;
          await new Promise((r) => setTimeout(r, 100));
        }
      })()
    : Promise.resolve();

  await Promise.race([
    Promise.all([...imageWaits, tzWait]),
    new Promise((r) => setTimeout(r, timeoutMs)),
  ]);
  // One more beat so the decoded bitmaps are composited before an
  // embedder snapshots. requestAnimationFrame would be ideal but
  // never fires in an offscreen WKWebView (no display link) and
  // awaiting one there hangs forever — race it against a short
  // timeout so on-screen browsers get the precise frame boundary
  // and offscreen embedders fall through after 100 ms.
  await new Promise((r) => {
    let done = false;
    const fin = () => {
      if (!done) {
        done = true;
        r();
      }
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fin);
    setTimeout(fin, 100);
  });
}
