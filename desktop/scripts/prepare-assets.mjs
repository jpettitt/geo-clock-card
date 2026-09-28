import { readFile, writeFile, mkdir, rm, copyFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const assetNames = ['geo-clock-card.js', 'timezones.json', 'timezones-iana.json',
  'black-marble-2048.jpg', ...Array.from({ length: 12 }, (_, i) =>
    ['start', 'mid'].map(half => `blue-marble-${String(i + 1).padStart(2, '0')}-${half}-2048.jpg`)).flat()];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8' };

export async function prepareAssets(root = path.dirname(desktop)) {
  const output = path.resolve(root, 'desktop', '.generated');
  if (path.relative(path.resolve(root, 'desktop'), output) !== '.generated') throw new Error('Unsafe assembly directory');
  const copies = [
    ...['index.html', 'app.js', 'app.css', 'credits.html'].map(name => [`desktop/renderer/${name}`, name]),
    ...['geoclock-config.js', 'geoclock-webconfig.js', 'geoclock-planner.js'].map(name => [`docs/web/${name}`, `shared/${name}`]),
    ...assetNames.map(name => [`dist/${name}`, `assets/${name}`]),
    ['LICENSE', 'LICENSE.txt'],
  ];
  // Validate every source before replacing the previous assembled output.
  for (const [source] of copies) {
    let info;
    try { info = await stat(path.join(root, source)); } catch { throw new Error(`Missing required asset: ${source}`); }
    if (!info.isFile() || !info.size) throw new Error(`Empty required asset: ${source}`);
    if (source.endsWith('timezones.json') || source.endsWith('timezones-iana.json')) {
      const data = JSON.parse(await readFile(path.join(root, source), 'utf8'));
      if (!Array.isArray(data.features) || !data.features.length) throw new Error(`Invalid timezone data: ${source}`);
    }
  }
  await rm(output, { recursive: true, force: true });
  const manifest = {};
  for (const [source, target] of copies) {
    const destination = path.join(output, 'renderer', target);
    await mkdir(path.dirname(destination), { recursive: true });
    if (source === 'desktop/renderer/credits.html') {
      const template = await readFile(path.join(root, source), 'utf8');
      if (!template.includes('<!-- LICENSE_TEXT -->')) throw new Error('Missing license placeholder');
      const license = await readFile(path.join(root, 'LICENSE'), 'utf8');
      const escaped = license.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
      await writeFile(destination, template.replace('<!-- LICENSE_TEXT -->', escaped));
    } else {
      await copyFile(path.join(root, source), destination);
    }
    const bytes = await readFile(destination);
    manifest[`/${target}`] = { file: target, mime: types[path.extname(target)],
      size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  const wrapper = JSON.parse(await readFile(path.join(root, 'desktop/package.json'), 'utf8'));
  const upstream = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  let commit = 'unknown';
  try { commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
  await writeFile(path.join(output, 'asset-manifest.json'), JSON.stringify(manifest, null, 2));
  await writeFile(path.join(output, 'build-info.json'), JSON.stringify({ wrapper: wrapper.version, card: upstream.version,
    commit, assembledAt: new Date().toISOString() }, null, 2));
  await copyFile(path.join(root, 'LICENSE'), path.join(output, 'LICENSE'));
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await prepareAssets();
  console.log(`Prepared ${Object.keys(manifest).length} local files (${assetNames.length} clock assets).`);
}
