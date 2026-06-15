// geoclock-webconfig.js — the configurable-demo CONTROL PANEL.
//
// Imported ONLY by index.html (the geoclock.world landing page).
// NOT by wallpaper.html and NOT bundled into the macOS app — those
// have their own controls, so this UI must never reach them. The
// only shared dependency is the headless geoclock-config.js.
//
// Responsibilities, all self-contained here so index.html stays a
// thin host:
//   - readable URL-param codec (the shareable-link contract)
//   - localStorage persistence (opt-in "remember on this browser")
//   - Nominatim geocoding (place name -> coords) + browser
//     geolocation ("center / marker on my location")
//   - the slide-out panel DOM, styles, and live-update wiring
//
// Public entry point: initWebConfig(card) — reads the initial
// config (URL > storage > defaults), applies it to the card, builds
// the panel, and keeps the card + URL in sync as the user edits.

import { applyConfig } from './geoclock-config.js';

// ---------------------------------------------------------------
// Config model + defaults
//
// This is the panel's own compact shape, distinct from the card's
// config. `center` is 'sun' | 'lon'; markers carry inline coords.
// Anything equal to a default is omitted from the URL so a clean
// link stays short.
// ---------------------------------------------------------------

// Day/night marker defaults — orange in daylight, blue at night,
// matching the desktop wallpaper app. Setting these (always, from
// this panel) opts every marker into day/night mode: each dot flips
// live as the terminator crosses its location.
const DEF_MARKER_DAY = '#ff9933';
const DEF_MARKER_NIGHT = '#3da9fc';

const DEFAULTS = {
  center: 'sun', // 'sun' | 'lon'
  lon: 0, // used when center === 'lon'
  band: true, // hour-number strip + vertical UTC-offset bands
  tz: true, // time-zone hover/identify popup
  utc: true, // UTC line under the clock
  markerDay: DEF_MARKER_DAY, // global day-side marker color
  markerNight: DEF_MARKER_NIGHT, // global night-side marker color
  // [{ label, lat, lon, dayColor?, nightColor? }] — per-marker
  // day/night are optional overrides; absent = inherit the globals.
  markers: [],
};

const STORAGE_KEY = 'geoclock.webconfig.v1';

// Per-marker field delimiter in the URL. `~` rather than `,` so a
// label that contains commas ("Paris, France") survives the
// round-trip. lat/lon/color never contain `~`.
const MARK_SEP = '~';

const clampLon = (n) => Math.max(-180, Math.min(180, n));
const round4 = (n) => Math.round(n * 1e4) / 1e4;

// ---------------------------------------------------------------
// URL-param codec — the shareable-link contract.
//
//   center=lon&lon=-119      center mode + longitude
//   band=0  tz=0  utc=0       toggle a layer OFF (default is on)
//   marker=Label~lat~lon[~#rrggbb]   repeatable, one per marker
// ---------------------------------------------------------------

const clampLat = (n) => Math.max(-90, Math.min(90, n));
const isHex = (s) => /^#[0-9a-f]{3,8}$/i.test(s);
// Labels can't contain the field delimiter — strip it (rare) so
// the positional marker encoding stays unambiguous.
const cleanLabel = (s) => String(s || '').split(MARK_SEP).join(' ').trim();

// Marker URL form (unambiguous + readable):
//   Label ~ lat ~ lon [~ d#RRGGBB] [~ n#RRGGBB]   fixed marker
//   Label ~ auto      [~ d#RRGGBB] [~ n#RRGGBB]   live "my location"
// Label is field 0 (no `~`). A second field of `auto` marks a live
// marker whose coords come from the browser geolocation API at
// runtime (resolved on load + every 30 min) rather than baked into
// the link — so a shared "my location" link resolves to whoever
// opens it. Otherwise fields 1-2 are lat/lon; any further fields are
// day/night color overrides tagged `d`/`n`.
function parseMarker(s) {
  const parts = s.split(MARK_SEP);
  if (parts.length < 2) return null;
  let m;
  let rest;
  if (parts[1] === 'auto') {
    m = { label: parts[0] || 'My location', auto: true };
    rest = parts.slice(2);
  } else {
    if (parts.length < 3) return null;
    const la = parseFloat(parts[1]);
    const lo = parseFloat(parts[2]);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
    m = { label: parts[0] || '', lat: clampLat(la), lon: clampLon(lo) };
    rest = parts.slice(3);
  }
  for (const tag of rest) {
    if (tag[0] === 'd' && isHex(tag.slice(1))) m.dayColor = tag.slice(1);
    else if (tag[0] === 'n' && isHex(tag.slice(1))) m.nightColor = tag.slice(1);
  }
  return m;
}

function markerToStr(m) {
  // Auto markers serialize WITHOUT coords (resolved at runtime), so
  // the link never bakes in a one-time fix.
  let s = m.auto
    ? `${cleanLabel(m.label)}${MARK_SEP}auto`
    : `${cleanLabel(m.label)}${MARK_SEP}${round4(m.lat)}${MARK_SEP}${round4(m.lon)}`;
  if (m.dayColor) s += `${MARK_SEP}d${m.dayColor}`;
  if (m.nightColor) s += `${MARK_SEP}n${m.nightColor}`;
  return s;
}

// Config lives in the URL HASH FRAGMENT (#…), not the query string.
// The fragment is never sent to the server, which:
//   - avoids Cloudflare's request-URL length limit (a long marker
//     list in the query string returned a 404 from the CDN),
//   - keeps marker locations out of CDN access logs (privacy).
// We still READ a legacy query string as a fallback so any links
// shared before this change keep working; they get rewritten to the
// hash form on load.
function paramSource() {
  const h = location.hash.replace(/^#/, '');
  return h || location.search.replace(/^\?/, '');
}

function configFromUrl(src = paramSource()) {
  const p = new URLSearchParams(src);
  const cfg = { ...DEFAULTS, markers: [] };
  const c = p.get('center');
  if (c === 'lon' || c === 'me') cfg.center = c;
  const lon = parseFloat(p.get('lon'));
  if (Number.isFinite(lon)) cfg.lon = clampLon(lon);
  if (p.get('band') === '0') cfg.band = false;
  if (p.get('tz') === '0') cfg.tz = false;
  if (p.get('utc') === '0') cfg.utc = false;
  if (isHex(p.get('mday') || '')) cfg.markerDay = p.get('mday');
  if (isHex(p.get('mnight') || '')) cfg.markerNight = p.get('mnight');
  cfg.markers = p.getAll('marker').map(parseMarker).filter(Boolean);
  return cfg;
}

function urlFromConfig(cfg) {
  const p = new URLSearchParams();
  if (cfg.center === 'lon') {
    p.set('center', 'lon');
    p.set('lon', String(round4(cfg.lon)));
  } else if (cfg.center === 'me') {
    // Live centering — no baked longitude (resolved per-viewer).
    p.set('center', 'me');
  }
  if (!cfg.band) p.set('band', '0');
  if (!cfg.tz) p.set('tz', '0');
  if (!cfg.utc) p.set('utc', '0');
  if (cfg.markerDay !== DEF_MARKER_DAY) p.set('mday', cfg.markerDay);
  if (cfg.markerNight !== DEF_MARKER_NIGHT) p.set('mnight', cfg.markerNight);
  for (const m of cfg.markers) p.append('marker', markerToStr(m));
  const qs = p.toString();
  // Always pathname (drop any legacy query string) + hash fragment.
  return qs ? `${location.pathname}#${qs}` : location.pathname;
}

function hasUrlConfig(src = paramSource()) {
  const p = new URLSearchParams(src);
  return (
    p.has('center') ||
    p.has('lon') ||
    p.has('band') ||
    p.has('tz') ||
    p.has('utc') ||
    p.has('mday') ||
    p.has('mnight') ||
    p.has('marker')
  );
}

// ---------------------------------------------------------------
// Card-config mapping. The card speaks `center: 'longitude'` +
// `centerLongitude`, and inline markers that geoclock-config.js's
// expandShortcuts turns into synthetic entities.
// ---------------------------------------------------------------

// Latest browser-geolocation fix, shared so the card mapping can
// resolve `auto` ("my location") markers without baking coords into
// the config/URL. null until the first fix lands; refreshed on load
// and every 30 min by initWebConfig.
let myLocation = null;

function cardConfigFromWeb(cfg) {
  const cc = {
    // The "hour band" toggle groups the visual chrome: the hour-number
    // strip AND the colored vertical UTC-offset bands. The "timezone"
    // toggle is reserved for the interactive hover-to-identify popup
    // (showTimezoneBoundaries gates the IANA hit layer that feeds it).
    showTimezoneBand: cfg.band,
    showTimezoneRegions: cfg.band,
    showTimezoneBoundaries: cfg.tz,
    showUTC: cfg.utc,
    // Global day/night marker colors — always set from this panel,
    // which turns on the card's day/night mode for every marker.
    markerDayColor: cfg.markerDay,
    markerNightColor: cfg.markerNight,
  };
  if (cfg.center === 'lon') {
    cc.center = 'longitude';
    cc.centerLongitude = clampLon(cfg.lon);
  } else if (cfg.center === 'me' && myLocation) {
    // Live "my location" centering — resolve the longitude from the
    // current geolocation fix. Before the first fix we fall through
    // to sun so the map still shows something; it re-centers once
    // the fix lands and we re-render.
    cc.center = 'longitude';
    cc.centerLongitude = clampLon(myLocation.lon);
  } else {
    cc.center = 'sun';
  }
  const markers = [];
  for (const m of cfg.markers) {
    // Auto markers resolve their coords from the live geolocation
    // fix; until one is available they're simply omitted (they pop
    // in once the fix lands and we re-render).
    const coords = m.auto ? myLocation : { lat: m.lat, lon: m.lon };
    if (!coords) continue;
    markers.push({
      label: m.label,
      latitude: coords.lat,
      longitude: coords.lon,
      // Per-marker overrides only when set; otherwise the marker
      // inherits the global day/night colors above.
      ...(m.dayColor ? { dayColor: m.dayColor } : {}),
      ...(m.nightColor ? { nightColor: m.nightColor } : {}),
    });
  }
  if (markers.length) cc.markers = markers;
  return cc;
}

// ---------------------------------------------------------------
// Persistence (opt-in)
// ---------------------------------------------------------------

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Re-validate through the model so a hand-edited / stale blob
    // can't inject unexpected shapes.
    return {
      center:
        parsed.center === 'lon' || parsed.center === 'me'
          ? parsed.center
          : 'sun',
      lon: Number.isFinite(parsed.lon) ? clampLon(parsed.lon) : 0,
      band: parsed.band !== false,
      tz: parsed.tz !== false,
      utc: parsed.utc !== false,
      markerDay: isHex(parsed.markerDay) ? parsed.markerDay : DEF_MARKER_DAY,
      markerNight: isHex(parsed.markerNight)
        ? parsed.markerNight
        : DEF_MARKER_NIGHT,
      markers: Array.isArray(parsed.markers)
        ? parsed.markers
            // Keep auto ("my location") markers, or fixed markers
            // with real coords. Drop anything else.
            .filter(
              (m) =>
                m?.auto === true ||
                (Number.isFinite(m?.lat) && Number.isFinite(m?.lon)),
            )
            .map((m) => ({
              label: String(m.label ?? ''),
              ...(m.auto
                ? { auto: true }
                : { lat: clampLat(m.lat), lon: clampLon(m.lon) }),
              ...(isHex(m.dayColor) ? { dayColor: m.dayColor } : {}),
              ...(isHex(m.nightColor) ? { nightColor: m.nightColor } : {}),
            }))
        : [],
    };
  } catch {
    return null;
  }
}

function saveStored(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* storage disabled / full — non-fatal */
  }
}

function clearStored() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function hasStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------
// Geocoding (Nominatim) + browser geolocation
//
// Nominatim usage policy: <=1 req/sec, identify the app. From a
// browser we can't set User-Agent (forbidden header) but the
// Referer is sent automatically (geoclock.world) which satisfies
// the policy for an interactive app. Results require OSM
// attribution — shown in the panel footer.
// ---------------------------------------------------------------

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

async function geocode(query) {
  const url = `${NOMINATIM}?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`geocode HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const hit = data[0];
  const lat = parseFloat(hit.lat);
  const lon = parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  // Short label: the first comma-separated component of the display
  // name (e.g. "Paris" from "Paris, Île-de-France, France"). Keeps
  // markers + URLs tidy; the user can rename.
  const shortName = String(hit.display_name || query).split(',')[0].trim();
  return { label: shortName, lat, lon };
}

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('geolocation unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  });
}

// ---------------------------------------------------------------
// Panel styles (injected once)
// ---------------------------------------------------------------

const PANEL_CSS = `
.gcw-toggle {
  position: absolute;
  top: 0.75rem;
  right: 3.5rem; /* sits left of the fullscreen button */
  z-index: 6;
  height: 36px;
  padding: 0 0.7rem;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.18);
  background: rgba(8,14,28,0.55);
  color: #e6e9ef;
  cursor: pointer;
  font: 500 0.82rem/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  display: inline-flex; align-items: center; gap: 0.4rem;
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
}
.gcw-toggle:hover { background: rgba(8,14,28,0.85); border-color: rgba(255,255,255,0.32); }
/* The panel can't overlay the card in fullscreen: the slide-out lives in
   <body> (a non-descendant of the fullscreen .stage, so the browser won't
   paint it during native fullscreen), and in pseudo-fullscreen it would
   float over hidden page chrome. Hide both entry points — the Customize
   button (inside .stage) and the panel — whenever any fullscreen mode is
   active: native :fullscreen, the WebKit prefix, or our pseudo-fs class. */
.stage:fullscreen .gcw-toggle,
.stage:-webkit-full-screen .gcw-toggle,
body.pseudo-fs .gcw-toggle,
body.pseudo-fs .gcw-panel { display: none; }
.gcw-panel {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: 340px; max-width: 88vw;
  z-index: 50;
  background: #0e141d;
  border-left: 1px solid rgba(255,255,255,0.10);
  box-shadow: -8px 0 30px rgba(0,0,0,0.45);
  transform: translateX(100%);
  transition: transform 180ms ease;
  display: flex; flex-direction: column;
  color: #e6e9ef;
  font: 0.9rem/1.45 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
}
.gcw-panel.is-open { transform: translateX(0); }
.gcw-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.9rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.08);
}
.gcw-head h2 { margin: 0; font-size: 1rem; font-weight: 600; }
.gcw-close {
  background: none; border: none; color: #9aa3b0; cursor: pointer;
  font-size: 1.3rem; line-height: 1; padding: 0 0.2rem;
}
.gcw-close:hover { color: #e6e9ef; }
.gcw-body { overflow-y: auto; padding: 0.5rem 1rem 1rem; flex: 1; }
.gcw-sect { margin: 1rem 0 0.3rem; font-size: 0.75rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em; color: #8893a4; }
.gcw-row { display: flex; align-items: center; gap: 0.5rem; margin: 0.4rem 0; }
.gcw-row label { user-select: none; }
.gcw-grow { flex: 1; }
.gcw-input, .gcw-num {
  background: #1a222e; border: 1px solid rgba(255,255,255,0.12);
  color: #e6e9ef; border-radius: 5px; padding: 0.35rem 0.5rem;
  font: inherit; min-width: 0;
}
.gcw-num { width: 6.5rem; }
.gcw-btn {
  background: #243042; border: 1px solid rgba(255,255,255,0.14);
  color: #e6e9ef; border-radius: 5px; padding: 0.35rem 0.6rem;
  font: inherit; cursor: pointer; white-space: nowrap;
}
.gcw-btn:hover { background: #2c3a4f; }
.gcw-btn:disabled { opacity: 0.5; cursor: default; }
.gcw-btn-accent { background: #ff7a3d; border-color: #ff7a3d; color: #1a1206; font-weight: 600; }
.gcw-btn-accent:hover { background: #ff8a52; }
.gcw-mlist { display: flex; flex-direction: column; gap: 0.35rem; margin: 0.4rem 0; }
.gcw-mrow {
  display: flex; align-items: center; gap: 0.45rem;
  background: #141b25; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 5px; padding: 0.35rem 0.45rem;
}
.gcw-mrow .gcw-mname { flex: 1; min-width: 0; }
.gcw-mrow .gcw-mcoord { color: #8893a4; font-size: 0.78rem; white-space: nowrap; }
.gcw-mrow input[type=color] {
  width: 24px; height: 24px; padding: 0; border: none; background: none; cursor: pointer;
}
.gcw-x { background: none; border: none; color: #8893a4; cursor: pointer; font-size: 1.1rem; line-height: 1; }
.gcw-x:hover { color: #ff6b6b; }
.gcw-err { color: #ff8a52; font-size: 0.8rem; margin: 0.25rem 0; min-height: 1.1em; }
.gcw-foot { border-top: 1px solid rgba(255,255,255,0.08); padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.gcw-attr { color: #6b7686; font-size: 0.7rem; }
.gcw-attr a { color: #8aa6c8; }
.gcw-copied { color: #6ad08a; font-size: 0.78rem; }
`;

function injectStyles() {
  if (document.getElementById('gcw-styles')) return;
  const s = document.createElement('style');
  s.id = 'gcw-styles';
  s.textContent = PANEL_CSS;
  document.head.appendChild(s);
}

// Small DOM helper.
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function')
      n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null) n.append(kid);
  return n;
}

// ---------------------------------------------------------------
// initWebConfig — public entry point
// ---------------------------------------------------------------

export function initWebConfig(card) {
  injectStyles();

  // Initial config precedence: URL > localStorage > defaults.
  let cfg = hasUrlConfig()
    ? configFromUrl()
    : loadStored() || { ...DEFAULTS, markers: [] };

  // "Remember on this browser" is on by default if a stored blob
  // already exists (the user opted in previously).
  let remember = hasStored();

  // Apply to the card immediately and sync the URL so a reload of a
  // storage-derived config produces a shareable link too.
  const render = () => applyConfig(card, cardConfigFromWeb(cfg));
  const persist = () => {
    history.replaceState(null, '', urlFromConfig(cfg));
    if (remember) saveStored(cfg);
  };
  render();
  history.replaceState(null, '', urlFromConfig(cfg));

  // --- Live geolocation loop -------------------------------------
  // Shared by the "my location" auto marker AND live centering
  // (center === 'me'). Neither bakes coords; both resolve from the
  // browser here on load and every 30 min. A location update
  // changes the card config (new coords) but NOT the config shape,
  // so we re-render without rewriting the URL/storage.
  const needsGeo = () => cfg.center === 'me' || cfg.markers.some((m) => m.auto);
  let geoTimer = null;
  let geoDenied = false; // remember a hard denial to update the UI hint
  const refreshMyLocation = async () => {
    if (!needsGeo()) return;
    try {
      myLocation = await getBrowserLocation();
      geoDenied = false;
      render();
      renderMarkers(); // update the row's live coord readout
    } catch {
      // Permission denied / position unavailable / timeout. We keep
      // the LAST known fix if we had one (so a transient failure on
      // a 30-min refresh doesn't blank the marker); only the
      // never-resolved case leaves myLocation null, and then:
      //   - an auto marker simply doesn't render (row shows a hint),
      //   - center 'me' falls through to sun centering.
      geoDenied = true;
      if (!myLocation) {
        geoErr.textContent =
          'Location unavailable — allow location access for live position.';
      }
      render();
      renderMarkers();
    }
  };
  const ensureGeoLoop = () => {
    if (needsGeo() && !geoTimer) {
      geoTimer = setInterval(refreshMyLocation, 30 * 60 * 1000);
      refreshMyLocation();
    } else if (!needsGeo() && geoTimer) {
      clearInterval(geoTimer);
      geoTimer = null;
    }
  };

  // --- Build panel ------------------------------------------------

  const stage = card.closest('.stage') || document.body;

  const toggleBtn = el('button', {
    class: 'gcw-toggle',
    type: 'button',
    title: 'Customize the map',
    onclick: () => panel.classList.add('is-open'),
  });
  toggleBtn.innerHTML = '&#9881; Customize';
  stage.appendChild(toggleBtn);

  // Marker list container (re-rendered on change).
  const mlist = el('div', { class: 'gcw-mlist' });
  const geoErr = el('div', { class: 'gcw-err' });
  const copiedNote = el('span', { class: 'gcw-copied' });

  // Center controls.
  const lonInput = el('input', {
    class: 'gcw-num',
    type: 'number',
    min: '-180',
    max: '180',
    step: '1',
    value: String(cfg.lon),
  });
  const lonRow = el(
    'div',
    { class: 'gcw-row' },
    el('label', { text: 'Longitude' }),
    lonInput,
  );
  lonRow.style.display = cfg.center === 'lon' ? '' : 'none';

  const centerSel = el(
    'select',
    { class: 'gcw-input gcw-grow' },
    el('option', { value: 'sun', text: 'Sun (daylit hemisphere)' }),
    el('option', { value: 'lon', text: 'Fixed longitude' }),
    el('option', { value: 'me', text: 'My location (live)' }),
  );
  centerSel.value = cfg.center;
  const applyCenterMode = (mode) => {
    cfg.center = mode === 'lon' || mode === 'me' ? mode : 'sun';
    centerSel.value = cfg.center;
    lonRow.style.display = cfg.center === 'lon' ? '' : 'none';
    render();
    persist();
    ensureGeoLoop(); // start/stop the live loop for 'me'
  };
  centerSel.addEventListener('change', () => applyCenterMode(centerSel.value));
  lonInput.addEventListener('change', () => {
    const v = parseFloat(lonInput.value);
    cfg.lon = Number.isFinite(v) ? clampLon(v) : 0;
    lonInput.value = String(cfg.lon);
    render();
    persist();
  });

  // Shortcut: switch to LIVE centering (resolves from the browser on
  // load + every 30 min, not a one-time fix).
  const centerMeBtn = el('button', {
    class: 'gcw-btn',
    type: 'button',
    text: 'Center on my location (live)',
    onclick: () => {
      geoErr.textContent = '';
      applyCenterMode('me');
    },
  });

  // Marker add controls.
  const searchInput = el('input', {
    class: 'gcw-input gcw-grow',
    type: 'text',
    placeholder: 'Place name, e.g. Tokyo',
  });
  const addBtn = el('button', {
    class: 'gcw-btn gcw-btn-accent',
    type: 'button',
    text: 'Add',
  });
  const addMarkerFromSearch = async () => {
    const q = searchInput.value.trim();
    if (!q) return;
    geoErr.textContent = '';
    addBtn.disabled = true;
    addBtn.textContent = '…';
    try {
      const hit = await geocode(q);
      if (!hit) {
        geoErr.textContent = `No match for "${q}".`;
        return;
      }
      cfg.markers.push({ label: hit.label, lat: hit.lat, lon: hit.lon });
      searchInput.value = '';
      renderMarkers();
      render();
      persist();
    } catch {
      geoErr.textContent = 'Geocoding failed — try again.';
    } finally {
      addBtn.disabled = false;
      addBtn.textContent = 'Add';
    }
  };
  addBtn.addEventListener('click', addMarkerFromSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addMarkerFromSearch();
    }
  });
  const markerMeBtn = el('button', {
    class: 'gcw-btn',
    type: 'button',
    text: 'Marker at my location',
    onclick: () => {
      geoErr.textContent = '';
      // Add a single live auto-marker (no baked coords). It resolves
      // from the browser on load + every 30 min — so the share link
      // tracks the viewer, not a one-time fix.
      if (cfg.markers.some((m) => m.auto)) {
        geoErr.textContent = 'A “my location” marker is already added.';
        return;
      }
      cfg.markers.push({ label: 'My location', auto: true });
      renderMarkers();
      persist(); // shape changed → write the `~auto` marker to the URL
      ensureGeoLoop(); // kick off the geolocation fetch + 30-min loop
    },
  });

  // Display toggles.
  const mkToggle = (key, labelText) => {
    const cb = el('input', { type: 'checkbox' });
    cb.checked = cfg[key];
    cb.addEventListener('change', () => {
      cfg[key] = cb.checked;
      render();
      persist();
    });
    const id = `gcw-${key}`;
    cb.id = id;
    return el(
      'div',
      { class: 'gcw-row' },
      cb,
      el('label', { for: id, text: labelText }),
    );
  };

  // Global day/night marker colors. Every marker flips between
  // these as the terminator crosses it (per-marker overrides win).
  const mkGlobalColor = (key) => {
    const inp = el('input', { type: 'color', value: cfg[key] });
    inp.addEventListener('change', () => {
      cfg[key] = inp.value;
      renderMarkers(); // marker swatches show the effective color
      render();
      persist();
    });
    return inp;
  };
  const dayColorInput = mkGlobalColor('markerDay');
  const nightColorInput = mkGlobalColor('markerNight');
  const syncGlobalColors = () => {
    dayColorInput.value = cfg.markerDay;
    nightColorInput.value = cfg.markerNight;
  };

  // Footer: copy link, remember, reset.
  const copyBtn = el('button', {
    class: 'gcw-btn',
    type: 'button',
    text: 'Copy share link',
    onclick: async () => {
      const link = location.origin + urlFromConfig(cfg);
      try {
        await navigator.clipboard.writeText(link);
        copiedNote.textContent = 'Copied!';
      } catch {
        copiedNote.textContent = link;
      }
      setTimeout(() => (copiedNote.textContent = ''), 2500);
    },
  });
  const rememberCb = el('input', { type: 'checkbox', id: 'gcw-remember' });
  rememberCb.checked = remember;
  rememberCb.addEventListener('change', () => {
    remember = rememberCb.checked;
    if (remember) saveStored(cfg);
    else clearStored();
  });
  const resetBtn = el('button', {
    class: 'gcw-btn',
    type: 'button',
    text: 'Reset',
    onclick: () => {
      cfg = { ...DEFAULTS, markers: [] };
      centerSel.value = 'sun';
      lonRow.style.display = 'none';
      lonInput.value = '0';
      syncToggles();
      syncGlobalColors();
      renderMarkers();
      render();
      history.replaceState(null, '', urlFromConfig(cfg));
      if (remember) saveStored(cfg);
      ensureGeoLoop(); // markers cleared → stop the geo loop
    },
  });

  const bandRow = mkToggle('band', 'Hour & zone bands');
  const tzRow = mkToggle('tz', 'Time-zone hover');
  const utcRow = mkToggle('utc', 'UTC line');
  const syncToggles = () => {
    bandRow.querySelector('input').checked = cfg.band;
    tzRow.querySelector('input').checked = cfg.tz;
    utcRow.querySelector('input').checked = cfg.utc;
  };

  const panel = el(
    'aside',
    { class: 'gcw-panel', 'aria-label': 'Map configuration' },
    el(
      'div',
      { class: 'gcw-head' },
      el('h2', { text: 'Customize' }),
      el('button', {
        class: 'gcw-close',
        type: 'button',
        title: 'Close',
        text: '×',
        onclick: () => panel.classList.remove('is-open'),
      }),
    ),
    el(
      'div',
      { class: 'gcw-body' },
      el('div', { class: 'gcw-sect', text: 'Center' }),
      el('div', { class: 'gcw-row' }, centerSel),
      lonRow,
      el('div', { class: 'gcw-row' }, centerMeBtn),

      el('div', { class: 'gcw-sect', text: 'Markers' }),
      mlist,
      el('div', { class: 'gcw-row' }, searchInput, addBtn),
      el('div', { class: 'gcw-row' }, markerMeBtn),
      geoErr,

      el('div', { class: 'gcw-sect', text: 'Marker colors' }),
      el(
        'div',
        { class: 'gcw-row' },
        el('label', { class: 'gcw-grow', text: 'Day' }),
        dayColorInput,
        el('label', { text: 'Night', style: 'margin-left:0.6rem' }),
        nightColorInput,
      ),
      el('div', {
        class: 'gcw-attr',
        text: 'Each marker uses the day color while its location is in sunlight, the night color otherwise. Override per marker above.',
      }),

      el('div', { class: 'gcw-sect', text: 'Display' }),
      bandRow,
      tzRow,
      utcRow,
    ),
    el(
      'div',
      { class: 'gcw-foot' },
      el('div', { class: 'gcw-row' }, copyBtn, copiedNote),
      el(
        'div',
        { class: 'gcw-row' },
        rememberCb,
        el('label', {
          for: 'gcw-remember',
          text: 'Remember on this browser',
        }),
        el('span', { class: 'gcw-grow' }),
        resetBtn,
      ),
      el(
        'div',
        { class: 'gcw-attr' },
        'Geocoding © ',
        el('a', {
          href: 'https://www.openstreetmap.org/copyright',
          target: '_blank',
          rel: 'noopener',
          text: 'OpenStreetMap',
        }),
        ' contributors',
      ),
    ),
  );
  document.body.appendChild(panel);

  // Esc closes the panel.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('is-open'))
      panel.classList.remove('is-open');
  });

  // --- Marker list rendering -------------------------------------

  function renderMarkers() {
    mlist.replaceChildren();
    if (!cfg.markers.length) {
      mlist.append(
        el('div', {
          class: 'gcw-attr',
          text: 'No markers yet — search a place or use your location.',
        }),
      );
      return;
    }
    cfg.markers.forEach((m, i) => {
      const name = el('input', {
        class: 'gcw-input gcw-mname',
        type: 'text',
        value: m.label,
      });
      name.addEventListener('change', () => {
        m.label = name.value;
        render();
        persist();
      });
      // Two swatches: day + night override. Each shows the EFFECTIVE
      // color (per-marker override, else the global). Changing one
      // sets that marker's override for that side.
      const daySw = el('input', {
        type: 'color',
        title: 'Day color (override)',
        value: m.dayColor || cfg.markerDay,
      });
      daySw.addEventListener('change', () => {
        m.dayColor = daySw.value;
        render();
        persist();
      });
      const nightSw = el('input', {
        type: 'color',
        title: 'Night color (override)',
        value: m.nightColor || cfg.markerNight,
      });
      nightSw.addEventListener('change', () => {
        m.nightColor = nightSw.value;
        render();
        persist();
      });
      const remove = el('button', {
        class: 'gcw-x',
        type: 'button',
        title: 'Remove',
        text: '×',
        onclick: () => {
          cfg.markers.splice(i, 1);
          renderMarkers();
          render();
          persist();
          ensureGeoLoop(); // stop the geo loop if that was the auto marker
        },
      });
      // Auto markers show a live "locating…" / resolved-coords hint
      // instead of a fixed coordinate; fixed markers show their
      // coords in a tooltip on the ☀.
      const coordTitle = m.auto
        ? myLocation
          ? `auto · ${round4(myLocation.lat)}, ${round4(myLocation.lon)}`
          : geoDenied
            ? 'auto · location unavailable'
            : 'auto · locating…'
        : `${round4(m.lat)}, ${round4(m.lon)}`;
      mlist.append(
        el(
          'div',
          { class: 'gcw-mrow' },
          name,
          el('span', {
            class: 'gcw-mcoord',
            title: coordTitle,
            text: m.auto ? '📍' : '☀',
          }),
          // Day swatch label only for non-auto (the 📍 already implies
          // the auto badge); keep both swatches for color control.
          ...(m.auto ? [el('span', { class: 'gcw-mcoord', text: '☀' })] : []),
          daySw,
          el('span', { class: 'gcw-mcoord', text: '☾' }),
          nightSw,
          remove,
        ),
      );
    });
  }

  renderMarkers();
  ensureGeoLoop(); // a loaded/stored auto marker starts resolving now
}
