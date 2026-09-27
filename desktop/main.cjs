const { app, dialog } = require('electron');
const path = require('node:path');
const { boot } = require('./lib/desktop-app.cjs');
const args = process.argv.slice(1);
const profileArg = args.find(value => value.startsWith('--user-data-dir='));
const profileDir = profileArg?.slice('--user-data-dir='.length);
const selfCheck = args.includes('--self-check');
for (const flag of ['disable-background-networking', 'disable-component-update', 'disable-domain-reliability', 'disable-sync']) {
  app.commandLine.appendSwitch(flag);
}
let win;
const profile = profileDir || path.join(app.getPath('appData'), 'GeoClockOffline');
if (selfCheck && !profileDir) {
  console.error('Self-check requires an explicit fresh profile directory.'); app.exit(1);
} else if (profileDir && !path.isAbsolute(profileDir)) {
  console.error('Profile directory must be absolute.'); app.exit(1);
} else {
  app.setPath('userData', profile);
  if (!app.requestSingleInstanceLock()) { app.quit(); }
  else {
    app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
    app.on('window-all-closed', () => app.quit());
    boot({ profileDir: profile, show: !selfCheck }).then(async desktop => {
      win = desktop.win;
      if (selfCheck) {
        // Explicit local diagnostic, used to check the actual portable executable.
        await require('./lib/self-check.cjs').run(desktop, app.getPath('userData'));
        app.exit(0);
      }
    }).catch(() => {
      if (selfCheck) { console.error('Desktop self-check failed.'); app.exit(1); }
      else { dialog.showErrorBox('GeoClock Offline', 'The local clock could not load. Rebuild or obtain a complete portable package.'); app.quit(); }
    });
  }
}
