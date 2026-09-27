const fs = require('node:fs/promises');
const path = require('node:path');
const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'; frame-ancestors 'none'";

function localUrl(input) {
  try {
    const url = new URL(input);
    return url.protocol === 'geoclock:' && url.hostname === 'app' && !url.port && !url.username && !url.password;
  } catch { return false; }
}
function lookupAsset(input, method, manifest, root) {
  if (!['GET', 'HEAD'].includes(method)) return { status: 405 };
  if (!localUrl(input)) return { status: 403 };
  // Reject traversal before URL normalization can remove dot segments.
  const raw = input.split(/[?#]/)[0].replace(/^geoclock:\/\/[^/]+/i, '');
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch { return { status: 400 }; }
  if (/[\\\0%]/.test(decoded) || decoded.split('/').some(part => part === '..' || part === '.')) return { status: 400 };
  const key = decoded === '' || decoded === '/' ? '/index.html' : decoded;
  const entry = Object.hasOwn(manifest, key) ? manifest[key] : undefined;
  if (!entry || typeof entry.file !== 'string') return { status: 404 };
  const file = path.resolve(root, entry.file);
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return { status: 403 };
  return { status: 200, file, entry };
}
function createHandler(manifest, root) {
  return async request => {
    const asset = lookupAsset(request.url, request.method, manifest, root);
    if (asset.status !== 200) return new Response(null, { status: asset.status });
    try {
      const bytes = await fs.readFile(asset.file);
      return new Response(request.method === 'HEAD' ? null : bytes, { headers: {
        'Content-Type': asset.entry.mime, 'Content-Length': String(bytes.length),
        'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff',
      } });
    } catch { return new Response(null, { status: 404 }); }
  };
}
module.exports = { localUrl, lookupAsset, createHandler, CSP };
