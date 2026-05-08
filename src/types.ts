// Card config schema.

export type CenterMode = 'sun' | 'home' | 'longitude' | 'entity';

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
}

export interface ResolvedConfig {
  twilightDegrees: number;
  updateInterval: number;
  showUTC: boolean;
  showTimezoneBand: boolean;
  showTimezoneBoundaries: boolean;
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
