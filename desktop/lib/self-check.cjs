const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitReady(win) {
  for (let i = 0; i < 150; i++) {
    if (await win.webContents.executeJavaScript("Boolean(document.querySelector('geo-clock-card')?.tzReady && document.getElementById('gcw-add-location'))")) return;
    await delay(100);
  }
  throw new Error('Clock did not become ready.');
}
async function run(desktop, output) {
  const { win, session, manifest } = desktop;
  await waitReady(win);
  const preferences = win.webContents.getLastWebPreferences();
  assert.equal(preferences.sandbox, true);
  assert.equal(preferences.contextIsolation, true);
  assert.equal(preferences.nodeIntegration, false);
  let assetCount = 0;
  for (const [url, entry] of Object.entries(manifest)) {
    const response = await session.fetch(`geoclock://app${url}`);
    assert.equal(response.status, 200);
    assert.equal((await response.arrayBuffer()).byteLength, entry.size);
    assetCount++;
  }
  await assert.rejects(session.fetch('https://example.com/'));
  const controls = await win.webContents.executeJavaScript(`({
    manual: !!document.getElementById('gcw-name'),
    search: !!document.querySelector('input[placeholder*="place"]'),
    options: [...document.querySelectorAll('.gcw-panel option')].map(e => e.value),
    node: typeof window.require,
    error: document.getElementById('stage-error').hidden,
    images: [...document.querySelector('geo-clock-card').shadowRoot.querySelectorAll('image')].map(e => e.getAttribute('href'))
  })`);
  assert.equal(controls.manual, true); assert.equal(controls.search, false);
  assert.ok(!controls.options.includes('me')); assert.equal(controls.node, 'undefined'); assert.equal(controls.error, true);
  assert.ok(controls.images.some(url => url && (url.startsWith('geoclock:') || url.startsWith('data:image/'))));
  await delay(500);
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'self-check.png'), (await win.webContents.capturePage()).toPNG());
  const report = { passed: true, assets: assetCount, blockedRequests: desktop.blockedCount(),
    electron: process.versions.electron, chromium: process.versions.chrome, node: process.versions.node,
    sandbox: true, contextIsolation: true, nodeIntegration: false };
  await fs.writeFile(path.join(output, 'self-check.json'), JSON.stringify(report, null, 2));
  return report;
}
module.exports = { run, waitReady };
