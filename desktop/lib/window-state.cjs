const fs = require('node:fs');
function restoreState(value, displays) {
  const state = value && typeof value === 'object' ? value : {};
  const primary = displays[0];
  const area = primary.workArea;
  let width = Number.isFinite(state.width) ? Math.max(800, Math.min(state.width, area.width)) : Math.min(1200, area.width);
  let height = Number.isFinite(state.height) ? Math.max(550, Math.min(state.height, area.height)) : Math.min(760, area.height);
  width = Math.min(width, area.width); height = Math.min(height, area.height);
  let x = state.x, y = state.y;
  const visible = Number.isFinite(x) && Number.isFinite(y) && displays.some(({ workArea: a }) =>
    x + Math.min(width, 100) > a.x && x < a.x + a.width - 100 && y >= a.y && y < a.y + a.height - 80);
  if (!visible) { x = Math.round(area.x + (area.width - width) / 2); y = Math.round(area.y + (area.height - height) / 2); }
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height), maximized: state.maximized === true };
}
function readState(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } }
function saveState(file, value) {
  try { fs.writeFileSync(`${file}.tmp`, JSON.stringify(value)); fs.renameSync(`${file}.tmp`, file); } catch {}
}
module.exports = { restoreState, readState, saveState };
