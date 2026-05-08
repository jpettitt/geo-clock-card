// Visual card editor for geo-clock-card. Surfaces every config option
// the user is likely to tweak through Home Assistant's Lovelace UI.
//
// We use HA's frontend components (`ha-textfield`, `ha-select`,
// `ha-switch`, `ha-formfield`, `ha-entity-picker`) which are
// already loaded in the dashboard runtime — no extra imports needed.
// Outside HA (the dev preview) those tags don't exist; the editor is
// only ever instantiated by HA via `getConfigElement()`, so this is
// fine.

import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { GeoClockCardConfig } from './types.js';

interface HassLike {
  states?: Record<string, unknown>;
  config?: { latitude?: number; longitude?: number };
}

@customElement('geo-clock-card-editor')
export class GeoClockCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HassLike;
  @state() private _config?: GeoClockCardConfig;

  setConfig(config: GeoClockCardConfig): void {
    this._config = config;
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
    ha-select,
    ha-entity-picker {
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
  `;

  /** Emit a config-changed event with `field` set (or removed when
   *  value is undefined / empty string). Bubbles + composed so HA's
   *  editor host catches it. */
  private fire(field: keyof GeoClockCardConfig, value: unknown): void {
    if (!this._config) return;
    const next: Record<string, unknown> = { ...this._config };
    if (value === undefined || value === '' || value === null) {
      delete next[field as string];
    } else {
      next[field as string] = value;
    }
    if (
      JSON.stringify(next) === JSON.stringify(this._config)
    ) return;
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
      this.fire(field, v === '' ? undefined : Number(v));
    };
  }

  private strField(field: keyof GeoClockCardConfig) {
    return (e: Event) => {
      const v = (e.target as HTMLInputElement).value;
      this.fire(field, v);
    };
  }

  private toggle(field: keyof GeoClockCardConfig) {
    return (e: Event) => {
      this.fire(field, (e.target as HTMLInputElement).checked);
    };
  }

  private select(field: keyof GeoClockCardConfig) {
    return (e: Event) => {
      // ha-select fires a `selected` or `change` with target.value
      const v = (e.target as HTMLSelectElement).value;
      this.fire(field, v);
    };
  }

  override render(): TemplateResult {
    if (!this._config) return html``;
    const c = this._config;
    const center = c.center ?? 'sun';

    return html`
      <div class="section">
        <div class="section-title">Map centering</div>
        <ha-select
          label="Center on"
          .value=${center}
          @selected=${this.select('center')}
          @closed=${(e: Event) => e.stopPropagation()}
        >
          <mwc-list-item value="sun">Sun (subsolar point — drifts with daylight)</mwc-list-item>
          <mwc-list-item value="home">Home (Home Assistant location)</mwc-list-item>
          <mwc-list-item value="longitude">Specific longitude</mwc-list-item>
          <mwc-list-item value="entity">Follow an entity</mwc-list-item>
        </ha-select>

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
                @input=${this.numField('centerLongitude')}
              ></ha-textfield>
            `
          : ''}
        ${center === 'entity'
          ? html`
              <ha-entity-picker
                .hass=${this.hass}
                label="Entity to follow"
                .value=${c.centerEntity ?? ''}
                .includeDomains=${['zone', 'person', 'device_tracker']}
                @value-changed=${(e: CustomEvent) =>
                  this.fire('centerEntity', e.detail.value)}
              ></ha-entity-picker>
              <div class="help">
                Entity must expose a <code>longitude</code> attribute (zones,
                persons, and most device trackers do).
              </div>
            `
          : ''}

        <ha-formfield label="Show home marker on map">
          <ha-switch
            ?checked=${c.showHomeMarker ?? false}
            @change=${this.toggle('showHomeMarker')}
          ></ha-switch>
        </ha-formfield>
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
          @input=${this.numField('updateInterval')}
        ></ha-textfield>
        <div class="help">
          The map itself auto-throttles separately — it only re-renders
          when the subsolar point has shifted enough to be visible at 4K.
        </div>
      </div>

      <ha-expansion-panel
        outlined
        header="Advanced visual settings"
        secondary="Day brightness, night contrast, twilight glow, line color"
      >
        <div class="section panel-body">
          <ha-textfield
            label="Day brightness (0.5–2.0)"
            type="number"
            min="0.5"
            max="2"
            step="0.05"
            .value=${String(c.dayBrightness ?? 1.15)}
            @input=${this.numField('dayBrightness')}
          ></ha-textfield>
          <ha-textfield
            label="Night contrast (0.5–3.0)"
            type="number"
            min="0.5"
            max="3"
            step="0.05"
            .value=${String(c.nightContrast ?? 1)}
            @input=${this.numField('nightContrast')}
          ></ha-textfield>
          <ha-textfield
            label="Twilight band (1–18 sun-elevation degrees)"
            type="number"
            min="1"
            max="18"
            step="1"
            .value=${String(c.twilightDegrees ?? 8)}
            @input=${this.numField('twilightDegrees')}
          ></ha-textfield>
          <div class="color-row">
            <label for="twilight-color">Twilight color</label>
            <input
              id="twilight-color"
              type="color"
              .value=${c.twilightColor ?? '#463701'}
              @input=${this.strField('twilightColor')}
            />
          </div>
          <ha-textfield
            label="Twilight opacity (0–1)"
            type="number"
            min="0"
            max="1"
            step="0.02"
            .value=${String(c.twilightOpacity ?? 0.26)}
            @input=${this.numField('twilightOpacity')}
          ></ha-textfield>
          <div class="color-row">
            <label for="tz-line-color">Time-zone line color</label>
            <input
              id="tz-line-color"
              type="color"
              .value=${this.tzLineColorAsHex(c.timezoneLineColor)}
              @input=${this.strField('timezoneLineColor')}
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
    if (!value) return '#ffffff';
    if (/^#[0-9a-f]{6,8}$/i.test(value)) return value.slice(0, 7);
    return '#ffffff';
  }
}
