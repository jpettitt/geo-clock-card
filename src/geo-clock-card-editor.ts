// Visual card editor for geo-clock-card. Surfaces every config option
// the user is likely to tweak through Home Assistant's Lovelace UI.
//
// We use HA's frontend components (`ha-textfield`, `ha-switch`,
// `ha-formfield`, `ha-selector`). The catch: `ha-selector` (and the
// entity picker it composes) is only registered AFTER HA's card-helper
// bundle loads. Calling `await window.loadCardHelpers()` in setConfig
// — and gating the first render on its completion — forces that
// registration. Without it, the picker tags appear in the DOM as inert
// HTMLElements that render nothing.

import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  GeoClockCardConfig,
  HassLike,
  MarkerConfig,
  MainTimeSource,
} from './types.js';

@customElement('geo-clock-card-editor')
export class GeoClockCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HassLike;
  @state() private _config?: GeoClockCardConfig;
  /** Set once `loadCardHelpers()` resolves. We don't use the helper
   *  object's API directly — its mere import is what triggers HA to
   *  register `ha-selector` and friends. Render is gated on this
   *  becoming truthy so we never emit pickers before they upgrade. */
  @state() private _helpers?: unknown;

  setConfig(config: GeoClockCardConfig): void {
    this._config = config;
    void this.loadCardHelpers();
  }

  /**
   * Load HA's card-helper bundle. We never call methods on the
   * returned helpers object — its mere import is the side-effect we
   * need, because it transitively pulls in `<ha-selector>` and the
   * pickers it composes. Without this call those tags mount as
   * inert HTMLElements that never upgrade. The result is typed as
   * `unknown` to make the "we don't use it" intent explicit.
   *
   * Outside HA (dev preview, tests) `loadCardHelpers` doesn't exist;
   * we still set a sentinel so the render gate doesn't deadlock.
   */
  private async loadCardHelpers(): Promise<void> {
    if (this._helpers) return;
    try {
      const fn = (window as unknown as {
        loadCardHelpers?: () => Promise<unknown>;
      }).loadCardHelpers;
      if (typeof fn !== 'function') {
        this._helpers = {};
        return;
      }
      this._helpers = await fn();
    } catch (err) {
      console.warn('geo-clock-card editor: loadCardHelpers failed', err);
      this._helpers = {};
    }
  }


  static override styles = css`
    :host {
      display: block;
    }
    .section {
      padding: 12px 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .section + .section {
      border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    .section-title {
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--primary-text-color, #000);
      margin-bottom: 4px;
    }
    .help {
      font-size: 0.8rem;
      color: var(--secondary-text-color, #666);
      margin-top: -6px;
    }
    ha-textfield,
    ha-select {
      width: 100%;
    }
    ha-formfield {
      display: block;
      padding: 4px 0;
    }
    .color-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .color-row label {
      flex: 1;
      font-size: 0.95rem;
      color: var(--primary-text-color);
    }
    .color-row input[type='color'] {
      width: 56px;
      height: 32px;
      padding: 0;
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
      border-radius: 4px;
      cursor: pointer;
      background: transparent;
    }
    /* Native select styled to match HA's input look. We use this for
       the center-mode dropdown because ha-select's selected event
       has been fragile across HA frontend versions. */
    .native-select {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .native-select label {
      font-size: 0.85rem;
      color: var(--secondary-text-color, #666);
    }
    .native-select select {
      width: 100%;
      padding: 12px 8px;
      font-size: 1rem;
      color: var(--primary-text-color, #000);
      background: var(--card-background-color, #fff);
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
      border-radius: 4px;
      box-sizing: border-box;
    }
    /* Marker rows: each gets entity picker + label + color + remove. */
    .marker-row {
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
      border-radius: 6px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
    }
    .marker-row .row-head {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .marker-row .row-head .row-title {
      flex: 1;
      font-weight: 600;
      font-size: 0.9rem;
    }
    .marker-row button.remove {
      background: transparent;
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
      color: var(--primary-text-color, #000);
      border-radius: 4px;
      padding: 4px 10px;
      cursor: pointer;
    }
    .add-marker {
      align-self: flex-start;
      padding: 6px 14px;
      border: 1px solid var(--primary-color, #03a9f4);
      background: transparent;
      color: var(--primary-color, #03a9f4);
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .breaking-note {
      font-size: 0.8rem;
      color: var(--warning-color, #f4a700);
      margin-top: -4px;
    }
    ha-selector {
      display: block;
      width: 100%;
    }
  `;

  /** Emit a config-changed event with `field` set (or removed when
   *  the value is undefined / empty string / null). Bubbles + composed
   *  so HA's editor host catches it. HA pushes the new config back via
   *  setConfig(), which is what triggers the editor's re-render —
   *  we deliberately don't update _config locally to avoid double
   *  renders / racy state with HA's roundtrip. */
  private fire(field: keyof GeoClockCardConfig, value: unknown): void {
    if (!this._config) return;
    const next: Record<string, unknown> = { ...this._config };
    if (value === undefined || value === '' || value === null) {
      delete next[field as string];
    } else {
      next[field as string] = value;
    }
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: next },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private numField(field: keyof GeoClockCardConfig) {
    return (e: Event) => {
      const v = (e.target as HTMLInputElement).value;
      if (v === '') {
        this.fire(field, undefined);
        return;
      }
      // Guard non-numeric entry: Number('abc') is NaN, and NaN
      // propagates straight through the card's clamp() (Math.max/min
      // both return NaN) into CSS filter values, visually breaking
      // the map until the field is corrected. Treat garbage as
      // "unset" instead.
      const n = Number(v);
      this.fire(field, Number.isFinite(n) ? n : undefined);
    };
  }


  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    return m
      ? {
          r: parseInt(m[1], 16),
          g: parseInt(m[2], 16),
          b: parseInt(m[3], 16),
        }
      : null;
  }

  private applyAlpha(newHex: string, oldColor: string | undefined): string {
    if (!oldColor) return newHex;

    // 1. Check if oldColor is 8-digit hex (#RRGGBBAA)
    if (/^#[0-9a-f]{8}$/i.test(oldColor)) {
      const alpha = oldColor.slice(7, 9);
      return newHex + alpha;
    }

    // 2. Check if oldColor is 4-digit hex (#RGBA)
    if (/^#[0-9a-f]{4}$/i.test(oldColor)) {
      const alpha = oldColor.slice(4, 5);
      return newHex + alpha + alpha;
    }

    // 3. Check if oldColor is rgba(...) format with commas
    const rgbaCommaMatch = /^\s*rgba\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9.]+)\s*\)\s*$/i.exec(oldColor);
    if (rgbaCommaMatch) {
      const alphaStr = rgbaCommaMatch[1];
      const rgb = this.hexToRgb(newHex);
      if (rgb) {
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alphaStr})`;
      }
    }

    // 4. Check if oldColor is modern space-separated rgba(...)
    const rgbaSpaceMatch = /^\s*rgba\s*\(\s*\d+\s+\d+\s+\d+\s*\/\s*([0-9.]+)\s*\)\s*$/i.exec(oldColor);
    if (rgbaSpaceMatch) {
      const alphaStr = rgbaSpaceMatch[1];
      const rgb = this.hexToRgb(newHex);
      if (rgb) {
        return `rgba(${rgb.r} ${rgb.g} ${rgb.b} / ${alphaStr})`;
      }
    }

    return newHex;
  }

  private colorField(field: keyof GeoClockCardConfig) {
    return (e: Event) => {
      const v = (e.target as HTMLInputElement).value;
      const oldColor = this._config?.[field] as string | undefined;
      const nextColor = this.applyAlpha(v, oldColor);
      this.fire(field, nextColor);
    };
  }

  private patchMarkerColor(index: number, oldColor: string | undefined) {
    return (e: Event) => {
      const v = (e.target as HTMLInputElement).value;
      this.patchMarker(index, { color: this.applyAlpha(v, oldColor) });
    };
  }

  private toggle(field: keyof GeoClockCardConfig) {
    return (e: Event) => {
      this.fire(field, (e.target as HTMLInputElement).checked);
    };
  }

  private static readonly CENTER_MODES = [
    'sun',
    'home',
    'longitude',
    'entity',
  ] as const;

  private static readonly MAIN_TIME_SOURCES: MainTimeSource[] = [
    'home',
    'device',
    'entity',
  ];

  /** Replace the markers array on the config and emit a change. We
   *  build a fresh array each time so HA sees a new reference and
   *  re-saves. Empty arrays clear the field entirely (matches the
   *  fire() helper's "drop empty values" convention). */
  private updateMarkers(next: MarkerConfig[]): void {
    if (next.length === 0) {
      this.fire('markers', undefined);
    } else {
      this.fire('markers', next);
    }
  }

  private addMarker(): void {
    const list = [...(this._config?.markers ?? [])];
    list.push({ entity: '' });
    this.updateMarkers(list);
  }

  private removeMarker(index: number): void {
    const list = [...(this._config?.markers ?? [])];
    list.splice(index, 1);
    this.updateMarkers(list);
  }

  /** Render a domain-filtered entity selector. We use HA's
   *  high-level `ha-selector` instead of the lower-level
   *  `ha-entity-picker` because the selector wraps the picker plus
   *  validation hooks and is what HA's own card editors use; it also
   *  upgrades correctly once `loadCardHelpers()` has finished, which
   *  the bare `ha-entity-picker` did not in some HA frontend builds.
   *  Filter is by domain only — attribute filtering (lat+lon) is
   *  enforced at marker resolution time, so a stray entity without
   *  coordinates simply renders nothing. */
  private renderEntitySelector(args: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) {
    return html`
      <ha-selector
        .hass=${this.hass}
        .selector=${{
          entity: {
            filter: [
              { domain: 'zone' },
              { domain: 'person' },
              { domain: 'device_tracker' },
            ],
          },
        }}
        .value=${args.value}
        .label=${args.label}
        @value-changed=${(e: CustomEvent) =>
          args.onChange((e.detail?.value as string) ?? '')}
      ></ha-selector>
    `;
  }

  private patchMarker(index: number, patch: Partial<MarkerConfig>): void {
    const list = [...(this._config?.markers ?? [])];
    if (!list[index]) return;
    const merged = { ...list[index], ...patch };
    // Drop empty optional fields so the saved YAML stays clean. Cast
    // via unknown because TypeScript won't let us delete a known
    // property from a typed object directly.
    const cleaned = merged as unknown as Record<string, unknown>;
    if (patch.label !== undefined && (patch.label ?? '') === '') {
      delete cleaned.label;
    }
    if (patch.color !== undefined && (patch.color ?? '') === '') {
      delete cleaned.color;
    }
    list[index] = cleaned as unknown as MarkerConfig;
    this.updateMarkers(list);
  }

  override render(): TemplateResult {
    if (!this._config) return html``;
    // Wait for HA's helper bundle so ha-selector is registered before
    // we mount any. Without this gate the entity picker's tag lands
    // in the DOM as an inert HTMLElement and never upgrades.
    if (!this._helpers) return html``;
    const c = this._config;
    const center = c.center ?? 'sun';

    return html`
      <div class="section">
        <div class="section-title">Map centering</div>
        <div class="native-select">
          <label for="geo-center-mode">Center on</label>
          <select
            id="geo-center-mode"
            .value=${center}
            @change=${(e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              if (GeoClockCardEditor.CENTER_MODES.includes(v as 'sun')) {
                this.fire('center', v);
              }
            }}
          >
            <option value="sun" ?selected=${center === 'sun'}>
              Sun (subsolar point — drifts with daylight)
            </option>
            <option value="home" ?selected=${center === 'home'}>
              Home (Home Assistant location)
            </option>
            <option value="longitude" ?selected=${center === 'longitude'}>
              Specific longitude
            </option>
            <option value="entity" ?selected=${center === 'entity'}>
              Follow an entity
            </option>
          </select>
        </div>

        ${center === 'longitude'
          ? html`
              <ha-textfield
                label="Longitude (-180 to 180)"
                type="number"
                min="-180"
                max="180"
                step="0.1"
                .value=${c.centerLongitude == null
                  ? ''
                  : String(c.centerLongitude)}
                @change=${this.numField('centerLongitude')}
              ></ha-textfield>
            `
          : ''}
        ${center === 'entity'
          ? html`
              ${this.renderEntitySelector({
                label: 'Entity to follow',
                value: c.centerEntity ?? '',
                onChange: (v) => this.fire('centerEntity', v),
              })}
              <div class="help">
                Filtered to zone / person / device_tracker entities.
                Entities without numeric <code>longitude</code> /
                <code>latitude</code> attributes fall back to
                Greenwich (0°) at runtime — deliberately distinct
                from sun centering so a broken entity is visible.
              </div>
            `
          : ''}

        <ha-formfield label="Show home marker on map">
          <ha-switch
            ?checked=${c.showHomeMarker ?? false}
            @change=${this.toggle('showHomeMarker')}
          ></ha-switch>
        </ha-formfield>
        ${c.showHomeMarker
          ? html`
              <ha-formfield label="Show home name and current time under the marker">
                <ha-switch
                  ?checked=${c.showHomeMarkerLabel ?? false}
                  @change=${this.toggle('showHomeMarkerLabel')}
                ></ha-switch>
              </ha-formfield>
            `
          : ''}
      </div>

      <div class="section">
        <div class="section-title">Main clock</div>
        <div class="native-select">
          <label for="geo-main-time-source">Time source</label>
          <select
            id="geo-main-time-source"
            .value=${c.mainTimeSource ?? 'home'}
            @change=${(e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              if (
                GeoClockCardEditor.MAIN_TIME_SOURCES.includes(v as MainTimeSource)
              ) {
                this.fire('mainTimeSource', v);
              }
            }}
          >
            <option
              value="home"
              ?selected=${(c.mainTimeSource ?? 'home') === 'home'}
            >
              Home (Home Assistant time zone) — default
            </option>
            <option value="device" ?selected=${c.mainTimeSource === 'device'}>
              Device (this browser's time zone)
            </option>
            <option value="entity" ?selected=${c.mainTimeSource === 'entity'}>
              Follow an entity
            </option>
          </select>
        </div>
        <div class="breaking-note">
          Default changed in v0.2.0 — pre-0.2.0 cards behaved like “Device”.
          Switch back if the wall-clock readout should keep matching the
          viewing device rather than your HA location.
        </div>
        ${c.mainTimeSource === 'entity'
          ? this.renderEntitySelector({
              label: 'Time-source entity',
              value: c.mainTimeEntity ?? '',
              onChange: (v) => this.fire('mainTimeEntity', v),
            })
          : ''}
      </div>

      <div class="section">
        <div class="section-title">Display</div>
        <ha-formfield label="Show UTC time">
          <ha-switch
            ?checked=${c.showUTC ?? true}
            @change=${this.toggle('showUTC')}
          ></ha-switch>
        </ha-formfield>
        <ha-formfield label="Show hour-of-day band">
          <ha-switch
            ?checked=${c.showTimezoneBand ?? true}
            @change=${this.toggle('showTimezoneBand')}
          ></ha-switch>
        </ha-formfield>
        <ha-formfield label="Show time-zone overlay">
          <ha-switch
            ?checked=${c.showTimezoneBoundaries ?? true}
            @change=${this.toggle('showTimezoneBoundaries')}
          ></ha-switch>
        </ha-formfield>
        <ha-formfield label="Show hover popup (live time at the pointed-to zone)">
          <ha-switch
            ?checked=${c.showTimezonePopup ?? true}
            @change=${this.toggle('showTimezonePopup')}
          ></ha-switch>
        </ha-formfield>
      </div>

      <div class="section">
        <div class="section-title">Update rate</div>
        <ha-textfield
          label="Clock tick (seconds, 1–600)"
          type="number"
          min="1"
          max="600"
          step="1"
          .value=${String(c.updateInterval ?? 1)}
          @change=${this.numField('updateInterval')}
        ></ha-textfield>
        <div class="help">
          The map itself auto-throttles separately — it only re-renders
          when the subsolar point has shifted enough to be visible at 4K.
        </div>
      </div>

      <ha-expansion-panel
        outlined
        header="Location markers"
        secondary="Pin extra entities on the map with their current local time"
      >
        <div class="section panel-body">
          <div class="native-select">
            <label for="geo-marker-label-mode">Label visibility</label>
            <select
              id="geo-marker-label-mode"
              .value=${c.markerLabelMode ?? 'always'}
              @change=${(e: Event) => {
                const v = (e.target as HTMLSelectElement).value;
                this.fire(
                  'markerLabelMode',
                  v === 'hover' ? 'hover' : 'always',
                );
              }}
            >
              <option
                value="always"
                ?selected=${(c.markerLabelMode ?? 'always') === 'always'}
              >
                Always visible — name + time under each marker
              </option>
              <option value="hover" ?selected=${c.markerLabelMode === 'hover'}>
                Hover / tap only — popup like the time-zone overlay
              </option>
            </select>
          </div>
          <ha-formfield label="Show weekday after the time (e.g. 12:22 PM Friday)">
            <ha-switch
              ?checked=${c.markerShowDay ?? true}
              @change=${this.toggle('markerShowDay')}
            ></ha-switch>
          </ha-formfield>
          <div class="color-row">
            <label for="marker-color">Default marker color</label>
            <input
              id="marker-color"
              type="color"
              .value=${this.colorAsHex(c.markerColor, '#3da9fc')}
              @change=${this.colorField('markerColor')}
            />
          </div>

          ${(c.markers ?? []).map(
            (m, i) => html`
              <div class="marker-row">
                <div class="row-head">
                  <span class="row-title">Marker ${i + 1}</span>
                  <button
                    class="remove"
                    type="button"
                    @click=${() => this.removeMarker(i)}
                  >
                    Remove
                  </button>
                </div>
                ${this.renderEntitySelector({
                  label: 'Entity',
                  value: m.entity ?? '',
                  onChange: (v) => this.patchMarker(i, { entity: v }),
                })}
                <ha-textfield
                  label="Label (optional — defaults to entity friendly_name)"
                  .value=${m.label ?? ''}
                  @change=${(e: Event) =>
                    this.patchMarker(i, {
                      label: (e.target as HTMLInputElement).value,
                    })}
                ></ha-textfield>
                <div class="color-row">
                  <label for="marker-color-${i}">Marker color (optional)</label>
                  <input
                    id="marker-color-${i}"
                    type="color"
                    .value=${this.colorAsHex(
                      m.color,
                      this.colorAsHex(c.markerColor, '#3da9fc'),
                    )}
                    @change=${this.patchMarkerColor(i, m.color)}
                  />
                </div>
              </div>
            `,
          )}
          <button
            class="add-marker"
            type="button"
            @click=${() => this.addMarker()}
          >
            + Add marker
          </button>
        </div>
      </ha-expansion-panel>

      <ha-expansion-panel
        outlined
        header="Advanced visual settings"
        secondary="Day brightness, night contrast, twilight glow, line color"
      >
        <div class="section panel-body">
          <ha-textfield
            label="Day brightness (0–5)"
            type="number"
            min="0"
            max="5"
            step="0.05"
            .value=${String(c.dayBrightness ?? 1.15)}
            @change=${this.numField('dayBrightness')}
          ></ha-textfield>
          <ha-textfield
            label="Night contrast (0–5)"
            type="number"
            min="0"
            max="5"
            step="0.05"
            .value=${String(c.nightContrast ?? 1)}
            @change=${this.numField('nightContrast')}
          ></ha-textfield>
          <ha-textfield
            label="Twilight band (1–18 sun-elevation degrees)"
            type="number"
            min="1"
            max="18"
            step="1"
            .value=${String(c.twilightDegrees ?? 8)}
            @change=${this.numField('twilightDegrees')}
          ></ha-textfield>
          <div class="color-row">
            <label for="twilight-color">Twilight color</label>
            <input
              id="twilight-color"
              type="color"
              .value=${this.colorAsHex(c.twilightColor, '#463701')}
              @change=${this.colorField('twilightColor')}
            />
          </div>
          <ha-textfield
            label="Twilight opacity (0–1)"
            type="number"
            min="0"
            max="1"
            step="0.02"
            .value=${String(c.twilightOpacity ?? 0.26)}
            @change=${this.numField('twilightOpacity')}
          ></ha-textfield>
          <div class="color-row">
            <label for="tz-line-color">Time-zone line color</label>
            <input
              id="tz-line-color"
              type="color"
              .value=${this.tzLineColorAsHex(c.timezoneLineColor)}
              @change=${this.colorField('timezoneLineColor')}
            />
          </div>
          <div class="help">
            For finer alpha control of the line color, set <code>timezoneLineColor</code>
            directly in YAML using an <code>rgba(…)</code> value.
          </div>
        </div>
      </ha-expansion-panel>
    `;
  }

  /** Color picker emits a 6-digit hex; the default config value is
   *  an rgba() with alpha. If the user hasn't customised the line
   *  color we still want the picker to start somewhere sensible. */
  private tzLineColorAsHex(value: string | undefined): string {
    return this.colorAsHex(value, '#ffffff');
  }

  /** Coerce arbitrary CSS color strings to a 6-digit hex form for the
   *  native `<input type="color">`, falling back to `defaultHex` if
   *  the value is unset or in a form the picker can't display
   *  (rgba(), hsla(), named colors). */
  private colorAsHex(value: string | undefined, defaultHex: string): string {
    if (!value) return defaultHex;
    if (/^#[0-9a-f]{6,8}$/i.test(value)) return value.slice(0, 7);
    return defaultHex;
  }

}
