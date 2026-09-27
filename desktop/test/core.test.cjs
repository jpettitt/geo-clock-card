const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { lookupAsset, localUrl, CSP } = require('../lib/local-assets.cjs');
const { allowedRequest } = require('../lib/offline-policy.cjs');
const { restoreState } = require('../lib/window-state.cjs');
const root = path.resolve('fixture');
const manifest = { '/index.html': { file: 'index.html' } };

test('protocol serves only explicit local assets and GET/HEAD', () => {
  for (const method of ['GET', 'HEAD']) assert.equal(lookupAsset('geoclock://app/', method, manifest, root).status, 200);
  assert.equal(lookupAsset('geoclock://app/missing', 'GET', manifest, root).status, 404);
  assert.equal(lookupAsset('geoclock://app/', 'POST', manifest, root).status, 405);
  for (const url of ['https://app/', 'geoclock://other/', 'geoclock://user@app/', 'geoclock://app:80/']) {
    assert.equal(localUrl(url), false);
    assert.equal(lookupAsset(url, 'GET', manifest, root).status, 403);
  }
});
test('protocol rejects traversal, encodings and escaped manifest entries', () => {
  for (const name of ['../index.html', '%2e%2e/index.html', '%252e%252e/index.html', '%5cindex.html', '%00', '%xx']) {
    assert.equal(lookupAsset(`geoclock://app/${name}`, 'GET', manifest, root).status, 400);
  }
  assert.equal(lookupAsset('geoclock://app/bad', 'GET', { '/bad': { file: '../secret' } }, root).status, 403);
});
test('offline policy rejects external and executable URL schemes', () => {
  assert.equal(allowedRequest('geoclock://app/assets/timezones.json'), true);
  assert.equal(allowedRequest('data:image/png;base64,AA=='), true);
  for (const url of ['http://localhost/', 'https://example.com/', 'wss://example.com/', 'file:///secret', 'data:text/html,hi']) assert.equal(allowedRequest(url), false);
  assert.match(CSP, /connect-src 'self'/);
  assert.match(CSP, /object-src 'none'/);
});
test('window bounds recover from malformed and disconnected display settings', () => {
  const displays = [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }];
  assert.deepEqual(restoreState(null, displays), { x: 360, y: 160, width: 1200, height: 760, maximized: false });
  const state = restoreState({ x: -9000, y: Infinity, width: -1, height: 99999, maximized: 'yes' }, displays);
  assert.equal(state.width, 800); assert.equal(state.height, 1080); assert.ok(state.x >= 0); assert.equal(state.y, 0); assert.equal(state.maximized, false);
});
