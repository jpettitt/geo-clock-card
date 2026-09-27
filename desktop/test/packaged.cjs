// Run with Node: node desktop/test/packaged.cjs desktop/release/<portable-exe>
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
(async () => {
  if (!process.argv[2]) throw new Error('Provide a built portable executable.');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'GeoClock portable check '));
  const executable = path.join(temporary, 'GeoClock Offline.exe');
  const profile = path.join(temporary, 'fresh profile');
  const output = path.resolve(__dirname, '../.verification/packaged');
  try {
    await fs.copyFile(path.resolve(process.argv[2]), executable);
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    await new Promise((resolve, reject) => {
      const child = spawn(executable, ['--self-check', `--user-data-dir=${profile}`], {
        cwd: temporary, env, windowsHide: true, stdio: 'ignore',
      });
      const timeout = setTimeout(() => { child.kill(); reject(new Error('Packaged check timed out.')); }, 120000);
      child.on('error', error => { clearTimeout(timeout); reject(error); });
      child.on('exit', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error(`Packaged check exited with ${code}.`)); });
    });
    const report = JSON.parse(await fs.readFile(path.join(profile, 'self-check.json'), 'utf8'));
    assert.equal(report.passed, true); assert.equal(report.assets, 36);
    await fs.mkdir(output, { recursive: true });
    for (const name of ['self-check.json', 'self-check.png']) await fs.copyFile(path.join(profile, name), path.join(output, name));
    console.log('PASS: copied portable EXE launched outside checkout, from a path with spaces, with a fresh profile; all local assets and sandbox checks passed.');
    console.log(JSON.stringify(report));
  } finally {
    // This is only the directory created by mkdtemp above, never a user-selected profile.
    const relative = path.relative(os.tmpdir(), temporary);
    if (relative.startsWith('GeoClock portable check ') && !relative.includes(path.sep)) await fs.rm(temporary, { recursive: true, force: true });
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
