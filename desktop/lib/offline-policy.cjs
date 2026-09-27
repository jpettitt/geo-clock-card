const { localUrl } = require('./local-assets.cjs');
function allowedRequest(url) { return localUrl(url) || url.startsWith('data:image/'); }
function attachOfflinePolicy(session, onBlocked = () => {}) {
  session.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    const allowed = allowedRequest(details.url);
    if (!allowed) onBlocked(); // Count only: never record URLs or user input.
    callback({ cancel: !allowed });
  });
  session.setPermissionCheckHandler((contents, permission, origin, details) =>
    permission === 'fullscreen' && localUrl(details?.requestingUrl || contents?.getURL() || ''));
  session.setPermissionRequestHandler((contents, permission, callback, details) =>
    callback(permission === 'fullscreen' && localUrl(details?.requestingUrl || contents?.getURL() || '')));
}
function restrictWindow(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  for (const event of ['will-navigate', 'will-redirect']) win.webContents.on(event, (e, url) => {
    if (!localUrl(url)) e.preventDefault();
  });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
}
module.exports = { allowedRequest, attachOfflinePolicy, restrictWindow };
