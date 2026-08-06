/**
 * Pure config-sanitization helpers shared by geo-clock-card.ts.
 * Kept free of Lit/DOM imports so they can be unit-tested under
 * vitest's node environment (the card module itself registers a
 * custom element at import time, which node can't do).
 */

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Coerce a config value to a finite number, else the default. YAML
 * happily delivers strings (`updateInterval: fast`) and NaN passes
 * straight through clamp() — `setInterval(fn, NaN)` then means "as
 * fast as the browser allows", pegging a wall-tablet CPU, and NaN
 * twilight/brightness values produce invalid SVG/CSS.
 */
export function num(v: unknown, def: number): number {
  // null/undefined mean "unset" (an empty YAML key arrives as null,
  // and Number(null) is 0 — not what an empty field should mean).
  if (v == null) return def;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : def;
}

/**
 * Return the locale if Intl accepts it, else undefined (browser
 * default). `locale` is often hand-typed YAML; a POSIX-style typo
 * (`en_US`) would otherwise throw RangeError inside render() and
 * brick the whole card, not just the readout.
 */
export function validateLocale(locale: string | undefined): string | undefined {
  if (!locale) return undefined;
  try {
    new Intl.DateTimeFormat(locale);
    return locale;
  } catch {
    console.warn(
      `geo-clock-card: invalid locale "${locale}" — using the browser default`,
    );
    return undefined;
  }
}

export function parseFrozenNow(
  input: string | number | Date | undefined,
): Date | undefined {
  if (input == null) return undefined;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

/**
 * Restrict imageryBase to http(s), relative paths, or the page's own
 * scheme. Config can arrive from an attacker-controlled `?cfg=` URL
 * parameter on the public demo pages; a crafted base would make the
 * visitor's browser issue GET requests (imagery + the two timezone
 * JSON fetches) to an arbitrary origin. The fetched data is always
 * rendered through escaped bindings so this was never script
 * injection — but there's no reason to allow `javascript:`-shaped
 * or cross-protocol bases at all. Returns undefined (→ caller falls
 * back to the bundle-relative default) for anything unrecognized.
 *
 * Returns the RESOLVED absolute URL, not the raw input: the check
 * resolves against `baseUrl` (the bundle location), so returning the
 * raw string would let a relative input be validated against one
 * base and later fetched against another (the page).
 */
export function sanitizeImageryBase(
  input: string | undefined,
  baseUrl: string,
): string | undefined {
  if (typeof input !== 'string' || input.length === 0) return undefined;
  try {
    const resolved = new URL(input, baseUrl);
    const pageProto =
      typeof location !== 'undefined' ? location.protocol : 'https:';
    const ok =
      resolved.protocol === 'https:' ||
      resolved.protocol === 'http:' ||
      resolved.protocol === pageProto;
    return ok ? resolved.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Restrict color config to a small, well-known set of CSS color
 * forms. We splice this value into a `style` attribute, and Lit's
 * attribute-escaping already prevents breaking out of the attribute
 * — but a value like `red; background: url(http://attacker.tld/x)`
 * would still inject a rule that pings the URL. Locking the input
 * to hex / rgb[a] / hsl[a] / named-color forms closes that vector.
 * Returns undefined for anything unrecognized so the caller can
 * fall back to its default.
 */
export function sanitizeCssColor(input: string | undefined): string | undefined {
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
