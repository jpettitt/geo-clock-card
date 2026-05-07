// Card config schema.

export type CenterMode = 'antimeridian' | 'home' | 'sun';

export interface GeoClockCardConfig {
  type: string;
  /** Where to center the map.
   *  - 'antimeridian' (default): dateline at center, Greenwich at edges
   *  - 'home': centered on the user's home longitude (HA `hass.config.longitude`,
   *    or `homeLongitude` if set explicitly)
   *  - 'sun': centered on the current subsolar longitude — the daylit
   *    hemisphere is always in the middle */
  center?: CenterMode;
  /** Override longitude used in 'home' mode. Falls back to
   *  hass.config.longitude, then to a California default. */
  homeLongitude?: number;
  /** Freeze the clock at a specific moment (ISO 8601 string, ms epoch
   *  number, or Date). When set, the card stops ticking and displays
   *  this exact time — useful for previewing equinoxes / solstices /
   *  arbitrary dates without waiting for them to come around. */
  now?: string | number | Date;
  /** Sun-elevation half-band over which day fades to night, in degrees.
   *  Default 9 (covers civil twilight + a touch of nautical). */
  twilightDegrees?: number;
  /** Repaint cadence in seconds. Default 60. */
  updateInterval?: number;
  /** Show UTC time below local time. Default true. */
  showUTC?: boolean;
  /** Show the time-zone hour band across the top. Default true. */
  showTimezoneBand?: boolean;
  /** Show political time-zone boundary lines on the map. Default true. */
  showTimezoneBoundaries?: boolean;
  /** CSS `brightness()` value applied to the day (Blue Marble) layer.
   *  1 = unchanged, >1 = brighter, <1 = darker. Default 1.15. */
  dayBrightness?: number;
  /** CSS `contrast()` value applied to the night (Black Marble) layer.
   *  1 = unchanged, >1 = punchier city lights, <1 = washed out.
   *  Default 1. */
  nightContrast?: number;
  /** Color of the warm twilight glow stroked along the terminator.
   *  Any CSS color string (hex, rgb(), color name). Default '#ff7a3d'. */
  twilightColor?: string;
  /** Opacity of the twilight glow polyline. 0 hides it entirely;
   *  1 is the full screen-blended overlay. Default 0.3. */
  twilightOpacity?: number;
  /** Override imagery base URL — useful if hosting maps on a CDN.
   *  Defaults to the bundle's own location. */
  imageryBase?: string;
}

export interface ResolvedConfig {
  twilightDegrees: number;
  updateInterval: number;
  showUTC: boolean;
  showTimezoneBand: boolean;
  showTimezoneBoundaries: boolean;
  dayBrightness: number;
  nightContrast: number;
  twilightColor: string;
  twilightOpacity: number;
  imageryBase: string;
  center: CenterMode;
  homeLongitude?: number;
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
    }>;
  }
}
