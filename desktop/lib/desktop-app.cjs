const { app, BrowserWindow, protocol, session, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { createHandler } = require('./local-assets.cjs');
const { attachOfflinePolicy, restrictWindow } = require('./offline-policy.cjs');
const { restoreState, readState, saveState } = require('./window-state.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'geoclock', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true,
} }]);

async function boot({ profileDir, show = true, root = app.getAppPath() } = {}) {
  const profile = profileDir || path.join(app.getPath('appData'), 'GeoClockOffline');
  if (!path.isAbsolute(profile)) throw new Error('Profile directory must be absolute.');
  fs.mkdirSync(profile, { recursive: true });
  app.setPath('userData', profile);
  app.setPath('sessionData', profile);
  await app.whenReady();
  const ses = session.fromPartition('persist:geoclock-offline');
  let blocked = 0;
  attachOfflinePolicy(ses, () => { blocked++; });
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.generated/asset-manifest.json'), 'utf8'));
  ses.protocol.handle('geoclock', createHandler(manifest, path.join(root, '.generated/renderer')));
  const stateFile = path.join(profile, 'window-state.json');
  async function createWindow() {
    const state = restoreState(readState(stateFile), [screen.getPrimaryDisplay(), ...screen.getAllDisplays().filter(d => d.id !== screen.getPrimaryDisplay().id)]);
    const win = new BrowserWindow({ ...state, show: false, minWidth: 800, minHeight: 550,
      backgroundColor: '#080e1c', title: 'GeoClock Offline', autoHideMenuBar: true,
      webPreferences: { session: ses, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
    });
    win.removeMenu();
    restrictWindow(win);
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      if (input.key === 'F11') {
        event.preventDefault();
        win.webContents.executeJavaScript("document.fullscreenElement ? document.exitFullscreen() : document.getElementById('stage')?.requestFullscreen()", true).catch(() => {});
      }
      if (input.key === 'Escape' && win.isFullScreen()) win.setFullScreen(false);
    });
    win.on('close', () => {
      saveState(stateFile, { ...win.getNormalBounds(), maximized: win.isMaximized() });
      ses.flushStorageData();
    });
    if (state.maximized) win.maximize();
    if (show) win.once('ready-to-show', () => win.show());
    await win.loadURL('geoclock://app/index.html');
    return win;
  }
  return { win: await createWindow(), createWindow, session: ses, manifest, blockedCount: () => blocked };
}
module.exports = { boot };
