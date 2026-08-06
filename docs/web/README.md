# `docs/web/` — geoclock.world site

Source for the live demo at <https://geoclock.world>. Single origin
behind Cloudflare: HTML and every card asset (JS bundle, NASA imagery,
IANA GeoJSON) are served from `geoclock.world`, all backed by one
Cloudflare R2 bucket bound to the custom domain.

## Files

- [`index.html`](index.html) — the single-page site. One constant
  (`ASSET_BASE`) controls which release of the card the demo loads;
  bumped in lockstep with `package.json#version` (CI enforces this).
- [`wallpaper.html`](wallpaper.html) — chrome-less, full-bleed
  render of the card meant to be screenshotted and set as a
  desktop wallpaper. Accepts the full card config via
  `?cfg=<base64-or-JSON>` (URL form), or via
  `window.geoclockConfigure({ config, hass })` (JS API form — used
  by the macOS wallpaper app). See the in-file header comment for
  the supported shortcuts (inline-coordinate markers,
  `mainTimeZone`, `centerLatitude` / `centerLongitude`). Carries its
  own `ASSET_BASE` pin, also CI-checked.
- [`privacy.html`](privacy.html) — privacy policy for the site and
  the Chrome new-tab extension (the Web Store listing links here).
- [`geoclock-config.js`](geoclock-config.js) — shared HEADLESS
  config plumbing (shortcut expansion, bundle loading, asset
  readiness). Imported by `index.html`, `wallpaper.html`, the Chrome
  extension, and bundled into the macOS wallpaper app.
- [`geoclock-webconfig.js`](geoclock-webconfig.js) — the slide-out
  Customize panel (URL codec, localStorage, Nominatim geocoding,
  panel DOM). Imported by `index.html` and the Chrome extension.
  **Moving or renaming either JS module breaks
  `chrome-extension/build.sh` and the macOS app's
  `sync-web-assets.sh` — update those consumers in the same
  commit.**
- [`preview.png`](preview.png) — screenshot used by the project's
  root README and as the page's OpenGraph image.
- [`favicon.svg`](favicon.svg) /
  [`apple-touch-icon.png`](apple-touch-icon.png) — site icons.

No `CNAME` or `.nojekyll` files: those are GitHub Pages conventions.
Cloudflare uses dashboard-configured custom domains and serves files
verbatim — neither file is consulted, so we don't ship them.

## Deployment topology

Single bucket, single domain. The R2 bucket `geoclock-world` is
custom-domain-bound to `geoclock.world` and serves both the site
(everything in `docs/web/`) and the versioned card assets
(`/v<X.Y.Z>/...`).

```text
                                  ┌──────────────────────────────┐
              geoclock.world  →   │  Cloudflare R2 (custom       │
                                  │  domain + edge cache)        │
                                  └──────────┬───────────────────┘
                                             │
                  ┌──────────────────────────┴────────────────────────┐
                  │                                                   │
        path: /   │                                       path: /v*/  │
                  ▼                                                   ▼
        ┌──────────────────┐                              ┌─────────────────┐
        │  index.html      │                              │  /v0.2.10/      │
        │  wallpaper.html  │                              │     geo-clock-  │
        │  privacy.html    │                              │     card.js     │
        │  geoclock-*.js   │                              │     blue-       │
        │                  │                              │     marble-*    │
        │  Synced by       │                              │     timezones-  │
        │  deploy-site.yml │                              │     iana.json   │
        │  on every push   │                              │     …           │
        │  to main         │                              │  Immutable —    │
        │  (no-cache)      │                              │  1-year cache   │
        └──────────────────┘                              └─────────────────┘
```

The card's `imageryBase` resolves from `import.meta.url` — i.e. the
directory containing the loaded JS bundle. Because the bundle and all
imagery sit under the same `/v<X.Y.Z>/` prefix, no manual
`imageryBase` override is needed: once the import succeeds, every
imagery / GeoJSON fetch already points at the right path.

## How deployment actually runs

Everything is automated in
[`.github/workflows/deploy-site.yml`](../../.github/workflows/deploy-site.yml),
which runs on every push to `main`:

1. `npm ci && npm test && npm run build` — `dist/` is rebuilt from
   source (the build is deterministic, so this matches the committed
   bundle for the same commit).
2. Guard: both HTML `ASSET_BASE` pins must reference
   `/v<package.json#version>` or the deploy fails.
3. Guard: if any file already exists under `/v<version>/` on the
   bucket with different content, the deploy fails — immutable paths
   are never rewritten; bump the version instead.
4. `dist/` syncs to `/v<version>/` with a 1-year immutable
   `Cache-Control` (assets first, so live HTML never pins a missing
   path).
5. `docs/web/` syncs to the bucket root with `Cache-Control:
   no-cache` (mutable files revalidate at the edge). `--delete`
   removes dropped files, with `--exclude 'v*/*'` protecting the
   versioned prefixes.

Required repo secrets:

| Secret | Source |
| --- | --- |
| `R2_ACCESS_KEY_ID` | Cloudflare → R2 → Manage R2 API Tokens |
| `R2_SECRET_ACCESS_KEY` | (same flow) |
| `R2_ACCOUNT_ID` | Cloudflare dashboard → right column → "Account ID" |

### Bucket + DNS one-time wiring

1. Create the R2 bucket `geoclock-world`.
2. Bind it to the custom domain `geoclock.world`
   (R2 → bucket → Settings → Custom Domains → Connect domain).
   Cloudflare provisions the DNS record + TLS cert.
3. The bucket serves `index.html` at `/` automatically (R2 supports
   index document configuration in Custom Domains settings).

## Bumping the live demo to a new release

One commit, three edits, then push:

1. Bump `version` in `package.json`.
2. Update the `ASSET_BASE` pin in [`index.html`](index.html) **and**
   [`wallpaper.html`](wallpaper.html) to the same `/vX.Y.Z`.
3. Push to `main` — CI verifies the pins, uploads the new `/vX.Y.Z/`
   assets, and syncs the site. Old prefixes stay forever, so older
   snapshots of the demo remain reachable by editing one URL.

Visitors with the previous bundle still cached load it only until the
HTML revalidates (no-cache); the new asset path is a fresh URL so the
browser fetches it cleanly without a cache bust.

## Local testing

```bash
# Serve docs/web/ at http://localhost:8080
python3 -m http.server -d docs/web 8080

# Separately, make /v<version>/ resolve to the freshly-built dist/ so
# the relative ASSET_BASE works locally too (match the version pinned
# in index.html). Simplest is a symlink:
ln -s ../../dist docs/web/v0.2.10
# (delete the symlink before committing so it doesn't end up in git)
```

Open <http://localhost:8080> and confirm the card mounts, imagery
loads, and time-zone hover works.

## When the logo arrives

Drop `logo.svg` into this folder, then in `index.html` replace the
header's `<div class="wordmark">` block with whatever combination
of logo + wordmark the design calls for. It deploys with the next
push to `main`.
