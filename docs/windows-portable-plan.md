# GeoClock Offline: portable Windows implementation plan

Status: implemented locally on `codex/windows-offline-app`; see `desktop/README.md`
and `desktop/VERIFICATION.md` for usage, results, and remaining checks.

Prepared 2026-09-27 against upstream commit `c4870ee172042fe7317fbee52fae299dee84164c` (card version `0.3.0`).

## 1. Outcome and fixed decisions

Produce a Windows x64 portable executable named `GeoClock-Offline-0.1.0-win-x64.exe`. A person should be able to copy it to a Windows 10/11 x64 PC, double-click it, and use the clock without an internet connection or administrator privileges.

The executable must contain Electron, the existing clock bundle, all imagery, timezone data, and the desktop UI. The user must not need to install Node.js, npm, Python, Git, WebView2, Home Assistant, a web server, or an Electron runtime separately. The developer does need Node/npm and initial internet access to acquire the packaging tools. Electron increases the distribution size because it includes a browser engine; report the actual finished size instead of promising a size now.

Use these decisions without asking the user to choose an architecture again:

- Add a separate `desktop/` npm package with Electron and electron-builder as its only direct development dependencies. Pin exact versions and commit its lockfile.
- Reuse the checked-in `dist/geo-clock-card.js` and data. A root-level npm install or card rebuild is unnecessary for this first version.
- Reuse `geoclock-config.js`, `geoclock-webconfig.js`, and `geoclock-planner.js` from `docs/web/`.
- Add an opt-in offline mode to the shared configuration panel. Existing website and extension behavior must retain their defaults.
- Load packaged files through the private URL `geoclock://app/index.html`. Do not start an HTTP server or rely on `file://` fetch behavior.
- Package an electron-builder `portable` target. Also produce an unpacked directory for diagnosis, but the portable EXE is the deliverable.
- Initial support is Windows x64. ARM64, an installer, publishing, automatic updates, wallpaper integration, startup registration, a tray process, and a global offline city database are outside this version.
- Settings stay in `%APPDATA%\GeoClockOffline`. Here, portable means no installation. Settings do not travel with a copied EXE; document this explicitly. Sidecar/USB settings can be a later enhancement.

## 2. Existing code to understand first

Read these files, then implement in the sequence below. Line numbers may drift; use the named functions as anchors.

| Existing file | Relevant behavior |
| --- | --- |
| `package.json` | Upstream version `0.3.0`; root build toolchain is separate from desktop packaging. |
| `dist/geo-clock-card.js` | Compiled ES module, includes Lit and the card editor; exports meeting-planner helpers. Uses sibling images and JSON by default. |
| `dist/` | Already contains 24 `blue-marble-MM-{start,mid}-2048.jpg` files, `black-marble-2048.jpg`, `timezones.json`, and `timezones-iana.json`. |
| `docs/web/geoclock-config.js` | `loadCardBundle(assetBase)` imports the bundle. `applyConfig()` adapts ordinary coordinates to the Home Assistant-shaped object expected by the card. |
| `docs/web/geoclock-webconfig.js` | `initWebConfig(card, opts)` supplies the settings panel and localStorage. It returns `getMarkers`, `isRemembered`, and `subscribe`. It currently includes Nominatim search, browser geolocation, and share links. |
| `docs/web/geoclock-planner.js` | `initPlanner(card, {webApi, bundle, mount})` is already local and can be reused. |
| `docs/web/index.html` | Reference for mounting the card, planner, fullscreen sizing, and the UI layout. Its `/v0.3.0` paths and PWA code are website-specific. |
| `chrome-extension/newtab.js` | Example of local bundle loading and `rememberByDefault: true`. |
| `LICENSE`, `README.md` | Preserve existing license and imagery/data acknowledgments. |

The existing Windows environment has Node `v24.19.0`, npm `11.17.0`, and an x64 Node process. Use `npm.cmd` in PowerShell to avoid a PowerShell script-policy issue with `npm.ps1`.

If Git cannot locate its HTTPS helper, inspect the local Git installation and use a command-scoped helper-path override. Do not commit machine-specific Git paths or settings.

## 3. File map

Create the following files; combine small helpers if that simplifies the implementation without weakening the tests.

```text
desktop/
  package.json
  package-lock.json
  electron-builder.yml
  main.cjs
  lib/
    desktop-app.cjs          # shared startup used by main and smoke checks
    local-assets.cjs         # manifest lookup and local protocol responses
    offline-policy.cjs       # URL/permission policy and session hooks
    window-state.cjs         # saved bounds, validation, restore placement
  renderer/
    index.html
    app.js
    app.css
    credits.html
  scripts/
    prepare-assets.mjs
  test/
    local-assets.test.cjs
    window-state.test.cjs
    smoke.cjs
  README.md
  VERIFICATION.md
  .generated/               # ignored: assembled app resources
  release/                  # ignored: packaged results
```

Modify these existing files only as needed:

- `docs/web/geoclock-webconfig.js`: additive `offline` option and manual marker controls.
- `.gitignore`: ignore `desktop/.generated/` and `desktop/release/`; existing `node_modules/` rule already applies.
- Root `README.md`: a short Windows-portable section linking to `desktop/README.md`.

Keep upstream `src/`, `dist/`, root package dependencies, website entry pages, extension manifests, and CI workflows unchanged unless a concrete blocker demonstrates otherwise. Do not hand-edit the compiled card. If the base revision differs, check these assumptions before copying assets.

## 4. First checkpoint: deterministic asset assembly

Implement `desktop/scripts/prepare-assets.mjs` using Node built-ins. Resolve all paths from the script location, never the caller's current directory. It must work when the repository path contains spaces.

Assemble:

```text
desktop/.generated/
  asset-manifest.json
  build-info.json
  LICENSE
  renderer/
    index.html
    app.js
    app.css
    credits.html
    LICENSE.txt
    shared/
      geoclock-config.js
      geoclock-webconfig.js
      geoclock-planner.js
    assets/
      geo-clock-card.js
      timezones.json
      timezones-iana.json
      black-marble-2048.jpg
      blue-marble-01-start-2048.jpg
      blue-marble-01-mid-2048.jpg
      ...all months through 12...
```

Use an explicit filename list generated for months 01 through 12. Require every listed file to exist and be nonempty; parse both timezone JSONs and require nonempty `features` arrays. Copy the three shared modules, desktop renderer files, root LICENSE, and all 28 required files from `dist/` (one JS + two JSON + 25 JPG). Copy the root license into generated `renderer/LICENSE.txt` as well, include it in the public manifest, and link it from the local credits page. Do not copy website PWA files, service workers, source maps, the entire repository, or development `node_modules`.

`asset-manifest.json` should map each public URL pathname, such as `/assets/timezones.json`, to its relative path under the generated renderer root, MIME type, size, and SHA-256. Generate entries from the allowlisted copies, not from arbitrary workspace enumeration. `build-info.json` records wrapper version, upstream card version, source commit when available, and assembly time. A source archive without `.git` should build with the commit marked unknown.

Regeneration may clear only the known `desktop/.generated` directory. Verify the resolved deletion target is inside `desktop/`; do not use computed broad recursive deletion. No asset download, npm install, or project code execution belongs in this script.

Checkpoint: preparation reports all expected assets, and deliberate removal of one input causes a clear failure. Use a temporary fixture for that failure check; do not delete the user's real assets.

## 5. Second checkpoint: offline desktop window

### Main process and startup order

Use CommonJS `.cjs` for Electron main-process code; the upstream repository uses ES modules, so the explicit extension avoids ambiguity. `main.cjs` should be a small entry point calling an exported bootstrap from `lib/desktop-app.cjs`; the test entry can call that same bootstrap with a temporary profile and a hidden window.

1. Register `geoclock` before Electron's ready event with `standard: true`, `secure: true`, and `supportFetchAPI: true`. Enable CORS support if needed for normal same-origin module/fetch behavior. Do not grant `bypassCSP` or service-worker privileges.
2. Set a stable `userData` directory under `app.getPath('appData')/GeoClockOffline` before creating sessions/windows. Put session data under that profile as well. Test startup must be able to override this with a temporary directory without touching real settings. Honor an explicit diagnostic `--user-data-dir=<absolute path>` argument in the packaged entry point too, validating it before use, so a packaged cold-start test does not require moving or erasing the normal profile. Document this only in the developer/testing instructions; the normal user double-clicks the EXE.
3. Acquire a single-instance lock in the ordinary entry point; launching again should focus/restore the existing window.
4. After ready, create one persistent Electron session, e.g. `persist:geoclock-offline`.
5. Register the protocol on **that session's** `protocol` object and attach offline policy hooks before loading any renderer content. The window must use the same session.
6. Create a `BrowserWindow`, initially hidden, with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and normal web security enabled. No preload bridge is needed. Show after ready-to-show, with a clear local error dialog if loading fails.
7. Load exactly `geoclock://app/index.html`.

Resolve packaged resource paths under `app.getAppPath()` so the same layout works in development and inside `app.asar`. Do not look for files relative to `process.cwd()`, the repository, or the portable launcher's temporary extraction directory.

### Local protocol

Use `protocol.handle` to return a `Response` from local file bytes and the manifest MIME type. Node filesystem reads work with Electron's ASAR support. This avoids a loopback listener and avoids forwarding local reads through a network API.

Accept only GET/HEAD for the `geoclock:` scheme, host `app`, no credentials, and no port. Look up the URL path in the generated manifest; map `/` explicitly to `/index.html`. Decode cautiously and reject malformed encodings, backslashes, null bytes, and unknown paths. Never join an unchecked URL path directly onto a filesystem directory. Restrict reads to the generated renderer tree even if a manifest entry is malformed. Return 400/403/404/405 as appropriate, not arbitrary file contents. For HEAD return headers without a body.

Use the parsed protocol/hostname fields for checks. Do not assume Node's `new URL(customSchemeUrl).origin` behaves like the renderer's registered standard origin.

### Offline policy

The application must not depend on the user disconnecting Wi-Fi:

- Register a single `webRequest.onBeforeRequest` handler on its session to cancel HTTP, HTTPS, WebSocket, FTP, and other external URL requests. Allow the private app URLs; allow `data:` image resources only if required. Keep request checks in a testable helper.
- Deny new windows with `setWindowOpenHandler`; cancel navigation/redirects away from the private app host. Do not call `shell.openExternal`.
- Implement both session permission-check and permission-request handlers. Deny location, camera, microphone, notifications, clipboard reads, and device access. Permit user-initiated fullscreen only for the local app when needed.
- Do not include an updater, crash uploading, analytics, telemetry SDK, remote fonts, or Node-side network calls. Do not enable a remote-debugging port in the release build.
- Add a restrictive CSP to served HTML. Start with `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'`. Inline styles are needed by Lit and the existing settings/planner UI; inline scripts and eval are not.

These controls address application requests. Verification must distinguish observed app traffic from unrelated Windows/browser processes; do not claim a global OS network guarantee from one request hook.

### Window behavior and settings

Start around 1200 by 760 with a sensible minimum around 800 by 550. Use the normal resizable Windows frame. Save normal window bounds and maximized state in the profile. Validate finite numbers and minimum sizes, and restore on a visible display if a monitor disappeared. Recover from corrupt settings by using defaults. Closing the last window must exit; do not leave a hidden tray/background app.

Provide F11 to toggle window fullscreen and Escape to exit it. The map should preserve its aspect ratio, with letterboxing instead of distorted/cropped geography. Reuse the existing aspect-ratio handling as a reference. Check that the settings button remains usable or that exiting fullscreen restores it normally.

## 6. Third checkpoint: useful offline UI

Create a small desktop shell with a map stage, fullscreen control, planner mount, settings access, and a local credits page. Use system fonts. Omit website installation banners, PWA registration, public share links, and public-site navigation. Display a short note near the coordinate controls such as “Locations are entered manually; this app works offline.” Do not surface implementation details in the normal UI.

Bootstrap `renderer/app.js` in this order:

```js
import { loadCardBundle } from './shared/geoclock-config.js';
import { initWebConfig } from './shared/geoclock-webconfig.js';
import { initPlanner } from './shared/geoclock-planner.js';

const bundle = await loadCardBundle('../assets');
// IMPORTANT: loadCardBundle's dynamic import resolves relative to
// shared/geoclock-config.js. ../assets therefore resolves to /assets.
const card = document.createElement('geo-clock-card');
document.getElementById('stage').appendChild(card);
const webApi = initWebConfig(card, {
  offline: true,
  rememberByDefault: true,
});
initPlanner(card, {
  webApi,
  bundle,
  mount: document.getElementById('planner'),
});
```

Wrap initialization in error handling with a visible local error message. Bundle-relative defaults must load imagery and JSON from `geoclock://app/assets/`. Do not set the website's `/v0.3.0` base or a CDN URL. The clock uses the machine clock and the bundled runtime's timezone rules.

### Shared panel changes: precise contract

Add `const offline = opts.offline === true` inside `initWebConfig`. With the option omitted, preserve existing behavior and its return API.

For `offline: true`:

1. Normalize loaded URL/stored configuration **before the first render**. Convert `center: 'me'` to a valid fixed-longitude mode (use an available finite stored longitude, otherwise zero), remove `auto` location markers, and retain valid fixed markers. Ensure reset/default paths remain valid offline. Explain conversion briefly if it affects an existing configuration.
2. Make `needsGeo()` false in offline mode and guard `refreshMyLocation`/`ensureGeoLoop` so no location timer or API call can start, including from restored configuration.
3. Offer only Sun and Fixed longitude centering. Omit live location controls.
4. Replace place search with three labeled inputs: Name, Latitude, Longitude, plus “Add location.” Validate nonempty trimmed name, nonempty coordinate inputs, finite numeric values, latitude within -90..90, and longitude within -180..180. Accept zero. Reject invalid input visibly without silently clamping it or converting an empty string to zero.
5. On valid input push `{label, lat, lon}` into the existing `cfg.markers`, then call `renderMarkers()`, `render()`, and `persist()`. Preserve existing rename, removal, marker colors, display toggles, locale, and planner behavior. Use textContent/the existing DOM helper for labels.
6. Omit Nominatim attribution/search UI and “Copy share link” from the offline panel. Keep the separate timezone-data and imagery acknowledgments in the local credits page.
7. Use wording “Remember settings” for this mode. Retain the existing remember/reset semantics and localStorage keys, scoped naturally to the desktop app's separate origin/profile. `getMarkers`, `isRemembered`, and `subscribe` must continue to work for the planner.
8. Add a defensive guard at the offline search event path so a hidden/unmounted control cannot accidentally issue a request. Do not merely hide network-dependent controls with CSS.

Build the panel conditionally using its DOM helper. Avoid string-replacing the shared JS during assembly or maintaining a full divergent copy of the panel.

Useful fixed locations for acceptance checks: San Francisco (37.7749, -122.4194), London (51.5074, -0.1278), Tokyo (35.6762, 139.6503). These are test inputs, not the user's location; ship an empty marker list by default.

## 7. Fourth checkpoint: package the executable

Inside `desktop/package.json`, use a distinct name such as `geoclock-offline-desktop`, product name `GeoClock Offline`, version `0.1.0`, `private: true`, and `main: "main.cjs"`. The upstream card remains version `0.3.0`.

Select current stable Electron and electron-builder releases compatible with installed Node, verify their engine requirements, install with `--save-dev --save-exact`, and commit the generated `desktop/package-lock.json`. Resolve versions using `npm.cmd view electron version` and `npm.cmd view electron-builder version`; inspect the chosen packages' `engines` before installation. Do not use a prerelease or leave `latest`/caret versions in the committed file. Electron's normal installation downloads its runtime; do not suppress the required installation step with a blanket `--ignore-scripts`.

Provide these scripts:

```json
{
  "prepare-assets": "node scripts/prepare-assets.mjs",
  "start": "npm run prepare-assets && electron .",
  "test": "node --test test/local-assets.test.cjs test/window-state.test.cjs",
  "test:smoke": "npm run prepare-assets && electron test/smoke.cjs",
  "pack": "npm run prepare-assets && electron-builder --dir --win --x64",
  "dist:win": "npm run prepare-assets && electron-builder --win portable --x64"
}
```

Use electron-builder configuration equivalent to:

```yaml
appId: local.geoclock.offline
productName: GeoClock Offline
asar: true
directories:
  output: release
files:
  - main.cjs
  - lib/**/*
  - .generated/**/*
  - package.json
win:
  target:
    - target: portable
      arch: [x64]
artifactName: GeoClock-Offline-${version}-win-${arch}.${ext}
```

Explicitly verify that the dot-prefixed `.generated` tree is included by the selected builder version. Keep build scripts/tests outside the packaged app. Preserve Electron/Chromium notices and include the upstream MIT license plus local NASA/timezone-data acknowledgments. Use existing branding where practical; a custom Windows icon is optional polish and must not introduce an additional runtime dependency.

For the first private build, code signing is not required. If packaging expects a certificate, configure an unsigned local build through the supported builder settings. Do not request credentials, buy a certificate, disable Windows security, or publish anything. Document that an unsigned private EXE may show an unknown-publisher warning. Do not report an unsigned file as signed.

Expected developer commands, once implementation is authorized:

```powershell
Set-Location desktop
# First implementation: resolve stable package versions, install/save exact pins.
# Subsequent builds from the committed lockfile:
npm.cmd ci
npm.cmd test
npm.cmd run test:smoke
npm.cmd run pack
npm.cmd run dist:win
```

Do not invoke root `npm run fetch-assets`; the files are already present. Do not install a native compiler, Rust, Python, or an SDK speculatively. If the two chosen packaging dependencies unexpectedly require additional tools, diagnose the exact dependency and report it before expanding the architecture.

## 8. Verification required during implementation

Use Node's built-in test runner and a small Electron test entry; avoid adding Playwright, Spectron, a second bundler, or another framework just for this task. Electron main-process `webContents.executeJavaScript` can drive the packaged local renderer in the smoke harness. The renderer itself must not gain Node privileges or a general IPC bridge for testing.

The smoke entry should create an isolated temporary profile, invoke the same startup code as the application with `show: false`, impose a timeout, close windows, quit, and return a nonzero exit code on failure. Print concise results. Ensure Electron variables such as `ELECTRON_RUN_AS_NODE` are not accidentally causing the CLI to run in Node mode; correct only the child environment if necessary.

### Automated checks

- Protocol lookup serves the correct MIME types and cannot access unknown files, external hosts, encoded traversal, malformed escapes, credentials, ports, or files outside the generated tree. Check valid GET and HEAD.
- Assembly includes all 24 seasonal images and parses both timezone datasets. Check manifest hashes against staged bytes.
- With a fresh profile, the actual renderer mounts the card; displayed images decode and timezone data becomes ready. Do not count `waitForCardAssets` completing as proof: it intentionally catches image errors and can time out successfully. Assert `card.tzReady`, image `naturalWidth > 0`, and actual successful local responses.
- Inspect all 25 JPG URLs and both JSON URLs through the private protocol, so a missing future month's image cannot hide behind today's successful map.
- Simulate clicking the offline form: add two markers, reject empty/out-of-range inputs, and check zero coordinates. Verify marker rename/removal and the planner receive the updated markers.
- Persist settings, close/reopen using the same temporary profile, and verify restoration. On a separate test profile, preload legacy `center: 'me'` and `auto` marker settings; verify conversion without geolocation calls or timers.
- Attempt an HTTPS fetch and a WebSocket connection from the renderer and assert they are blocked. Use temporary local HTTP/WebSocket listeners as controlled targets for at least one check and verify they receive zero connections/requests; these listeners are test-only and never shipped. Also exercise a session-level request through the app's session against the controlled listener to test the request hook independently of renderer CSP. Distinguish a policy rejection from merely having no internet.
- Observe ordinary startup and marker/planner interactions: they should not even attempt outbound requests. Blocked-request observations must not log personal marker labels/coordinates.
- Verify the default web panel still presents its online controls with `offline` omitted. This regression check may reuse a local test page/session with stubbed geolocation and fetch responses; do not call Nominatim or trigger actual location permission prompts.
- Verify corrupt/offscreen window-state handling and normal exit. Flush persistent browser storage before a deliberate test relaunch if required; use a real graceful close rather than killing the process.

### Packaged acceptance checks

1. Run the actual portable EXE from a different directory whose path contains spaces, with the repository and developer servers unavailable. Confirm it does not read runtime resources from the checkout.
2. Test a cold launch with an empty app profile and network unavailable, not just a warmed browser cache. Use a controlled test environment; do not change the user's global network/security settings. Also test ordinary connected operation with the application's outbound policy active.
3. Confirm the map, night shading, clock/date, timezone popups, manual markers, saved settings, fullscreen/restore, and meeting planner work. January and July imagery must both load when exercised by the planner or a test-only time preview.
4. Check a normal visible window at common sizes and Windows display scaling; ensure the settings panel is reachable and the map remains proportional. Capture the local renderer using Electron's `webContents.capturePage()` and inspect the saved image with image/file tools; browser-control automation is unnecessary. This requires an actual visual check, not just DOM assertions.
5. Launch a second instance; the existing window should come forward. Closing it should leave no GeoClock background process.
6. Copy only the EXE to a clean Windows x64 environment without development tools when available. If no clean machine/VM is available, explicitly mark that check unperformed; do not infer it from the developer machine. Record the OS actually tested.
7. Record the artifact path, size, SHA-256, wrapper/Electron versions, included upstream commit, checks passed, and any unperformed checks in `desktop/VERIFICATION.md`.

The prior request was to avoid running the source project. The current turn produces only this plan. The handoff task below explicitly authorizes building and validating the desktop implementation when the user gives it to the implementing model; it does not authorize publishing or changing global machine security settings.

## 9. Common failures and prescribed fixes

| Symptom | Check/fix |
| --- | --- |
| Blank window, failed ES-module import | Confirm standard secure scheme registration before ready, protocol registration on the window's session, correct JavaScript MIME type, and the dynamic import's path relative to `shared/geoclock-config.js`. |
| Clock displays but map or timezone hover is absent | Confirm all sibling `/assets/` data files exist, fetch privilege is enabled, and CSP/request policy allow the private scheme. Do not enable `webSecurity: false`. |
| Website URLs or location requests appear | Confirm the desktop never imports the website entry/PWA modules, `offline: true` reaches the panel, and restored configuration is normalized before the first render. |
| Settings disappear each launch | Confirm a stable origin, stable userData path, and a persistent session; never store settings in the portable launcher's temporary extraction directory. |
| Packaged version fails while development works | Inspect the packaged `.generated` files and app-relative paths. No resource may depend on the working directory or `../docs`/`../dist` at runtime. |
| Fullscreen map markers drift | Preserve the map's aspect ratio and letterbox; do not stretch the frame or switch SVG cropping independently of marker placement. |
| npm/Electron fails in the agent environment | Use `npm.cmd`, check the exact error and child environment, and retain the scoped Git helper workaround if needed. Avoid browser-based downloads or machine-wide workarounds. |

## 10. Completion and handoff

Implementation is complete only when the portable EXE exists, the meaningful automated checks pass, and the actual packaged app has been exercised. If a required check cannot be performed in the environment, report the gap explicitly and keep it separate from passing checks. A source scaffold or a successful `electron .` launch alone is insufficient.

The implementation response should link the EXE and desktop README, explain “double-click; no additional runtime installation,” identify where settings are stored, and summarize verified offline behavior. Include any unsigned-app limitation and any clean-machine test gap concisely. Leave changes local unless the user asks for a commit/push or publication.

### Prompt to give the implementing model

> Implement the portable Windows Electron app described in `docs/windows-portable-plan.md`. Read the plan first and follow its architecture and checkpoints. Work in `the repository root`, preserve existing changes, and inspect applicable AGENTS.md instructions. Build the actual portable Windows x64 EXE and run the plan's focused verification, including the packaged app. Reuse the existing clock bundle and assets, add the opt-in offline configuration mode, and keep dependencies confined to the desktop package. The end user must not install Node, Python, Git, WebView2, or Home Assistant. Use CLI/file tools; do not use browser control to obtain dependencies or clone repositories. Do not publish, push, install startup tasks, or change global network/security settings. If environment limits prevent a check, document the precise gap instead of claiming it passed. Finish with links to the EXE, README, and verification record.

## Official API references

Consult these for exact signatures for the selected pinned Electron version. The architecture and product decisions above are specific to this repository.

- [Electron overview](https://www.electronjs.org/docs/latest/): bundled desktop runtime.
- [Custom protocols](https://www.electronjs.org/docs/latest/api/protocol): private scheme, privileges, session registration, and response handling.
- [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security): renderer isolation and content security policy.
- [Session](https://www.electronjs.org/docs/latest/api/session): permission handlers and persistent sessions.
- [WebRequest](https://www.electronjs.org/docs/latest/api/web-request): request cancellation.
- [BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window): window creation and web preferences.
- [App](https://www.electronjs.org/docs/latest/api/app): lifecycle, profiles, and single-instance handling.
- [electron-builder target selection](https://www.electron.build/v26/docs/targets/): portable Windows executable.
- [electron-builder configuration](https://www.electron.build/docs/configuration/) and [portable options](https://www.electron.build/docs/api/app-builder-lib.interface.portableoptions/): packaging configuration.
