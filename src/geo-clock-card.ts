import { LitElement, html, css, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { subsolarPoint } from './sun.js';
import { terminatorCurve, terminatorPolygon } from './terminator.js';
import { polygonToSvgPoints, latLonToPx } from './projection.js';
import { timezoneBand, BAND_H } from './timezone-band.js';
import { loadTimezones, timezonesToPolygons, type TzPolygon } from './timezones.js';
import {
  loadIanaTimezones,
  ianaToPolygons,
  zoneNow,
  findIanaZoneForLatLon,
  type IanaPolygon,
} from './timezones-iana.js';
import { dayImageForDate } from './day-image.js';
import type {
  GeoClockCardConfig,
  HassLike,
  MarkerConfig,
  ResolvedConfig,
} from './types.js';

// Equirectangular working canvas. The SVG scales to fit, so this is
// just internal coordinate space for the polygon math + image extents.
const MAP_W = 2048;
const MAP_H = 1024;

const NIGHT_IMAGE = 'black-marble-2048.jpg';
const TZ_DATA = 'timezones.json';
const TZ_IANA_DATA = 'timezones-iana.json';



// The terminator + imagery + TZ overlay + hour band are derived from
// the subsolar point and only meaningfully change when the subsolar
// longitude has shifted by ≥0.5 px at a 4K-wide map:
//
//   360° / 4096 px / 2  =  0.0439° per half-pixel
//   ÷ 15° per hour        →   ~10.5 seconds
//
// Anything finer is sub-pixel even on hypothetical 4K dashboards, so
// throttling here saves polygon + path-string churn while leaving the
// wall-clock readout free to tick once a second.
const FOUR_K_WIDTH_PX = 4096;
const HALF_PX_DEG_AT_4K = 360 / FOUR_K_WIDTH_PX / 2;
const SUN_DEG_PER_MS = 15 / 3_600_000;
const MAP_UPDATE_INTERVAL_MS = HALF_PX_DEG_AT_4K / SUN_DEG_PER_MS;

// When the card is off-screen or the tab is backgrounded we cut the
// timer all the way down to one update every 30 minutes — enough to
// keep displayed values from being absurdly stale if the user
// suddenly brings the card back, but cheap enough to be invisible
// in CPU profiles. The card refreshes immediately the moment it
// becomes visible again.
const HIDDEN_INTERVAL_MS = 30 * 60 * 1000;

// HassLike is hoisted to types.ts so the editor can share the same
// minimal shape — see types.ts for the field-by-field rationale.

@customElement('geo-clock-card')
export class GeoClockCard extends LitElement {
  @property({ attribute: false }) hass?: HassLike;
  /** Wall-clock time used by the readout. Ticks at the configured
   *  updateInterval (default 1 s) so the displayed seconds advance
   *  smoothly. */
  @state() private displayNow = new Date();
  /** Time used by everything map-shaped (terminator, imagery offset,
   *  TZ overlay, hour band). Only advances when the subsolar point
   *  has moved ≥0.5 px at 4K — see MAP_UPDATE_INTERVAL_MS. */
  @state() private mapNow = new Date();
  @state() private tzPolygons: TzPolygon[] | null = null;
  @state() private tzIanaPolygons: IanaPolygon[] | null = null;
  /** centerLon used the last time we built the TZ overlay paths. If
   *  the centerLon changes, we need to re-project. */
  private tzPolygonsCenterLon: number | null = null;
  private tzData: Awaited<ReturnType<typeof loadTimezones>> | null = null;
  private tzIanaData: Awaited<ReturnType<typeof loadIanaTimezones>> | null = null;
  @state() private hoveredIana: IanaPolygon | null = null;
  @state() private hoveredOffset: TzPolygon | null = null;
  @state() private hoveredMarker: ResolvedMarker | null = null;
  @state() private hoverPos: { x: number; y: number } | null = null;

  private config?: ResolvedConfig;
  private timer?: ReturnType<typeof setInterval>;
  /** Combined "the card is visible right now" signal: viewport
   *  intersection AND the document's tab visibility. When false we
   *  switch the timer to a 30-minute cadence. */
  private isCardVisible = true;
  private intersecting = true;
  private intersectionObserver?: IntersectionObserver;
  private onTabVisibility?: () => void;

  static override styles = css`
    :host {
      display: block;
      background: var(--ha-card-background, var(--card-background-color, #111));
      border-radius: var(--ha-card-border-radius, 12px);
      overflow: hidden;
      color: var(--primary-text-color, #fff);
      --geo-tz-bg: rgba(8, 14, 28, 0.85);
      --geo-tz-hour: #d8e2f0;
      --geo-tz-noon: #ffd866;
      --geo-tz-mid: #6ab0ff;
      --geo-tz-tick: rgba(255, 255, 255, 0.35);
      --geo-tz-line: rgba(255, 255, 255, 0.18);
      --geo-tz-line-width: 1;
      --geo-home-marker: var(--accent-color, #ff7a3d);
      --geo-marker-color: #3da9fc;
      --geo-day-brightness: 1.15;
      --geo-night-contrast: 1;
      --geo-twilight-color: #463701;
      --geo-twilight-opacity: 0.26;
    }
    .day-image {
      filter: brightness(var(--geo-day-brightness));
    }
    .night-image {
      filter: contrast(var(--geo-night-contrast));
    }
    /* Warm sunrise/sunset glow stroked along the terminator great
       circle. Blurred + screen-blended so it brightens the day side
       without dimming the night side. */
    .twilight-glow {
      fill: none;
      stroke: var(--geo-twilight-color);
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: var(--geo-twilight-opacity);
      mix-blend-mode: screen;
      pointer-events: none;
    }
    .frame {
      position: relative;
      width: 100%;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .readout {
      position: absolute;
      bottom: 10px;
      left: 14px;
      font-family: var(--paper-font-headline_-_font-family, system-ui, sans-serif);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
      line-height: 1.15;
    }
    .local-time {
      font-size: clamp(1rem, 2.4vw, 1.7rem);
      font-weight: 500;
    }
    .utc-time {
      font-size: clamp(0.75rem, 1.4vw, 1rem);
      color: #ffd866;
      opacity: 0.92;
    }
    .date {
      position: absolute;
      bottom: 10px;
      right: 14px;
      font-family: var(--paper-font-headline_-_font-family, system-ui, sans-serif);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
      font-size: clamp(0.85rem, 1.6vw, 1.15rem);
    }

    /* Hour band */
    .tz-bg {
      fill: var(--geo-tz-bg);
    }
    .tz-hour {
      fill: var(--geo-tz-hour);
      font-family: var(--paper-font-headline_-_font-family, system-ui, sans-serif);
      font-weight: 500;
      font-size: 26px;
    }
    .tz-hour.noon {
      fill: var(--geo-tz-noon);
      font-weight: 700;
    }
    .tz-hour.mid {
      fill: var(--geo-tz-mid);
      font-weight: 600;
    }
    .tz-tick {
      stroke: var(--geo-tz-tick);
      stroke-width: 1;
    }

    /* Time-zone boundary overlay — visible offset boundaries with a
       transparent fill so the polygon interior is hit-testable.
       Renders BELOW the IANA layer; IANA captures hover where it
       has coverage (land), and we fall back to this layer's hover
       in the gaps (open ocean, polar strips). */
    .tz-region {
      fill: rgba(255, 255, 255, 0);
      stroke: var(--geo-tz-line);
      stroke-width: var(--geo-tz-line-width);
      stroke-linejoin: round;
      stroke-linecap: round;
      pointer-events: visiblePainted;
      cursor: default;
      transition: fill 120ms ease;
    }
    .tz-region:hover {
      fill: rgba(255, 255, 255, 0.05);
    }
    /* Invisible IANA hit-test layer — tagged with each region's IANA
       tzid so the popup can ask Intl.DateTimeFormat for DST-aware
       local time. Faint tint on hover gives visual feedback that
       the user is over an interactive region. */
    .tz-iana-region {
      fill: rgba(255, 255, 255, 0);
      stroke: rgba(255, 255, 255, 0);
      stroke-width: 0;
      pointer-events: visiblePainted;
      cursor: default;
      transition: fill 120ms ease, stroke 120ms ease, stroke-width 120ms ease;
    }
    .tz-iana-region:hover,
    .tz-iana-region.is-active {
      fill: rgba(255, 255, 255, 0.08);
      stroke: rgba(255, 255, 255, 0.65);
      stroke-width: 1.5;
    }
    /* Home marker — overlay sibling of the SVG, same shape/CSS as
       a regular marker but coloured via the home-specific theme
       variable so users can restyle without touching card config.
       The selector specificity (.home-marker .marker-halo /
       .marker-dot) beats the bare .marker-halo / .marker-dot rules
       above, so the home marker uses --geo-home-marker rather than
       --geo-marker-color. The dot is non-interactive (no popup);
       the label is rendered inline when showHomeMarkerLabel is true. */
    .home-marker .marker-halo,
    .home-marker .marker-dot {
      background: var(--geo-home-marker);
    }
    .home-marker .marker-dot {
      pointer-events: none;
      cursor: default;
    }
    /* User-configured location markers. Rendered as HTML overlay
       (not SVG) so their dot, halo, and label keep a constant CSS
       pixel size regardless of the card's rendered width — SVG
       <text> and circle radii live in viewBox units and shrink
       linearly with the card, which made labels illegible at any
       size below full-screen. The marker container itself is
       positioned in percent (so it tracks the map's drift) but
       its children are sized in px. */
    .marker {
      position: absolute;
      width: 0;
      height: 0;
      pointer-events: none;
      z-index: 3;
    }
    .marker-halo {
      position: absolute;
      width: 36px;
      height: 36px;
      left: -18px;
      top: -18px;
      border-radius: 50%;
      opacity: 0.22;
      pointer-events: none;
      /* Default fill — themes override via --geo-marker-color, and
         per-marker overrides via inline style still win because the
         element-level style attribute beats a host-scope variable. */
      background: var(--geo-marker-color);
    }
    .marker-dot {
      position: absolute;
      width: 14px;
      height: 14px;
      left: -7px;
      top: -7px;
      border-radius: 50%;
      border: 1.2px solid rgba(0, 0, 0, 0.7);
      box-sizing: border-box;
      pointer-events: auto;
      cursor: default;
      transition: transform 120ms ease;
      background: var(--geo-marker-color);
    }
    .marker.is-active .marker-dot {
      transform: scale(1.3);
    }
    .marker-text {
      position: absolute;
      top: 9px;
      left: 0;
      transform: translateX(-50%);
      text-align: center;
      white-space: nowrap;
      pointer-events: none;
      font-family: var(--paper-font-headline_-_font-family, system-ui, sans-serif);
      /* Multi-direction shadow gives a readable outline against
         either bright daylight or dark city-lights imagery without
         the cost of a true SVG paint-order stroke. */
      text-shadow:
        0 1px 2px rgba(0, 0, 0, 0.95),
        0 0 3px rgba(0, 0, 0, 0.85),
        0 0 6px rgba(0, 0, 0, 0.6);
      color: #fff;
    }
    .marker-label {
      font-size: 13px;
      font-weight: 600;
      line-height: 1.15;
    }
    .marker-time {
      font-size: 12px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
      line-height: 1.15;
      margin-top: 1px;
    }
    /* Custom popup. Positioned via inline transform from JS so it
       follows the cursor; ignores its own pointer events so it never
       steals hover from the underlying region. */
    .tz-popup {
      position: absolute;
      left: 0;
      top: 0;
      pointer-events: none;
      background: rgba(8, 14, 28, 0.92);
      color: var(--primary-text-color, #fff);
      border-radius: 8px;
      padding: 8px 12px;
      font-family: var(--paper-font-headline_-_font-family, system-ui, sans-serif);
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.55);
      max-width: 280px;
      z-index: 5;
    }
    .tz-popup-time {
      font-size: 1.15rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }
    .tz-popup-date {
      font-size: 0.78rem;
      opacity: 0.78;
      margin-top: 1px;
    }
    .tz-popup-name {
      font-size: 0.9rem;
      color: #ffd866;
      font-weight: 600;
      margin-top: 2px;
    }
    .tz-popup-city {
      font-size: 0.82rem;
      opacity: 0.92;
      margin-top: 1px;
    }
    .tz-popup-offset {
      font-size: 0.72rem;
      opacity: 0.62;
      margin-top: 4px;
      font-variant-numeric: tabular-nums;
    }
    .tz-popup-places {
      font-size: 0.72rem;
      opacity: 0.62;
      margin-top: 3px;
      line-height: 1.3;
    }
  `;

  setConfig(config: GeoClockCardConfig): void {
    if (!config) {
      throw new Error('geo-clock-card: missing config');
    }
    const base =
      config.imageryBase ?? new URL('.', import.meta.url).href;
    const frozenNow = parseFrozenNow(config.now);
    this.config = {
      twilightDegrees: clamp(config.twilightDegrees ?? 8, 1, 18),
      updateInterval: clamp(config.updateInterval ?? 1, 1, 600),
      showUTC: config.showUTC ?? true,
      showTimezoneBand: config.showTimezoneBand ?? true,
      showTimezoneBoundaries: config.showTimezoneBoundaries ?? true,
      showTimezonePopup: config.showTimezonePopup ?? true,
      timezoneLineColor:
        sanitizeCssColor(config.timezoneLineColor) ??
        'rgba(255, 255, 255, 0.18)',
      dayBrightness: clamp(config.dayBrightness ?? 1.15, 0, 5),
      nightContrast: clamp(config.nightContrast ?? 1, 0, 5),
      twilightColor: sanitizeCssColor(config.twilightColor) ?? '#463701',
      twilightOpacity: clamp(config.twilightOpacity ?? 0.26, 0, 1),
      imageryBase: base.endsWith('/') ? base : base + '/',
      center: config.center ?? 'sun',
      centerLongitude:
        typeof config.centerLongitude === 'number'
          ? clamp(config.centerLongitude, -180, 180)
          : undefined,
      centerEntity: config.centerEntity,
      showHomeMarker: config.showHomeMarker ?? false,
      showHomeMarkerLabel: config.showHomeMarkerLabel ?? false,
      markers: sanitizeMarkers(config.markers),
      markerLabelMode:
        config.markerLabelMode === 'hover' ? 'hover' : 'always',
      // markerColor stays undefined when the user hasn't explicitly
      // set it so `--geo-marker-color` is the true default. The
      // sanitiser drops anything that isn't a recognised CSS color.
      markerColor: sanitizeCssColor(config.markerColor),
      markerShowDay: config.markerShowDay ?? true,
      mainTimeSource: pickMainTimeSource(config.mainTimeSource),
      mainTimeEntity: config.mainTimeEntity,
      frozenNow,
    };
    // Pin or release the clocks based on the frozen setting.
    const seed = frozenNow ?? new Date();
    this.displayNow = seed;
    this.mapNow = seed;
    // New config might change centerLon → invalidate cached paths.
    this.tzPolygons = null;
    this.tzIanaPolygons = null;
    this.tzPolygonsCenterLon = null;
    this.restartTimer();
    this.maybeLoadTimezones();
    this.maybeLoadIanaTimezones();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.config?.frozenNow) {
      const now = new Date();
      this.displayNow = now;
      this.mapNow = now;
    }
    this.attachVisibilityObservers();
    this.restartTimer();
    this.maybeLoadTimezones();
    this.maybeLoadIanaTimezones();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopTimer();
    this.clearDismissTimer();
    this.detachVisibilityObservers();
  }

  /** Track whether this card is on-screen and the tab is foregrounded.
   *  Either signal turning off cuts updates to a 30-minute cadence. */
  private attachVisibilityObservers(): void {
    if (typeof IntersectionObserver !== 'undefined' && !this.intersectionObserver) {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          const e = entries[entries.length - 1];
          this.intersecting = e ? e.isIntersecting : true;
          this.recomputeVisibility();
        },
        { threshold: 0 },
      );
      this.intersectionObserver.observe(this);
    }
    if (typeof document !== 'undefined' && !this.onTabVisibility) {
      this.onTabVisibility = () => this.recomputeVisibility();
      document.addEventListener('visibilitychange', this.onTabVisibility);
    }
  }

  private detachVisibilityObservers(): void {
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    if (this.onTabVisibility && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onTabVisibility);
    }
    this.onTabVisibility = undefined;
  }

  private recomputeVisibility(): void {
    const tabVisible =
      typeof document === 'undefined' ||
      document.visibilityState !== 'hidden';
    const visible = this.intersecting && tabVisible;
    if (visible === this.isCardVisible) return;
    this.isCardVisible = visible;
    if (visible) {
      // Snap clocks forward to "now" so the user doesn't see a stale
      // readout while the timer is restarting at fast cadence.
      const now = new Date();
      this.displayNow = now;
      this.mapNow = now;
    }
    this.restartTimer();
  }

  private restartTimer(): void {
    this.stopTimer();
    if (!this.config || !this.isConnected) return;
    if (this.config.frozenNow) return; // frozen clock — no timer
    const intervalMs = this.isCardVisible
      ? this.config.updateInterval * 1000
      : HIDDEN_INTERVAL_MS;
    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  private tick(): void {
    const now = new Date();
    this.displayNow = now;
    if (now.getTime() - this.mapNow.getTime() >= MAP_UPDATE_INTERVAL_MS) {
      this.mapNow = now;
    }
  }

  private stopTimer(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private maybeLoadTimezones(): void {
    if (!this.config?.showTimezoneBoundaries || this.tzData !== null) return;
    const url = this.config.imageryBase + TZ_DATA;
    loadTimezones(url)
      .then((data) => {
        this.tzData = data;
        // Force re-render so the overlay path gets built with the
        // current centerLon.
        this.requestUpdate();
      })
      .catch((err) => {
        // Don't fail the card if the file is missing — log and move on
        // with a bare map. Common during dev before the asset is built.
        console.warn('geo-clock-card: timezone overlay failed to load:', err);
      });
  }

  private maybeLoadIanaTimezones(): void {
    if (!this.config || this.tzIanaData !== null) return;
    // We need IANA data for: (a) the on-map polygon overlay, (b)
    // resolving tzid for any configured marker, (c) resolving tzid
    // for `mainTimeSource: 'entity'`, and (d) the home tzid lookup
    // when HA hasn't reported a `time_zone` config. Skip the fetch
    // only when none of these apply.
    const needForMarkers = this.config.markers.length > 0;
    const needForEntityClock = this.config.mainTimeSource === 'entity';
    const needForHomeClock =
      this.config.mainTimeSource === 'home' &&
      typeof this.hass?.config?.time_zone !== 'string';
    if (
      !this.config.showTimezoneBoundaries &&
      !needForMarkers &&
      !needForEntityClock &&
      !needForHomeClock
    ) {
      return;
    }
    const url = this.config.imageryBase + TZ_IANA_DATA;
    loadIanaTimezones(url)
      .then((data) => {
        this.tzIanaData = data;
        this.requestUpdate();
      })
      .catch((err) => {
        // Same fallback as the offset layer: skip silently if the
        // file isn't there. The offset layer alone still works.
        console.warn(
          'geo-clock-card: IANA timezone overlay failed to load:',
          err,
        );
      });
  }

  /** Used for fallbacks below — Greenwich rather than subsolar so a
   *  misconfigured non-sun mode looks visibly different from sun. */
  private static readonly FALLBACK_CENTER_LON = 0;
  private warnedFallback = '';

  /**
   * Resolve the longitude (degrees, signed) that should appear at the
   * center of the map. Driven by mapNow — for 'sun' mode this means
   * the map shifts only when the subsolar longitude has moved enough
   * to be visible (≥0.5 px at 4K).
   *
   * Modes that need data which isn't available (no HA longitude,
   * entity missing, centerLongitude unset) fall back to GREENWICH
   * (lon=0), not subsolar — that way a broken `home` config doesn't
   * look identical to `sun` mode and the user sees their selection
   * registered. A console warning is emitted so the cause is visible
   * in DevTools.
   */
  private resolveCenterLon(mapNow: Date): number {
    if (!this.config) return subsolarPoint(mapNow).lon;
    switch (this.config.center) {
      case 'home': {
        const lon = this.hass?.config?.longitude;
        if (typeof lon === 'number') return lon;
        this.warnFallback(
          'home',
          'hass.config.longitude is not set; falling back to Greenwich (0°)',
        );
        return GeoClockCard.FALLBACK_CENTER_LON;
      }
      case 'longitude':
        if (typeof this.config.centerLongitude === 'number') {
          return this.config.centerLongitude;
        }
        this.warnFallback(
          'longitude',
          'centerLongitude not set; falling back to Greenwich (0°)',
        );
        return GeoClockCard.FALLBACK_CENTER_LON;
      case 'entity': {
        const id = this.config.centerEntity;
        const state = id ? this.hass?.states?.[id] : undefined;
        const lon = state?.attributes?.longitude;
        if (typeof lon === 'number') return lon;
        this.warnFallback(
          'entity',
          id
            ? `entity '${id}' has no numeric longitude attribute; falling back to Greenwich (0°)`
            : 'centerEntity not set; falling back to Greenwich (0°)',
        );
        return GeoClockCard.FALLBACK_CENTER_LON;
      }
      case 'sun':
      default:
        return subsolarPoint(mapNow).lon;
    }
  }

  /** De-duped console warning per (mode, message) so we don't spam
   *  the console with the same warning every render. */
  private warnFallback(mode: string, message: string): void {
    const key = `${mode}|${message}`;
    if (this.warnedFallback === key) return;
    this.warnedFallback = key;
    console.warn(`geo-clock-card: center mode '${mode}' — ${message}`);
  }

  /** Returns (lat, lon) for the home marker, or null if we have no
   *  HA-configured location. Always reads from hass.config — the
   *  marker represents the user's actual home regardless of the
   *  map's centering mode. */
  private resolveHomeLatLon(): { lat: number; lon: number } | null {
    const lat = this.hass?.config?.latitude;
    const lon = this.hass?.config?.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;
    return { lat, lon };
  }

  /**
   * Resolve the IANA tzid the main clock readout should use, based on
   * `mainTimeSource`. Returns undefined to mean "use the browser's
   * default zone" — that's also the fallback whenever a configured
   * source can't be resolved (e.g. entity missing, IANA data still
   * loading).
   */
  private resolveMainTimezone(): string | undefined {
    if (!this.config) return undefined;
    switch (this.config.mainTimeSource) {
      case 'device':
        return undefined;
      case 'home': {
        // HA almost always exposes its own zone via config.time_zone,
        // and using that directly avoids an unnecessary polygon
        // lookup. Only fall through to the polygon hit-test when the
        // attribute is missing (rare).
        const tz = this.hass?.config?.time_zone;
        if (typeof tz === 'string' && tz) return tz;
        const home = this.resolveHomeLatLon();
        if (home && this.tzIanaData) {
          return (
            findIanaZoneForLatLon(this.tzIanaData, home.lat, home.lon) ??
            undefined
          );
        }
        return undefined;
      }
      case 'entity': {
        const id = this.config.mainTimeEntity;
        const state = id ? this.hass?.states?.[id] : undefined;
        const lat = state?.attributes?.latitude;
        const lon = state?.attributes?.longitude;
        if (
          typeof lat === 'number' &&
          typeof lon === 'number' &&
          this.tzIanaData
        ) {
          return (
            findIanaZoneForLatLon(this.tzIanaData, lat, lon) ?? undefined
          );
        }
        return undefined;
      }
    }
  }

  /**
   * Walk the configured markers, resolving each one's entity to a
   * (lat, lon, tzid) triple. Markers whose entity is missing or has
   * no numeric lat/lon are silently dropped so a stale config doesn't
   * crash the render. The tzid is null until the IANA dataset has
   * loaded — in that interim case we still render the dot, just with
   * no time line.
   */
  private resolveMarkers(): ResolvedMarker[] {
    if (!this.config || this.config.markers.length === 0) return [];
    const out: ResolvedMarker[] = [];
    for (const m of this.config.markers) {
      const state = this.hass?.states?.[m.entity];
      if (!state) continue;
      const lat = state.attributes?.latitude;
      const lon = state.attributes?.longitude;
      if (typeof lat !== 'number' || typeof lon !== 'number') continue;
      const friendly =
        typeof state.attributes?.friendly_name === 'string'
          ? (state.attributes.friendly_name as string)
          : m.entity;
      const label =
        (typeof m.label === 'string' && m.label.trim()) || friendly;
      const tzid = this.tzIanaData
        ? findIanaZoneForLatLon(this.tzIanaData, lat, lon)
        : null;
      out.push({
        entity: m.entity,
        label,
        // Per-marker > card-level > undefined (CSS variable wins).
        // sanitizeCssColor returns undefined for anything that doesn't
        // match the safe-color regex, so a malicious entry can't slip
        // a `; url(...)` into the inline style.
        color:
          sanitizeCssColor(m.color) ?? this.config.markerColor,
        lat,
        lon,
        tzid,
      });
    }
    return out;
  }

  override render(): TemplateResult {
    if (!this.config) return html``;

    // Two clocks: mapNow drives anything tied to the planet's
    // orientation (terminator, imagery, hour band, TZ overlay path);
    // displayNow drives the readout. When `frozenNow` is set both
    // collapse to the same value.
    const mapNow = this.config.frozenNow ?? this.mapNow;
    const displayNow = this.config.frozenNow ?? this.displayNow;

    const centerLon = this.resolveCenterLon(mapNow);
    const sub = subsolarPoint(mapNow);
    const curve = terminatorCurve(sub, { centerLon });
    const poly = terminatorPolygon(sub, { centerLon });
    const points = polygonToSvgPoints(poly, MAP_W, MAP_H);
    const curvePoints = polygonToSvgPoints(curve, MAP_W, MAP_H);

    // Twilight band → Gaussian σ in image-pixel space. Total fade
    // ≈ 8σ end-to-end; mapping elevation degrees → arc degrees → px
    // via the lat axis scale.
    const fadePxFull = (this.config.twilightDegrees * 2 * MAP_H) / 180;
    const sigma = Math.max(0.5, fadePxFull / 8);
    // Twilight glow polyline: thick stroke at the curve, then
    // softened with a smaller Gaussian. Together they paint a warm
    // band roughly the same width as the night-mask fade, but
    // additive (screen-blended) instead of subtractive — that's what
    // gives the terminator an atmospheric "rim of dusk" look.
    const glowStrokeWidth = Math.max(4, fadePxFull * 0.55);
    const glowBlurSigma = Math.max(1, fadePxFull / 5);

    const dayHref = this.config.imageryBase + dayImageForDate(mapNow);
    const nightHref = this.config.imageryBase + NIGHT_IMAGE;

    // Imagery offset for the configured centerLon. The source JPEGs
    // are Greenwich-centered (lon=0 at source x=W/2). We render the
    // source at output x = offsetPx and again at offsetPx − W so the
    // wraparound is covered by exactly two <image> tags. Both share
    // an href so the browser issues one HTTP request per layer.
    const offsetPx = (((-centerLon / 360) * MAP_W) % MAP_W + MAP_W) % MAP_W;

    // (Re)project overlays whenever the centerLon shifts OR a layer
    // exists in data form but hasn't been projected yet (the async
    // fetch usually arrives after the first render, so the initial
    // center-lon check would otherwise short-circuit the build).
    if (this.config.showTimezoneBoundaries) {
      const centerChanged = this.tzPolygonsCenterLon !== centerLon;
      if (this.tzData && (centerChanged || this.tzPolygons === null)) {
        this.tzPolygons = timezonesToPolygons(this.tzData, MAP_W, MAP_H, centerLon);
      }
      if (this.tzIanaData && (centerChanged || this.tzIanaPolygons === null)) {
        this.tzIanaPolygons = sortByVisualArea(
          ianaToPolygons(this.tzIanaData, MAP_W, MAP_H, centerLon),
        );
      }
      this.tzPolygonsCenterLon = centerLon;
    }

    const mainTz = this.resolveMainTimezone();
    const localTime = formatLocalTime(displayNow, mainTz);
    const utcTime = formatUtcTime(displayNow);
    const dateStr = formatDate(displayNow, mainTz);
    const markers = this.resolveMarkers();

    const showBand = this.config.showTimezoneBand;
    const yMin = showBand ? -BAND_H : 0;
    const totalH = showBand ? MAP_H + BAND_H : MAP_H;

    const frameStyle =
      `aspect-ratio: ${MAP_W} / ${totalH};` +
      ` --geo-day-brightness: ${this.config.dayBrightness};` +
      ` --geo-night-contrast: ${this.config.nightContrast};` +
      ` --geo-twilight-color: ${this.config.twilightColor};` +
      ` --geo-twilight-opacity: ${this.config.twilightOpacity};` +
      ` --geo-tz-line: ${this.config.timezoneLineColor};`;

    return html`
      <div class="frame" style="${frameStyle}">
        <svg
          viewBox="0 ${yMin} ${MAP_W} ${totalH}"
          preserveAspectRatio="xMidYMid slice"
          aria-label="World map with current day/night terminator"
        >
          <defs>
            <filter
              id="feather"
              x="-5%"
              y="-5%"
              width="110%"
              height="110%"
              filterUnits="objectBoundingBox"
            >
              <feGaussianBlur stdDeviation="${sigma}" />
            </filter>
            <mask
              id="night-mask"
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="${MAP_W}"
              height="${MAP_H}"
            >
              <rect width="${MAP_W}" height="${MAP_H}" fill="black" />
              <polygon points="${points}" fill="white" filter="url(#feather)" />
            </mask>
            <filter
              id="twilight-blur"
              x="-3%"
              y="-3%"
              width="106%"
              height="106%"
              filterUnits="objectBoundingBox"
            >
              <feGaussianBlur stdDeviation="${glowBlurSigma}" />
            </filter>
          </defs>

          <image class="day-image" href="${dayHref}"
                 x="${offsetPx - MAP_W}" y="0"
                 width="${MAP_W}" height="${MAP_H}"
                 preserveAspectRatio="none"/>
          <image class="day-image" href="${dayHref}"
                 x="${offsetPx}" y="0"
                 width="${MAP_W}" height="${MAP_H}"
                 preserveAspectRatio="none"/>
          <image class="night-image" href="${nightHref}"
                 x="${offsetPx - MAP_W}" y="0"
                 width="${MAP_W}" height="${MAP_H}"
                 preserveAspectRatio="none"
                 mask="url(#night-mask)"/>
          <image class="night-image" href="${nightHref}"
                 x="${offsetPx}" y="0"
                 width="${MAP_W}" height="${MAP_H}"
                 preserveAspectRatio="none"
                 mask="url(#night-mask)"/>

          <polyline class="twilight-glow"
                    points="${curvePoints}"
                    stroke-width="${glowStrokeWidth}"
                    filter="url(#twilight-blur)"/>

          ${this.tzPolygons && this.config.showTimezoneBoundaries
            ? this.tzPolygons.map(
                (p) => svg`<path class="tz-region" d="${p.d}"
                                 @pointerenter=${(e: PointerEvent) => this.onOffsetEnter(e, p)}
                                 @pointermove=${this.onZoneMove}
                                 @pointerleave=${this.onOffsetLeave}/>`,
              )
            : ''}
          ${this.tzIanaPolygons && this.config.showTimezoneBoundaries
            ? this.tzIanaPolygons.map(
                (p) => svg`<path class="tz-iana-region${
                                  this.hoveredIana === p ? ' is-active' : ''
                                }" d="${p.d}"
                                 @pointerenter=${(e: PointerEvent) => this.onIanaEnter(e, p)}
                                 @pointermove=${this.onZoneMove}
                                 @pointerleave=${this.onIanaLeave}/>`,
              )
            : ''}

          ${showBand ? timezoneBand(mapNow, MAP_W, centerLon) : ''}
        </svg>
        ${this.config.showHomeMarker
          ? this.renderHomeMarkerOverlay(
              displayNow,
              centerLon,
              yMin,
              totalH,
            )
          : ''}
        ${markers.length > 0
          ? this.renderMarkerOverlay(
              markers,
              displayNow,
              centerLon,
              yMin,
              totalH,
            )
          : ''}
        <div class="readout">
          <div class="local-time">${localTime}</div>
          ${this.config.showUTC
            ? html`<div class="utc-time">${utcTime}</div>`
            : ''}
        </div>
        <div class="date">${dateStr}</div>
        ${this.renderPopup(displayNow)}
      </div>
    `;
  }

  getCardSize(): number {
    return 4;
  }

  /** HA Lovelace hook: returns an element instance for the visual
   *  card editor. Lazy-imported so the editor's HA-component
   *  dependencies don't bloat the runtime card bundle. */
  static async getConfigElement(): Promise<HTMLElement> {
    await import('./geo-clock-card-editor.js');
    return document.createElement('geo-clock-card-editor');
  }

  /** Returns a sensible default config for the card-picker preview. */
  static getStubConfig(): GeoClockCardConfig {
    return { type: 'custom:geo-clock-card', center: 'sun' };
  }

  /** Set when the user is touching the screen — the hover handlers
   *  use this to keep the popup visible after lift instead of
   *  dismissing immediately. */
  private dismissTimer?: ReturnType<typeof setTimeout>;
  private static readonly TOUCH_DISMISS_MS = 2500;

  private clearDismissTimer(): void {
    if (this.dismissTimer !== undefined) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = undefined;
    }
  }

  private onIanaEnter = (e: PointerEvent, p: IanaPolygon): void => {
    this.clearDismissTimer();
    this.hoveredIana = p;
    this.updateHoverPos(e);
    if (e.pointerType === 'touch') this.armTouchAutoDismiss();
  };

  private onIanaLeave = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') {
      this.scheduleTouchDismiss(() => {
        this.hoveredIana = null;
        if (!this.hoveredOffset && !this.hoveredMarker) {
          this.hoverPos = null;
        }
      });
      return;
    }
    this.hoveredIana = null;
    if (!this.hoveredOffset && !this.hoveredMarker) {
      this.hoverPos = null;
    }
  };

  private onOffsetEnter = (e: PointerEvent, p: TzPolygon): void => {
    this.clearDismissTimer();
    this.hoveredOffset = p;
    this.updateHoverPos(e);
    if (e.pointerType === 'touch') this.armTouchAutoDismiss();
  };

  private onOffsetLeave = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') {
      this.scheduleTouchDismiss(() => {
        this.hoveredOffset = null;
        if (!this.hoveredIana && !this.hoveredMarker) {
          this.hoverPos = null;
        }
      });
      return;
    }
    this.hoveredOffset = null;
    if (!this.hoveredIana && !this.hoveredMarker) {
      this.hoverPos = null;
    }
  };

  private onZoneMove = (e: PointerEvent): void => {
    this.updateHoverPos(e);
  };

  private scheduleTouchDismiss(action: () => void): void {
    this.clearDismissTimer();
    this.dismissTimer = setTimeout(() => {
      this.dismissTimer = undefined;
      action();
    }, GeoClockCard.TOUCH_DISMISS_MS);
  }

  private updateHoverPos(e: MouseEvent): void {
    const frame = (e.currentTarget as Element).closest('.frame');
    if (!frame) return;
    const r = frame.getBoundingClientRect();
    this.hoverPos = { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /** Render the HA-configured home as an HTML overlay sibling of the
   *  SVG. Same percentage-positioning trick as renderMarkerOverlay so
   *  the dot tracks the map's drift, but the dot, halo, and (optional)
   *  label + time stay at fixed CSS pixel size. The marker color
   *  comes from the existing `--geo-home-marker` CSS variable rather
   *  than a per-marker fill, preserving theme support.
   */
  private renderHomeMarkerOverlay(
    displayNow: Date,
    centerLon: number,
    yMin: number,
    totalH: number,
  ): TemplateResult | string {
    const home = this.resolveHomeLatLon();
    if (!home) return '';
    if (!this.config) return '';
    const { x, y } = latLonToPx(home.lat, home.lon, MAP_W, MAP_H, centerLon);
    const leftPct = (x / MAP_W) * 100;
    const topPct = ((y - yMin) / totalH) * 100;
    const showLabel = this.config.showHomeMarkerLabel;
    const tz = this.resolveHomeTimezone();
    const label =
      this.hass?.config?.location_name &&
      typeof this.hass.config.location_name === 'string'
        ? this.hass.config.location_name
        : 'Home';
    const time = tz
      ? formatMarkerTime(displayNow, tz, this.config.markerShowDay)
      : '';
    return html`
      <div
        class="marker home-marker"
        style="left: ${leftPct}%; top: ${topPct}%;"
      >
        <div class="marker-halo"></div>
        <div class="marker-dot"></div>
        ${showLabel
          ? html`
              <div class="marker-text">
                <div class="marker-label">${label}</div>
                ${time
                  ? html`<div class="marker-time">${time}</div>`
                  : ''}
              </div>
            `
          : ''}
      </div>
    `;
  }

  /** Resolve the IANA tzid the HOME marker should use for its time
   *  display — same logic as the home branch of resolveMainTimezone
   *  but pulled out so the home marker can compute its time
   *  independently of `mainTimeSource`. */
  private resolveHomeTimezone(): string | undefined {
    const tz = this.hass?.config?.time_zone;
    if (typeof tz === 'string' && tz) return tz;
    const home = this.resolveHomeLatLon();
    if (home && this.tzIanaData) {
      return (
        findIanaZoneForLatLon(this.tzIanaData, home.lat, home.lon) ??
        undefined
      );
    }
    return undefined;
  }

  /**
   * Render every configured marker as an HTML overlay sibling of the
   * SVG. We project the marker to viewBox pixel coords via
   * latLonToPx, then express the result as percentages of the
   * frame's total width/height so the overlay tracks the map as it
   * resizes — but the dot, halo, and label text are sized in CSS
   * pixels and stay legible at any card width. Hover hit-testing is
   * on the dot itself (the only child with pointer-events: auto),
   * matching the SVG behavior we replaced.
   */
  private renderMarkerOverlay(
    markers: ResolvedMarker[],
    displayNow: Date,
    centerLon: number,
    yMin: number,
    totalH: number,
  ) {
    if (!this.config) return '';
    const mode = this.config.markerLabelMode;
    return markers.map((m) => {
      const { x, y } = latLonToPx(m.lat, m.lon, MAP_W, MAP_H, centerLon);
      const leftPct = (x / MAP_W) * 100;
      const topPct = ((y - yMin) / totalH) * 100;
      const time = m.tzid
        ? formatMarkerTime(displayNow, m.tzid, this.config!.markerShowDay)
        : '';
      const isActive = this.hoveredMarker?.entity === m.entity;
      // When color is undefined we deliberately omit the inline
      // background so the `.marker-halo` / `.marker-dot` CSS rules
      // can fall through to var(--geo-marker-color) — that's the
      // theme-override path for users who'd rather restyle than
      // configure each card.
      const fillStyle = m.color ? `background: ${m.color};` : '';
      return html`
        <div
          class="marker${isActive ? ' is-active' : ''}"
          style="left: ${leftPct}%; top: ${topPct}%;"
        >
          <div class="marker-halo" style=${fillStyle}></div>
          <div
            class="marker-dot"
            style=${fillStyle}
            @pointerenter=${(e: PointerEvent) => this.onMarkerEnter(e, m)}
            @pointermove=${this.onZoneMove}
            @pointerleave=${this.onMarkerLeave}
          ></div>
          ${mode === 'always'
            ? html`
                <div class="marker-text">
                  <div class="marker-label">${m.label}</div>
                  ${time
                    ? html`<div class="marker-time">${time}</div>`
                    : ''}
                </div>
              `
            : ''}
        </div>
      `;
    });
  }

  private onMarkerEnter = (e: PointerEvent, m: ResolvedMarker): void => {
    this.clearDismissTimer();
    this.hoveredMarker = m;
    this.updateHoverPos(e);
    if (e.pointerType === 'touch') this.armTouchAutoDismiss();
  };

  private onMarkerLeave = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') {
      this.scheduleTouchDismiss(() => {
        this.hoveredMarker = null;
        if (!this.hoveredIana && !this.hoveredOffset) this.hoverPos = null;
      });
      return;
    }
    this.hoveredMarker = null;
    if (!this.hoveredIana && !this.hoveredOffset) this.hoverPos = null;
  };

  /**
   * Schedule a blanket popup-dismissal after TOUCH_DISMISS_MS. iOS
   * Safari (and several Android browsers) don't fire pointerleave
   * on tap-and-release, so the existing leave-handler dismissal
   * never runs on mobile and a popup gets stuck on-screen until
   * the user taps another region. Calling this on pointerenter
   * with pointerType 'touch' guarantees the popup will clear after
   * a readable interval regardless of whether leave ever fires.
   *
   * Tapping a different region calls clearDismissTimer via the next
   * onIanaEnter / onOffsetEnter / onMarkerEnter, so the new popup
   * gets its own fresh timer and the old one is cancelled.
   */
  private armTouchAutoDismiss(): void {
    this.scheduleTouchDismiss(() => {
      this.hoveredIana = null;
      this.hoveredOffset = null;
      this.hoveredMarker = null;
      this.hoverPos = null;
    });
  }

  private renderPopup(displayNow: Date): TemplateResult {
    if (!this.hoverPos) return html``;
    if (this.config?.showTimezonePopup === false) return html``;

    // Position the popup near the cursor:
    //  - horizontal: lower-right by default; flip to the left when
    //    past the canvas midline so it doesn't fall off the right edge.
    //  - vertical:   below the cursor by default; flip to ABOVE when
    //    the cursor is in the bottom half so the popup doesn't fall
    //    off the bottom edge of the card.
    // The vertical flip uses translateY(-100%) so we don't need to
    // measure the popup's actual height.
    const frame = this.shadowRoot?.querySelector('.frame') as HTMLElement | null;
    const w = frame?.clientWidth ?? 1280;
    const h = frame?.clientHeight ?? 720;
    const flipX = this.hoverPos.x > w * 0.55;
    const flipY = this.hoverPos.y > h * 0.5;
    const popupOffsetX = flipX ? -260 : 14;
    const popupOffsetY = flipY ? -14 : 14;
    const yShift = flipY ? ' translateY(-100%)' : '';
    const style =
      `transform: translate(${this.hoverPos.x + popupOffsetX}px, ` +
      `${this.hoverPos.y + popupOffsetY}px)${yShift};`;

    // Marker hover takes priority over both TZ layers — the user
    // explicitly placed the marker, so its label is the more
    // informative thing to show.
    if (this.hoveredMarker) {
      const m = this.hoveredMarker;
      if (m.tzid) {
        const live = zoneNow(displayNow, m.tzid);
        return html`
          <div class="tz-popup" style=${style}>
            <div class="tz-popup-time">${live.time}</div>
            <div class="tz-popup-date">${live.date}</div>
            <div class="tz-popup-name">${m.label}</div>
            <div class="tz-popup-offset">${live.offset} · ${m.tzid}</div>
          </div>
        `;
      }
      return html`
        <div class="tz-popup" style=${style}>
          <div class="tz-popup-name">${m.label}</div>
          <div class="tz-popup-offset">${m.entity}</div>
        </div>
      `;
    }
    // IANA hover takes priority — it's DST-aware and represents an
    // actual jurisdiction. Fall back to the offset overlay when the
    // cursor is over open ocean / Antarctica strips with no IANA
    // polygon coverage.
    if (this.hoveredIana) {
      const z = this.hoveredIana;
      const live = zoneNow(displayNow, z.tzid);
      return html`
        <div class="tz-popup" style=${style}>
          <div class="tz-popup-time">${live.time}</div>
          <div class="tz-popup-date">${live.date}</div>
          <div class="tz-popup-name">${live.name}</div>
          <div class="tz-popup-city">${z.cityLabel}</div>
          <div class="tz-popup-offset">${live.offset} · ${z.tzid}</div>
        </div>
      `;
    }
    if (this.hoveredOffset) {
      const z = this.hoveredOffset;
      const live = atOffset(displayNow, z.offset);
      return html`
        <div class="tz-popup" style=${style}>
          <div class="tz-popup-time">${live.time}</div>
          <div class="tz-popup-date">${live.date}</div>
          ${z.name
            ? html`<div class="tz-popup-name">${z.name}</div>`
            : ''}
          <div class="tz-popup-offset">${z.offsetLabel}</div>
          ${z.places
            ? html`<div class="tz-popup-places">${z.places}</div>`
            : ''}
        </div>
      `;
    }
    return html``;
  }
}

/** Locale-formatted time + date at a numeric UTC offset. Used for
 *  the offset popup branch (open ocean / Antarctic strips that have
 *  no IANA tzid). We shift UTC by the offset and feed the shifted
 *  Date into Intl with `timeZone: 'UTC'` so the runtime locale
 *  decides 24-hour vs AM/PM but no further zone math is applied. */
function atOffset(
  now: Date,
  offsetHours: number,
): { time: string; date: string } {
  const shifted = new Date(now.getTime() + offsetHours * 3_600_000);
  const time = new Intl.DateTimeFormat(undefined, {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(shifted);
  const date = new Intl.DateTimeFormat(undefined, {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(shifted);
  return { time, date };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Sort polygons by visual bounding-box area DESCENDING so that big
 * zones (Russia, Antarctica) render first and small ones (Bermuda,
 * Cayman, Vatican-style enclaves) render last. In SVG, later siblings
 * sit on top of earlier ones for hit-testing, so this gives small
 * islands hover priority over their continent-sized neighbors. We
 * estimate area cheaply by parsing the path's M/L coords for the
 * bounding box; full polygon area would require triangulation.
 */
function sortByVisualArea(polys: IanaPolygon[]): IanaPolygon[] {
  const area = (d: string): number => {
    let xMin = Infinity;
    let yMin = Infinity;
    let xMax = -Infinity;
    let yMax = -Infinity;
    // Match coord pairs that follow M or L commands.
    const re = /[ML]([\d.\-]+),([\d.\-]+)/g;
    let m;
    while ((m = re.exec(d))) {
      const x = parseFloat(m[1]);
      const y = parseFloat(m[2]);
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
    if (!isFinite(xMin)) return 0;
    return (xMax - xMin) * (yMax - yMin);
  };
  return [...polys].sort((a, b) => area(b.d) - area(a.d));
}

function parseFrozenNow(input: string | number | Date | undefined): Date | undefined {
  if (input == null) return undefined;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

/**
 * Restrict twilightColor to a small, well-known set of CSS color
 * forms. We splice this value into a `style` attribute, and Lit's
 * attribute-escaping already prevents breaking out of the attribute
 * — but a value like `red; background: url(http://attacker.tld/x)`
 * would still inject a rule that pings the URL. Locking the input
 * to hex / rgb[a] / hsl[a] / named-color forms closes that vector.
 * Returns undefined for anything unrecognized so the caller can
 * fall back to its default.
 */
function sanitizeCssColor(input: string | undefined): string | undefined {
  if (typeof input !== 'string') return undefined;
  const v = input.trim();
  // #abc, #abcd, #aabbcc, #aabbccdd
  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return v;
  // rgb(...) / rgba(...) / hsl(...) / hsla(...) — digits, dots, commas,
  // percent, whitespace, slashes (CSS-color-4 syntax). No semicolons,
  // braces, or url().
  if (/^(?:rgb|rgba|hsl|hsla)\([\d.,%\s/]+\)$/i.test(v)) return v;
  // Plain alphabetic CSS color names (red, transparent, currentcolor…)
  if (/^[a-z]+$/i.test(v)) return v;
  return undefined;
}

/**
 * Marker time format, tailored for the on-map label.
 *
 * Time format is locale-aware ("12:22 PM" en-US / "12:22" en-GB) and
 * we deliberately drop seconds — markers update every map tick
 * (usually 10 s) so a second hand jitters distractingly.
 *
 * When `withDay` is true we append the weekday ("12:22 PM Friday")
 * so a marker on the far side of the planet whose date has rolled
 * over is obvious at a glance next to your home's "9:22 PM Friday".
 * We use two separate Intl formatters and concatenate manually rather
 * than letting `Intl.DateTimeFormat` interleave the parts itself —
 * Intl puts the weekday first in most locales ("Friday, 12:22 PM"),
 * and on a marker label readers want to scan time first, day second.
 */
function formatMarkerTime(d: Date, tz: string | undefined, withDay: boolean): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    ...(tz ? { timeZone: tz } : {}),
  };
  const time = new Intl.DateTimeFormat(undefined, opts).format(d);
  if (!withDay) return time;
  const dayOpts: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    ...(tz ? { timeZone: tz } : {}),
  };
  const day = new Intl.DateTimeFormat(undefined, dayOpts).format(d);
  return `${time} ${day}`;
}

function formatLocalTime(d: Date, tz?: string): string {
  // When a tz is supplied, the readout shows that zone's wall time
  // (DST-aware via Intl). Without one we fall through to the
  // browser's default zone — Pre-0.2.0 behavior.
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
    ...(tz ? { timeZone: tz } : {}),
  });
}

function formatUtcTime(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} UTC`;
}

function formatDate(d: Date, tz?: string): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(tz ? { timeZone: tz } : {}),
  });
}

/** A marker after we've resolved its entity to live coordinates +
 *  timezone. `tzid` may be null when the IANA dataset hasn't loaded
 *  yet — the marker still renders, just without a time line. `color`
 *  is undefined when neither the per-marker nor card-level default
 *  is set; the renderer skips the inline `style` so the
 *  `--geo-marker-color` CSS variable wins. */
interface ResolvedMarker {
  entity: string;
  label: string;
  color: string | undefined;
  lat: number;
  lon: number;
  tzid: string | null;
}

/** Trim and validate the raw marker config. Drops entries with no
 *  entity ID; otherwise leaves `label`/`color` as-is for the
 *  resolveMarkers() step to combine with the entity's friendly_name
 *  and the card-level default color. */
function sanitizeMarkers(
  input: GeoClockCardConfig['markers'],
): MarkerConfig[] {
  if (!Array.isArray(input)) return [];
  const out: MarkerConfig[] = [];
  for (const raw of input) {
    if (!raw || typeof raw.entity !== 'string') continue;
    const entity = raw.entity.trim();
    if (!entity) continue;
    out.push({
      entity,
      label:
        typeof raw.label === 'string' && raw.label.trim() !== ''
          ? raw.label
          : undefined,
      color: typeof raw.color === 'string' ? raw.color : undefined,
    });
  }
  return out;
}

function pickMainTimeSource(
  input: GeoClockCardConfig['mainTimeSource'],
): 'home' | 'device' | 'entity' {
  if (input === 'device' || input === 'entity') return input;
  return 'home';
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'geo-clock-card',
  name: 'Geo Clock Card',
  description:
    'World map with a live day/night terminator (NASA Blue/Black Marble).',
  preview: true,
});
