import { LitElement, html, css, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { subsolarPoint } from './sun.js';
import { terminatorCurve, terminatorPolygon } from './terminator.js';
import { polygonToSvgPoints } from './projection.js';
import { timezoneBand, BAND_H } from './timezone-band.js';
import { loadTimezones, timezonesToPolygons, type TzPolygon } from './timezones.js';
import {
  loadIanaTimezones,
  ianaToPolygons,
  zoneNow,
  type IanaPolygon,
} from './timezones-iana.js';
import { dayImageForDate } from './day-image.js';
import type { GeoClockCardConfig, ResolvedConfig } from './types.js';

// Equirectangular working canvas. The SVG scales to fit, so this is
// just internal coordinate space for the polygon math + image extents.
const MAP_W = 2048;
const MAP_H = 1024;

const NIGHT_IMAGE = 'black-marble-2048.jpg';
const TZ_DATA = 'timezones.json';
const TZ_IANA_DATA = 'timezones-iana.json';


// Fallback when 'home' mode is requested but hass.config.longitude is
// unavailable — used during the dev preview and as a safe default for
// users who haven't set their HA location yet. Roughly central California.
const DEFAULT_HOME_LON = -119;

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

interface HassLike {
  config?: { longitude?: number; latitude?: number };
}

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
  @state() private hoverPos: { x: number; y: number } | null = null;

  private config?: ResolvedConfig;
  private timer?: ReturnType<typeof setInterval>;

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
      --geo-tz-line: rgba(255, 255, 255, 0.45);
      --geo-tz-line-width: 1.1;
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
      stroke: none;
      pointer-events: visiblePainted;
      cursor: default;
      transition: fill 120ms ease;
    }
    .tz-iana-region:hover {
      fill: rgba(255, 255, 255, 0.07);
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
      dayBrightness: clamp(config.dayBrightness ?? 1.15, 0, 5),
      nightContrast: clamp(config.nightContrast ?? 1, 0, 5),
      twilightColor: config.twilightColor ?? '#463701',
      twilightOpacity: clamp(config.twilightOpacity ?? 0.26, 0, 1),
      imageryBase: base.endsWith('/') ? base : base + '/',
      center: config.center ?? 'antimeridian',
      homeLongitude: config.homeLongitude,
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
    this.restartTimer();
    this.maybeLoadTimezones();
    this.maybeLoadIanaTimezones();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopTimer();
  }

  private restartTimer(): void {
    this.stopTimer();
    if (!this.config || !this.isConnected) return;
    if (this.config.frozenNow) return; // frozen clock — no timer
    this.timer = setInterval(() => this.tick(), this.config.updateInterval * 1000);
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
    if (!this.config?.showTimezoneBoundaries || this.tzIanaData !== null) return;
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

  /**
   * Resolve the longitude (degrees, signed) that should appear at the
   * center of the map. Driven by mapNow — for 'sun' mode this means
   * the map shifts only when the subsolar longitude has moved enough
   * to be visible (≥0.5 px at 4K).
   */
  private resolveCenterLon(mapNow: Date): number {
    if (!this.config) return 180;
    switch (this.config.center) {
      case 'sun':
        return subsolarPoint(mapNow).lon;
      case 'home': {
        const hassLon = this.hass?.config?.longitude;
        if (typeof hassLon === 'number') return hassLon;
        return this.config.homeLongitude ?? DEFAULT_HOME_LON;
      }
      case 'antimeridian':
      default:
        return 180;
    }
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

    const localTime = formatLocalTime(displayNow);
    const utcTime = formatUtcTime(displayNow);
    const dateStr = formatDate(displayNow);

    const showBand = this.config.showTimezoneBand;
    const yMin = showBand ? -BAND_H : 0;
    const totalH = showBand ? MAP_H + BAND_H : MAP_H;

    const frameStyle =
      `aspect-ratio: ${MAP_W} / ${totalH};` +
      ` --geo-day-brightness: ${this.config.dayBrightness};` +
      ` --geo-night-contrast: ${this.config.nightContrast};` +
      ` --geo-twilight-color: ${this.config.twilightColor};` +
      ` --geo-twilight-opacity: ${this.config.twilightOpacity};`;

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
                                 @mouseenter=${(e: MouseEvent) => this.onOffsetEnter(e, p)}
                                 @mousemove=${this.onZoneMove}
                                 @mouseleave=${this.onOffsetLeave}/>`,
              )
            : ''}
          ${this.tzIanaPolygons && this.config.showTimezoneBoundaries
            ? this.tzIanaPolygons.map(
                (p) => svg`<path class="tz-iana-region" d="${p.d}"
                                 @mouseenter=${(e: MouseEvent) => this.onIanaEnter(e, p)}
                                 @mousemove=${this.onZoneMove}
                                 @mouseleave=${this.onIanaLeave}/>`,
              )
            : ''}

          ${showBand ? timezoneBand(mapNow, MAP_W, centerLon) : ''}
        </svg>
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

  private onIanaEnter = (e: MouseEvent, p: IanaPolygon): void => {
    this.hoveredIana = p;
    this.updateHoverPos(e);
  };

  private onIanaLeave = (): void => {
    this.hoveredIana = null;
    if (!this.hoveredOffset) this.hoverPos = null;
  };

  private onOffsetEnter = (e: MouseEvent, p: TzPolygon): void => {
    this.hoveredOffset = p;
    this.updateHoverPos(e);
  };

  private onOffsetLeave = (): void => {
    this.hoveredOffset = null;
    if (!this.hoveredIana) this.hoverPos = null;
  };

  private onZoneMove = (e: MouseEvent): void => {
    this.updateHoverPos(e);
  };

  private updateHoverPos(e: MouseEvent): void {
    const frame = (e.currentTarget as Element).closest('.frame');
    if (!frame) return;
    const r = frame.getBoundingClientRect();
    this.hoverPos = { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private renderPopup(displayNow: Date): TemplateResult {
    if (!this.hoverPos) return html``;

    // Position the popup to the lower-right of the cursor; flip
    // to the left side when past the midline so it doesn't fall
    // off the right edge.
    const frame = this.shadowRoot?.querySelector('.frame') as HTMLElement | null;
    const w = frame?.clientWidth ?? 1280;
    const flip = this.hoverPos.x > w * 0.55;
    const popupOffsetX = flip ? -260 : 14;
    const popupOffsetY = 14;
    const transform =
      `translate(${this.hoverPos.x + popupOffsetX}px, ${this.hoverPos.y + popupOffsetY}px)`;
    const style = `transform: ${transform};`;

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
          <div class="tz-popup-name">${live.name}</div>
          <div class="tz-popup-city">${z.cityLabel}</div>
          <div class="tz-popup-offset">${live.offset} · ${z.tzid}</div>
        </div>
      `;
    }
    if (this.hoveredOffset) {
      const z = this.hoveredOffset;
      const time = formatTimeAtOffset(displayNow, z.offset);
      return html`
        <div class="tz-popup" style=${style}>
          <div class="tz-popup-time">${time}</div>
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

function formatTimeAtOffset(now: Date, offsetHours: number): string {
  // Shift UTC by the offset, then read the result with UTC getters
  // (so we don't double-apply the runner's local timezone). Used for
  // ocean fallback where there's no IANA tzid to feed Intl.
  const shifted = new Date(now.getTime() + offsetHours * 3_600_000);
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  const ss = String(shifted.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
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

function formatLocalTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

function formatUtcTime(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} UTC`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'geo-clock-card',
  name: 'Geo Clock Card',
  description:
    'World map with a live day/night terminator (NASA Blue/Black Marble).',
  preview: true,
});
