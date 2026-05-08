# `docs/web/` — geoclock.world site

Source for the live demo at <https://geoclock.world>. Single origin
behind Cloudflare: HTML and every card asset (JS bundle, NASA imagery,
IANA GeoJSON) are served from `geoclock.world`. Cloudflare R2 backs
the versioned asset paths; Cloudflare Pages (or another static-HTML
origin behind the same CDN) serves this directory's `index.html`.

## Files

- [`index.html`](index.html) — the single-page site. One constant
  (`ASSET_BASE`) controls which release of the card the demo loads;
  defaults to `/v0.2.0`.
- [`preview.png`](preview.png) — screenshot used by the project's
  root README and as the page's OpenGraph image.

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
        │  index.html      │                              │  /v0.2.0/       │
        │  preview.png     │                              │     geo-clock-  │
        │  logo.svg (TBD)  │                              │     card.js     │
        │                  │                              │     blue-       │
        │  Synced by       │                              │     marble-*    │
        │  deploy-site.yml │                              │     timezones-  │
        │  on every push   │                              │     iana.json   │
        │  to main         │                              │     …           │
        │                  │                              │  Uploaded once  │
        │                  │                              │  per release    │
        └──────────────────┘                              └─────────────────┘
```

The card's `imageryBase` resolves from `import.meta.url` — i.e. the
directory containing the loaded JS bundle. Because the bundle and all
imagery sit under the same `/v<X.Y.Z>/` prefix, no manual
`imageryBase` override is needed: once the import succeeds, every
imagery / GeoJSON fetch already points at the right path.

## How deployment actually runs

### Site (HTML, preview.png, future logo.svg)

[`.github/workflows/deploy-site.yml`](../../.github/workflows/deploy-site.yml)
syncs `docs/web/` to the `geoclock-world` R2 bucket on every push to
`main`. Required repo secrets:

| Secret | Source |
| --- | --- |
| `R2_ACCESS_KEY_ID` | Cloudflare → R2 → Manage R2 API Tokens |
| `R2_SECRET_ACCESS_KEY` | (same flow) |
| `R2_ACCOUNT_ID` | Cloudflare dashboard → right column → "Account ID" |

The sync uses `--delete` so dropped files are removed from the bucket
too, but `--exclude 'v*/*'` protects the versioned card-asset
directories — they're populated by a separate release flow (below).

### Versioned card assets (`/v<X.Y.Z>/...`)

Currently uploaded out-of-band — either by a manual `wrangler` run
after each release, or by extending `release.yml` to push `dist/` to
R2 alongside the GitHub Release attachment. Sketch of the manual
path:

```bash
# After `npm run build`, replace v0.2.0 with the tag being shipped.
for f in dist/*; do
  wrangler r2 object put geoclock-world/v0.2.0/"$(basename "$f")" \
    --file "$f" \
    --cache-control 'public, max-age=31536000, immutable'
done
```

MIME types: the card bundle is `application/javascript`; imagery is
`image/jpeg`; GeoJSON is `application/json`. Cloudflare infers from
extension at the edge, but `--content-type` is available if you want
to be explicit.

### Bucket + DNS one-time wiring

1. Create the R2 bucket `geoclock-world`.
2. Bind it to the custom domain `geoclock.world`
   (R2 → bucket → Settings → Custom Domains → Connect domain).
   Cloudflare provisions the DNS record + TLS cert.
3. The bucket serves `index.html` at `/` automatically (R2 supports
   index document configuration in Custom Domains settings).

## Bumping the live demo to a new release

1. Build and tag the new release in the main repo (e.g. `v0.2.1`).
2. Upload that release's `dist/*` to R2 under the new `/v0.2.1/`
   prefix. Old prefixes stay; older snapshots of the demo can still
   be reached by editing one URL.
3. Edit one line in [`index.html`](index.html):

   ```diff
   - const ASSET_BASE = '/v0.2.0';
   + const ASSET_BASE = '/v0.2.1';
   ```

4. Commit + push. Cloudflare Pages auto-redeploys within a minute.

Visitors with the previous bundle still cached will load the old card
until their cache expires; the new path is a fresh URL so the browser
fetches it cleanly without needing a busted cache.

## Local testing

```bash
# Serve docs/web/ at http://localhost:8080
python3 -m http.server -d docs/web 8080

# Separately, make /v0.2.0/ resolve to the freshly-built dist/ so
# the relative ASSET_BASE works locally too. Simplest is a symlink:
ln -s ../../dist docs/web/v0.2.0
# (delete the symlink before committing so it doesn't end up in git)
```

Open <http://localhost:8080> and confirm the card mounts, imagery
loads, and time-zone hover works.

## When the logo arrives

Drop `logo.svg` into this folder, then in `index.html` replace the
header's `<div class="wordmark">` block with whatever combination
of logo + wordmark the design calls for. `geoclock.world/logo.svg`
will resolve once Pages redeploys.
