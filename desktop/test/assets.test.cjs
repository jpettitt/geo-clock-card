const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
test('asset assembly includes every seasonal image, timezone dataset and matching hash', async () => {
  const { prepareAssets, assetNames } = await import('../scripts/prepare-assets.mjs');
  const root = path.resolve(__dirname, '../..');
  const manifest = await prepareAssets(root);
  assert.equal(assetNames.length, 28); assert.equal(Object.keys(manifest).length, 36);
  for (const name of assetNames) assert.ok(manifest[`/assets/${name}`]);
  for (const entry of Object.values(manifest)) {
    assert.equal(path.isAbsolute(entry.file), false);
    const bytes = await fs.readFile(path.join(root, 'desktop/.generated/renderer', entry.file));
    assert.equal(bytes.length, entry.size);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  }
});
test('assembly fails before destroying previous output when a source is missing', async () => {
  const { prepareAssets } = await import('../scripts/prepare-assets.mjs');
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'geoclock-assets-'));
  try {
    await fs.mkdir(path.join(fixture, 'desktop/.generated'), { recursive: true });
    await fs.writeFile(path.join(fixture, 'desktop/.generated/keep'), 'keep');
    await assert.rejects(prepareAssets(fixture), /Missing required asset: desktop\/renderer\/index.html/);
    assert.equal(await fs.readFile(path.join(fixture, 'desktop/.generated/keep'), 'utf8'), 'keep');
  } finally { await fs.rm(fixture, { recursive: true, force: true }); }
});
