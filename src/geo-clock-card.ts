import { LitElement, html, css, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { subsolarPoint } from './sun.js';
import { terminatorCurve, terminatorPolygon } from './terminator.js';
import { polygonToSvgPoints } from './projection.js';
import { timezoneBand, BAND_H } from './timezone-band.js';
import { loadTimezones, timezonesToPathD } from './timezones.js';
import type { GeoClockCardConfig, ResolvedConfig } from './types.js';

// Equirectangular working canvas. The SVG scales to fit, so this is
// just internal coordinate space for the polygon math + image extents.
const MAP_W = 2048;
const MAP_H = 1024;

const NIGHT_IMAGE = 'black-marble-2048.jpg';
const TZ_DATA = 'timezones.json';

/** Returns the day-image filename for a given UTC date. The bundle
 *  ships 12 monthly Blue Marble composites (mid-month frames from
 *  NASA SVS dataset 3523); this just snaps to the current month. A
 *  smoother rendering could blend two frames by day-of-month, but
 *  the visible difference is small. */
function dayImageForDate(d: Date): string {
  const month = d.getUTCMonth() + 1; // 1..12
  return `blue-marble-${String(month).padStart(2, '0')}-2048.jpg`;
}

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
  @state() private tzPathD: string | null = null;
  /** centerLon used the last time we built the TZ overlay path. If the
   *  centerLon changes, we need to re-project the overlay. */
  private tzPathCenterLon: number | null = null;
  private tzData: Awaited<ReturnType<typeof loadTimezones>> | null = null;

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
      --geo-night-contrast: 0.85;
      --geo-twilight-color: #463701;
      --geo-twilight-opacity: 0.26;
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

    /* Time-zone boundary overlay */
    .tz-overlay {
      fill: none;
      stroke: var(--geo-tz-line);
      stroke-width: var(--geo-tz-line-width);
      stroke-linejoin: round;
      stroke-linecap: round;
      pointer-events: none;
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
      nightContrast: clamp(config.nightContrast ?? 0.85, 0, 5),
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
    // New config might change centerLon → invalidate cached path.
    this.tzPathD = null;
    this.tzPathCenterLon = null;
    this.restartTimer();
    this.maybeLoadTimezones();
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

    // Re-project the TZ overlay if the user's centerLon changed since
    // the last time we built it.
    if (
      this.tzData &&
      this.config.showTimezoneBoundaries &&
      (this.tzPathD === null || this.tzPathCenterLon !== centerLon)
    ) {
      this.tzPathD = timezonesToPathD(this.tzData, MAP_W, MAP_H, centerLon);
      this.tzPathCenterLon = centerLon;
    }

    const localTime = formatLocalTime(displayNow);
    const utcTime = formatUtcTime(displayNow);
    const dateStr = formatDate(displayNow);

    const showBand = this.config.showTimezoneBand;
    const yMin = showBand ? -BAND_H : 0;
    const totalH = showBand ? MAP_H + BAND_H : MAP_H;

    const frameStyle =
      `aspect-ratio: ${MAP_W} / ${totalH};` +
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

          <image href="${dayHref}"
                 x="${offsetPx - MAP_W}" y="0"
                 width="${MAP_W}" height="${MAP_H}"
                 preserveAspectRatio="none"/>
          <image href="${dayHref}"
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

          ${this.tzPathD && this.config.showTimezoneBoundaries
            ? svg`<path class="tz-overlay" d="${this.tzPathD}"/>`
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
      </div>
    `;
  }

  getCardSize(): number {
    return 4;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
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
