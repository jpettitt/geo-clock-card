// Card config schema.
//
// Public types and the minimal HA shape we lean on. We don't import
// `custom-card-helpers` so the runtime bundle stays dependency-free —
// instead, `HassLike` declares the strict subset of `HomeAssistant`
// the card and editor actually read at runtime. If you need
// fields that are not here, extend this interface; do not cast away
// the type.

export type CenterMode = 'sun' | 'home' | 'longitude' | 'entity';

/**
 * Minimal subset of Home Assistant's `hass` object used by both the
 * card and the editor. The real type is much wider — see
 * `home-assistant-js-websocket` / `custom-card-helpers` — but every
 * field below has an actual reader in this package, and adding
 * unused fields here would be lying about our coupling.
 */
export interface HassLike {
  config?: {
    /** Numeric latitude of the home zone. */
    latitude?: number;
    /** Numeric longitude of the home zone. */
    longitude?: number;
    /** IANA tzid of the home zone, e.g. `America/Los_Angeles`.
     *  Used by the home main-clock and home marker time. */
    time_zone?: string;
    /** User-set name of the installation, falls back to `Home`. */
    location_name?: string;
  };
  /** Live entity state map, keyed by entity_id. We only read
   *  `attributes.{latitude,longitude,friendly_name}` for marker
   *  resolution — the editor passes `hass` opaquely to
   *  `<ha-selector>`, which uses everything itself. */
  states?: Record<string, { attributes?: Record<string, unknown> }>;
}

/** Where the main clock readout draws its time from.
 *  - 'home' (default since 0.2.0): the IANA zone at the HA-configured
 *    location. Reads `hass.config.time_zone` directly when present,
 *    otherwise falls back to a polygon hit-test on the home lat/lon.
 *  - 'device': the browser's local timezone (pre-0.2.0 behavior).
 *  - 'entity': the IANA zone of the entity named in `mainTimeEntity`. */
export type MainTimeSource = 'home' | 'device' | 'entity';

/** Visibility mode for the marker label + time text.
 *  - 'always': render under each marker dot, all the time.
 *  - 'hover': only show in a popup on hover/tap. */
export type MarkerLabelMode = 'always' | 'hover';

/** A single map marker — the time at the entity's location is computed
 *  from its `latitude`/`longitude` attributes. */
export interface MarkerConfig {
  /** HA entity ID, e.g. `zone.work`, `person.alice`,
   *  `device_tracker.kid_phone`. Must expose numeric `latitude` and
   *  `longitude` attributes. */
  entity: string;
  /** Override the entity's friendly name on the marker. */
  label?: string;
  /** Optional dot color for this marker. Any CSS color string the
   *  card's `sanitizeCssColor` accepts (hex / rgb[a] / hsl[a] /
   *  named). Falls back to the card-level `markerColor`, then to
   *  the `--geo-marker-color` CSS variable. Used only when neither
   *  day/night color resolves (see `dayColor`). */
  color?: string;
  /** Optional dot color used while the marker's location is in
   *  daylight (sun above the horizon). When this OR `nightColor`
   *  resolves (per-marker here, or the card-level
   *  `markerDayColor` / `markerNightColor`), the marker switches to
   *  day/night mode and its dot recolors live as the terminator
   *  passes — matching the desktop wallpaper app. When neither
   *  resolves, the marker stays the single `color` above. */
  dayColor?: string;
  /** Optional dot color used while the marker's location is in
   *  night (sun below the horizon). See `dayColor`. */
  nightColor?: string;
}

export interface GeoClockCardConfig {
  type: string;
  /** Where to center the map. Default 'sun'.
   *  - 'sun': centered on the current subsolar longitude — the daylit
   *    hemisphere stays in the middle and the map slowly drifts.
   *  - 'home': centered on the HA-configured longitude
   *    (`hass.config.longitude`).
   *  - 'longitude': centered on the explicit `centerLongitude` value.
   *  - 'entity': centered on the longitude attribute of an HA entity
   *    (zone, person, device_tracker) named in `centerEntity`. */
  center?: CenterMode;
  /** Used when `center: 'longitude'`. Numeric longitude in [-180, 180]. */
  centerLongitude?: number;
  /** Used when `center: 'entity'`. Entity ID with a `longitude`
   *  attribute (and ideally `latitude` too — used by the home marker). */
  centerEntity?: string;
  /** Render a small marker at the user's home location (always taken
   *  from `hass.config.latitude/longitude`). Default false. */
  showHomeMarker?: boolean;
  /** When the home marker is shown, also render the home name + the
   *  current local time at the HA-configured zone underneath it.
   *  Default false. Ignored when `showHomeMarker` is false. */
  showHomeMarkerLabel?: boolean;
  /** Freeze the clock at a specific moment (ISO 8601 string, ms epoch
   *  number, or Date). When set, the card stops ticking and displays
   *  this exact time — useful for previewing equinoxes / solstices /
   *  arbitrary dates without waiting for them to come around. */
  now?: string | number | Date;
  /** Sun-elevation half-band over which day fades to night, in degrees.
   *  Default 8 (covers civil twilight + a touch of nautical). */
  twilightDegrees?: number;
  /** Clock-readout cadence in seconds. Default 1. The map repaints
   *  on a separate auto-throttled timer based on subsolar drift. */
  updateInterval?: number;
  /** Show UTC time below local time. Default true. */
  showUTC?: boolean;
  /** Show the hour-of-day band across the top. Default true. */
  showTimezoneBand?: boolean;
  /** Show the time-zone overlay (offset bands + IANA polygons).
   *  Default true. */
  showTimezoneBoundaries?: boolean;
  /** Show the colored vertical UTC-offset bands. Defaults to
   *  `showTimezoneBoundaries` so existing configs are unchanged, but
   *  can be set independently — the geoclock.world demo groups these
   *  visual bands with the hour band and reserves
   *  `showTimezoneBoundaries` for the interactive hover popup. */
  showTimezoneRegions?: boolean;
  /** Show the hover popup with live time at the pointed-to zone.
   *  Default true. (Independent of `showTimezoneBoundaries` — you
   *  can have visible bands without popups, or vice versa.) */
  showTimezonePopup?: boolean;
  /** Stroke color of the time-zone overlay lines. Any CSS color
   *  string. Default 'rgba(255, 255, 255, 0.18)'. */
  timezoneLineColor?: string;
  /** CSS `brightness()` value applied to the day (Blue Marble) layer.
   *  1 = unchanged, >1 = brighter, <1 = darker. Default 1.15. */
  dayBrightness?: number;
  /** CSS `contrast()` value applied to the night (Black Marble) layer.
   *  1 = unchanged, >1 = punchier city lights, <1 = washed out.
   *  Default 1.0. */
  nightContrast?: number;
  /** Color of the warm twilight glow stroked along the terminator.
   *  Any CSS color string (hex, rgb(), color name). Default '#463701'. */
  twilightColor?: string;
  /** Opacity of the twilight glow polyline. 0 hides it entirely;
   *  1 is the full screen-blended overlay. Default 0.26. */
  twilightOpacity?: number;
  /** Override imagery base URL — useful if hosting maps on a CDN.
   *  Defaults to the bundle's own location. (Not exposed in the
   *  visual editor.) */
  imageryBase?: string;
  /** List of additional location markers. Each entity must expose
   *  numeric `latitude` + `longitude` attributes. Default: empty. */
  markers?: MarkerConfig[];
  /** How marker labels + times are shown. Default 'always'. */
  markerLabelMode?: MarkerLabelMode;
  /** Default fill color for markers that don't override `color`.
   *  Any CSS color string. Default '#3da9fc'. Used only when
   *  day/night colors are not in play. */
  markerColor?: string;
  /** Card-level default day-side marker color. Setting this (or
   *  `markerNightColor`) opts ALL markers into day/night mode:
   *  each dot recolors live as the sun crosses its location.
   *  Per-marker `dayColor` overrides it. Unset by default, so
   *  existing single-color cards are unchanged. */
  markerDayColor?: string;
  /** Card-level default night-side marker color. See
   *  `markerDayColor`. */
  markerNightColor?: string;
  /** Append the weekday (locale-aware) after each marker's time
   *  display — e.g. `12:22 PM Friday`. Helpful when markers in
   *  far-away zones have rolled over to a different calendar day.
   *  Default true. */
  markerShowDay?: boolean;
  /** Source for the main clock readout. Default 'home' (BREAKING from
   *  pre-0.2.0, where the readout was always device local). */
  mainTimeSource?: MainTimeSource;
  /** Used when `mainTimeSource: 'entity'`. Entity ID with
   *  `latitude`/`longitude` attributes. */
  mainTimeEntity?: string;
}

export interface ResolvedConfig {
  twilightDegrees: number;
  updateInterval: number;
  showUTC: boolean;
  showTimezoneBand: boolean;
  showTimezoneBoundaries: boolean;
  showTimezoneRegions: boolean;
  showTimezonePopup: boolean;
  timezoneLineColor: string;
  dayBrightness: number;
  nightContrast: number;
  twilightColor: string;
  twilightOpacity: number;
  imageryBase: string;
  center: CenterMode;
  centerLongitude?: number;
  centerEntity?: string;
  showHomeMarker: boolean;
  showHomeMarkerLabel: boolean;
  markers: MarkerConfig[];
  markerLabelMode: MarkerLabelMode;
  /** Card-level default marker color. `undefined` means "let the
   *  `--geo-marker-color` CSS variable decide" so HA themes can
   *  restyle without touching card config. */
  markerColor: string | undefined;
  /** Card-level resolved day/night marker colors. `undefined` for
   *  either means day/night mode isn't enabled at the card level
   *  (a per-marker dayColor/nightColor can still enable it for
   *  that marker). */
  markerDayColor: string | undefined;
  markerNightColor: string | undefined;
  markerShowDay: boolean;
  mainTimeSource: MainTimeSource;
  mainTimeEntity?: string;
  /** When set, the clock is frozen at this Date and the timer is disabled. */
  frozenNow?: Date;
}

declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description?: string;
      preview?: boolean;
      documentationURL?: string;
    }>;
  }
}
