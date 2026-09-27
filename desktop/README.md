# GeoClock Offline for Windows

A portable Windows x64 version of the world clock, built with Electron. All map
images, timezone polygons, scripts and styles are included. Runtime requests to
external sites are blocked. There is no telemetry, update service or startup task.

## Run

Double-click `GeoClock-Offline-0.1.1-win-x64.exe` from the release directory. No
installation of Node, Git, Python, WebView2, Home Assistant or a browser is needed.
The executable extracts its bundled runtime into a temporary directory when it
starts; allow a few seconds for the first launch. Windows 10/11 x64 is the target.

The executable is unsigned and uses the default Electron icon. Windows may show
a publisher warning. Do not disable Windows security settings to run it.

- Open **Customize** to change map settings and enter a location's name, latitude
  and longitude. Latitude is −90 to 90; longitude is −180 to 180. Zero is valid.
- Live location and online place search are unavailable in this offline version.
- The meeting planner uses the manually entered locations and local timezone data.
- Use the fullscreen button or **F11**; press **Escape** to leave fullscreen.
  Moving, clicking or touching the map reveals a small exit icon in the top-right
  corner. It fades after five seconds of inactivity; click it to leave fullscreen.
- **Remember settings** is on initially. Uncheck it to stop saving clock and planner
  settings. Reset restores the clock defaults.

Settings and Chromium storage live in `%APPDATA%/GeoClockOffline`, not beside the
executable. Moving the EXE does not move settings. Removing that directory while
the app is closed clears saved settings. No location data is committed to Git.
Time and date follow the computer's clock; offline use does not synchronize it.
Timezone rule changes require obtaining a newer build.

## Build from the repository root

The builder needs Node 22.12 or newer, npm, and internet access to obtain build
dependencies and the Electron/packaging binaries. No root-package install or
rebuild of the prebuilt clock bundle is required.

```powershell
npm.cmd ci --prefix desktop --no-audit --no-fund
npm.cmd test --prefix desktop
npm.cmd run test:smoke --prefix desktop
npm.cmd run dist:win --prefix desktop
node desktop/test/packaged.cjs desktop/release/GeoClock-Offline-0.1.1-win-x64.exe
```

The final EXE is under `desktop/release/`. `win-unpacked/` is a second distribution
option: keep the entire directory together and run `GeoClock Offline.exe`.
`npm.cmd start --prefix desktop` launches the development wrapper.

Electron and electron-builder are pinned in the desktop lockfile. The root
package and its build dependencies remain separate. `prepare-assets` validates
the sources before assembling the 28 clock assets, three shared UI modules and
desktop files into `.generated/`. Runtime files are served from an explicit
manifest over `geoclock://app`; the app does not start a local web server.

## Isolation and verification

The renderer is sandboxed, has context isolation, and cannot access Node. A content
security policy and session request policy restrict traffic to bundled resources
and image data URLs. New windows, external navigation, webviews, location and
other device permissions are denied. There is no preload bridge or IPC API.

`test:smoke` uses a separate temporary profile. It verifies the real renderer,
local resources, network rejection, manual coordinates, persistence, planner,
fullscreen, legacy live-location conversion and the shared online panel.
Generated screenshots and reports are ignored by Git.

An explicit packaged diagnostic is available for maintainers:

```powershell
# Choose a new absolute profile directory at runtime; do not reuse personal settings.
& '.\desktop\release\GeoClock-Offline-0.1.1-win-x64.exe' --self-check '--user-data-dir=<fresh-absolute-directory>'
```

It exits after checking assets/isolation/network denial and writing
`self-check.json` and `self-check.png` into that profile. The command requires a
profile argument and does not transmit reports. See [VERIFICATION.md](VERIFICATION.md)
for the actual results and checks that remain.

## Credits

The upstream MIT license is included in the app and retained unchanged. NASA map
imagery, Natural Earth boundaries and OpenStreetMap-derived timezone polygons
retain their upstream attribution; the **About** page describes them. The
distribution also contains Electron/Chromium license notices.
