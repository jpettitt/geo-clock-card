// geoclock-planner.js — the meeting planner strip on geoclock.world.
//
// Sits BELOW the map stage: a 48-hour heat strip scored across the
// user's markers (plus "You"), best-window chips, a datetime probe,
// and a scrub interaction that time-travels the whole card via the
// card's `previewNow` property (a cheap property write — no
// setConfig, so the card's tz caches survive per-frame scrubbing).
//
// Layering rules (same as geoclock-webconfig.js):
//   - This module is UI for the demo page + (later) the extension.
//     It must NOT be imported by wallpaper.html or the macOS app.
//   - Scoring math lives in the card bundle (src/meeting-plan.ts),
//     passed in as `bundle`, so there is exactly one implementation.
//   - Marker state is read via the API returned by initWebConfig
//     (`webApi`) and the card's public `resolvedMarkers` getter.
//
// localStorage: `geoclock.planner.v1` — { open, workStart, workEnd,
// excluded: string[] } — written only while the Customize panel's
// "Remember on this browser" is on, mirroring the main config's
// opt-in. Cleared when the user opts out.

const STORAGE_KEY = 'geoclock.planner.v1';

const STEP_MIN = 30; // cell width in minutes — half-hour zones
const STEPS = 96; //    (India, Chatham) make hour cells lie
const YOU_KEY = '__you__';

// Awake band is fixed by product decision; only work hours are
// user-adjustable.
const AWAKE_START = 7;
const AWAKE_END = 21;

const PLANNER_CSS = `
.gcp-root {
  background: #0e141d;
  border-top: 1px solid rgba(255,255,255,0.08);
  color: #e6e9ef;
  font: 0.9rem/1.45 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
}
body.pseudo-fs .gcp-root { display: none; }
.gcp-inner { max-width: 1100px; margin: 0 auto; padding: 0.6rem 1rem 0.9rem; }
.gcp-bar { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.gcp-toggle {
  background: none; border: none; color: #e6e9ef; cursor: pointer;
  font: 600 0.95rem/1.3 inherit; padding: 0.25rem 0;
  display: inline-flex; align-items: center; gap: 0.45rem;
}
.gcp-toggle .gcp-caret { color: #8893a4; font-size: 0.8em; }
.gcp-live {
  background: #243042; border: 1px solid rgba(255,255,255,0.14);
  color: #e6e9ef; border-radius: 999px; padding: 0.2rem 0.7rem;
  font: 600 0.78rem/1.4 inherit; cursor: pointer; display: none;
  align-items: center; gap: 0.4rem;
}
.gcp-live::before {
  content: ''; width: 8px; height: 8px; border-radius: 50%;
  background: #ff7a3d; animation: gcp-pulse 1.2s ease-in-out infinite;
}
@keyframes gcp-pulse { 50% { opacity: 0.35; } }
.gcp-root.is-previewing .gcp-live { display: inline-flex; }
.gcp-preview-label { color: #ffb38a; font-size: 0.82rem; display: none; }
.gcp-root.is-previewing .gcp-preview-label { display: inline; }
.gcp-body { margin-top: 0.6rem; }
.gcp-chips {
  display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;
  min-height: 1.9rem; margin-bottom: 0.45rem;
  color: #8893a4; font-size: 0.82rem;
}
.gcp-chip {
  border: 1px solid rgba(255,255,255,0.14); border-radius: 999px;
  padding: 0.2rem 0.65rem; cursor: pointer; font: 500 0.8rem/1.4 inherit;
  color: #0c130c; background: #57b877;
}
.gcp-chip.tier-awake { background: #d9a53f; color: #1c1507; }
.gcp-chip:hover { filter: brightness(1.12); }
.gcp-strip-wrap { position: relative; user-select: none; }
.gcp-strip {
  display: flex; height: 34px; border-radius: 5px; overflow: hidden;
  border: 1px solid rgba(255,255,255,0.12); cursor: ew-resize;
  touch-action: none;
}
.gcp-strip:focus-visible { outline: 2px solid #ff7a3d; outline-offset: 2px; }
.gcp-cell { flex: 1; background: #2a3442; }
.gcp-cell.tier-work { background: #2f9e5f; }
.gcp-cell.tier-awake { background: #c8963a; }
.gcp-cell.tier-asleep { background: #703a3a; }
.gcp-cell + .gcp-cell { border-left: 1px solid rgba(0,0,0,0.18); }
.gcp-nowmark, .gcp-cursor {
  position: absolute; top: -3px; bottom: -3px; width: 2px;
  pointer-events: none;
}
.gcp-nowmark { background: rgba(255,255,255,0.75); }
.gcp-cursor { background: #ff7a3d; box-shadow: 0 0 6px rgba(255,122,61,0.8); display: none; }
.gcp-root.is-previewing .gcp-cursor { display: block; }
.gcp-ticks { position: relative; height: 1.15rem; margin-top: 0.15rem;
  color: #6b7686; font-size: 0.7rem; }
.gcp-tick { position: absolute; transform: translateX(-50%); white-space: nowrap; }
.gcp-tick:first-child { transform: none; }
.gcp-controls {
  display: flex; align-items: center; gap: 1.2rem; flex-wrap: wrap;
  margin-top: 0.55rem; color: #8893a4; font-size: 0.82rem;
}
.gcp-controls .gcp-ctl { display: inline-flex; align-items: center; gap: 0.4rem; }
.gcp-controls input {
  background: #1a222e; border: 1px solid rgba(255,255,255,0.12);
  color: #e6e9ef; border-radius: 5px; padding: 0.25rem 0.4rem;
  font: inherit; color-scheme: dark;
}
.gcp-parts {
  display: flex; gap: 0.35rem 1.1rem; flex-wrap: wrap; margin-top: 0.55rem;
}
.gcp-part { display: inline-flex; align-items: center; gap: 0.4rem;
  font-size: 0.84rem; }
.gcp-part input { accent-color: #ff7a3d; }
.gcp-part .gcp-tz { color: #6b7686; font-size: 0.75rem; }
.gcp-part.is-disabled { opacity: 0.55; }
.gcp-legend { color: #6b7686; font-size: 0.72rem; margin-top: 0.5rem; }
.gcp-legend i {
  display: inline-block; width: 9px; height: 9px; border-radius: 2px;
  margin: 0 0.25rem 0 0.7rem; vertical-align: baseline;
}
.gcp-legend i:first-child { margin-left: 0; }
`;

function injectStyles() {
  if (document.getElementById('gcp-styles')) return;
  const s = document.createElement('style');
  s.id = 'gcp-styles';
  s.textContent = PLANNER_CSS;
  document.head.appendChild(s);
}

// Same tiny DOM helper as geoclock-webconfig.js (duplicated on
// purpose — the two UI modules don't import each other).
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function')
      n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null) n.append(kid);
  return n;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || s === null) return null;
    return {
      open: s.open === true,
      workStart: typeof s.workStart === 'string' ? s.workStart : '09:00',
      workEnd: typeof s.workEnd === 'string' ? s.workEnd : '17:00',
      excluded: Array.isArray(s.excluded)
        ? s.excluded.filter((x) => typeof x === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

/** "HH:MM" → fractional hours; null when unparsable. */
function parseHhMm(v) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v || '');
  if (!m) return null;
  const h = Number(m[1]) + Number(m[2]) / 60;
  return h >= 0 && h < 24 ? h : null;
}

/** Date → value for <input type="datetime-local"> in the viewer's
 *  zone (the input's own semantics). */
function toLocalInputValue(d) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}`
  );
}

export function initPlanner(card, { webApi, bundle, mount }) {
  injectStyles();

  const youTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const stored = loadState();
  let open = stored ? stored.open : false;
  let workStart = stored ? stored.workStart : '09:00';
  let workEnd = stored ? stored.workEnd : '17:00';
  const excluded = new Set(stored ? stored.excluded : []);

  // Strip anchor: "now" floored to the half hour, re-floored by a
  // minute timer so the window slides forward as time passes. When
  // the user probes a date outside the window the anchor pins to
  // that day ('manual') until they return to LIVE.
  let anchor = floorToStep(new Date());
  let anchorMode = 'now'; // 'now' | 'manual'
  // The scorable participants behind the current cells, index-aligned
  // with each InstantScore's participants array (for tooltips).
  let scorable = [];
  let cells = [];

  function floorToStep(d) {
    const ms = STEP_MIN * 60_000;
    return new Date(Math.floor(d.getTime() / ms) * ms);
  }

  function persist() {
    try {
      if (webApi.isRemembered()) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            open,
            workStart,
            workEnd,
            excluded: [...excluded],
          }),
        );
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* storage unavailable (private mode etc.) — planner still works */
    }
  }

  // Viewer-local formatters. Weekday matters: the strip spans two
  // midnights and chips/labels must disambiguate "8:00 today" from
  // "8:00 tomorrow".
  const fmtDayTime = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  const fmtTime = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const fmtZone = (tzid) => tzid.split('/').pop().replace(/_/g, ' ');

  // ---- participants ---------------------------------------------

  /** One row per possible participant. `key` identifies it in the
   *  excluded set; `tzid` null means it can't score (yet). A "my
   *  location" auto marker IS the viewer, so its presence replaces
   *  the synthetic "You" row — otherwise the viewer shows up twice. */
  function participants() {
    const autoLabels = new Set(
      webApi.getMarkers().filter((m) => m.auto).map((m) => m.label),
    );
    const resolved = card.resolvedMarkers;
    // Only a RESOLVED auto marker replaces "You" — before the geo fix
    // arrives (or when it's denied) the marker isn't on the card, and
    // the viewer must not vanish from the meeting.
    const hasAuto = resolved.some((m) => autoLabels.has(m.label));
    const rows = hasAuto
      ? []
      : [{ key: YOU_KEY, label: 'You', tzid: youTz }];
    for (const m of resolved) {
      rows.push({ key: m.label, label: m.label, tzid: m.tzid });
    }
    return rows;
  }

  // ---- DOM skeleton ---------------------------------------------

  const caret = el('span', { class: 'gcp-caret', text: '▾' });
  const toggleBtn = el(
    'button',
    { class: 'gcp-toggle', type: 'button', 'aria-expanded': 'false' },
    caret,
    'Plan a meeting',
  );
  const liveBtn = el('button', {
    class: 'gcp-live',
    type: 'button',
    text: 'LIVE',
    title: 'Return to the current time',
  });
  const previewLabel = el('span', { class: 'gcp-preview-label' });
  const chipsRow = el('div', { class: 'gcp-chips' });
  const strip = el('div', {
    class: 'gcp-strip',
    tabindex: '0',
    role: 'slider',
    'aria-label': 'Preview time (next 48 hours)',
  });
  const nowMark = el('div', { class: 'gcp-nowmark' });
  const cursor = el('div', { class: 'gcp-cursor' });
  const stripWrap = el('div', { class: 'gcp-strip-wrap' }, strip, nowMark, cursor);
  const ticksRow = el('div', { class: 'gcp-ticks' });

  const workStartIn = el('input', { type: 'time', value: workStart });
  const workEndIn = el('input', { type: 'time', value: workEnd });
  const probeIn = el('input', { type: 'datetime-local' });
  const controls = el(
    'div',
    { class: 'gcp-controls' },
    el('span', { class: 'gcp-ctl' }, 'Work hours', workStartIn, '–', workEndIn),
    el('span', { class: 'gcp-ctl' }, 'Preview a time', probeIn),
  );
  const partsRow = el('div', { class: 'gcp-parts' });
  const legend = el(
    'div',
    { class: 'gcp-legend' },
    el('i', { style: 'background:#2f9e5f' }),
    ' everyone in work hours ',
    el('i', { style: 'background:#c8963a' }),
    ' everyone awake ',
    el('i', { style: 'background:#703a3a' }),
    ' someone asleep',
  );

  const body = el(
    'div',
    { class: 'gcp-body' },
    chipsRow,
    stripWrap,
    ticksRow,
    controls,
    partsRow,
    legend,
  );
  body.hidden = !open;

  const root = el(
    'div',
    { class: 'gcp-root' },
    el(
      'div',
      { class: 'gcp-inner' },
      el('div', { class: 'gcp-bar' }, toggleBtn, liveBtn, previewLabel),
      body,
    ),
  );
  mount.appendChild(root);

  // ---- preview control ------------------------------------------

  function setPreview(date) {
    card.previewNow = date;
    root.classList.toggle('is-previewing', date !== null);
    if (date) {
      previewLabel.textContent = `Previewing ${fmtDayTime.format(date)} (your time)`;
      // Mirror into the probe field unless the user is typing in it.
      if (document.activeElement !== probeIn)
        probeIn.value = toLocalInputValue(date);
      const frac =
        (date.getTime() - anchor.getTime()) / (STEPS * STEP_MIN * 60_000);
      cursor.style.display = frac >= 0 && frac <= 1 ? '' : 'none';
      cursor.style.left = `${(Math.min(1, Math.max(0, frac)) * 100).toFixed(3)}%`;
      strip.setAttribute('aria-valuetext', fmtDayTime.format(date));
    } else {
      probeIn.value = '';
    }
  }

  toggleBtn.addEventListener('click', () => {
    open = !open;
    body.hidden = !open;
    caret.textContent = open ? '▴' : '▾';
    toggleBtn.setAttribute('aria-expanded', String(open));
    if (open) recompute();
    persist();
  });
  const goLive = () => {
    setPreview(null);
    if (anchorMode !== 'now') {
      anchorMode = 'now';
      recompute(); // snap the strip window back to the present
    }
  };
  liveBtn.addEventListener('click', goLive);

  // Scrub: pointer capture on the strip; rAF-coalesced so a fast drag
  // costs one card render per frame, not one per pointermove.
  let scrubRaf = 0;
  let scrubPending = null;
  const instantAtX = (clientX) => {
    const r = strip.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    // Snap to the step grid — cells are discrete scores, and a
    // half-hour grid matches how meetings actually get scheduled.
    const steps = Math.round(frac * STEPS);
    return new Date(anchor.getTime() + steps * STEP_MIN * 60_000);
  };
  const flushScrub = () => {
    scrubRaf = 0;
    if (scrubPending) setPreview(scrubPending);
    scrubPending = null;
  };
  strip.addEventListener('pointerdown', (e) => {
    setPreview(instantAtX(e.clientX));
    strip.focus();
    try {
      strip.setPointerCapture(e.pointerId);
    } catch {
      /* capture unavailable (synthetic/stale pointer) — tap still worked */
    }
    e.preventDefault();
  });
  strip.addEventListener('pointermove', (e) => {
    if (!strip.hasPointerCapture(e.pointerId)) return;
    scrubPending = instantAtX(e.clientX);
    if (!scrubRaf) scrubRaf = requestAnimationFrame(flushScrub);
  });
  strip.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      goLive();
      return;
    }
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const base = card.previewNow ?? anchor;
    setPreview(new Date(base.getTime() + dir * STEP_MIN * 60_000));
  });

  probeIn.addEventListener('change', () => {
    // datetime-local parses in the viewer's zone — exactly the
    // "specify a local time" semantics.
    const d = probeIn.value ? new Date(probeIn.value) : null;
    if (!d || isNaN(d.getTime())) {
      goLive();
      return;
    }
    // A probe outside the strip's window re-anchors the strip to the
    // start of that (viewer-local) day, so the heat map and chips
    // describe the day being planned, not just the next 48 h.
    const end = anchor.getTime() + STEPS * STEP_MIN * 60_000;
    if (d.getTime() < anchor.getTime() || d.getTime() >= end) {
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      anchor = dayStart;
      anchorMode = 'manual';
      recompute();
    }
    setPreview(d);
  });

  const onHours = () => {
    workStart = workStartIn.value || '09:00';
    workEnd = workEndIn.value || '17:00';
    persist();
    recompute();
  };
  workStartIn.addEventListener('change', onHours);
  workEndIn.addEventListener('change', onHours);

  // ---- scoring + paint ------------------------------------------

  function tierHours() {
    // Malformed input → defaults. start >= end is passed through:
    // the scorer treats it as a midnight-wrapping range, which is
    // the least-surprising reading of e.g. 22:00–06:00.
    return {
      workStart: parseHhMm(workStart) ?? 9,
      workEnd: parseHhMm(workEnd) ?? 17,
      awakeStart: AWAKE_START,
      awakeEnd: AWAKE_END,
    };
  }

  function recompute() {
    if (!open) return;
    // A manual (probed-date) anchor stays pinned across participant
    // and hours edits; only 'now' mode tracks the clock.
    if (anchorMode === 'now') anchor = floorToStep(new Date());
    const parts = participants();
    renderParticipants(parts);
    scorable = parts.filter((p) => p.tzid && !excluded.has(p.key));
    const tzids = scorable.map((p) => p.tzid);

    cells = bundle.scoreRange(anchor, STEP_MIN, STEPS, tzids, tierHours());
    paintStrip(tzids.length > 0);
    paintTicks();
    paintChips(tzids.length > 0);
    positionNowMark();
    // The anchor may have moved — refresh the cursor position too.
    if (card.previewNow) setPreview(card.previewNow);
  }

  function paintStrip(scored) {
    strip.replaceChildren();
    cells.forEach((c, i) => {
      const at = new Date(anchor.getTime() + i * STEP_MIN * 60_000);
      const lines = [fmtDayTime.format(at)];
      c.participants.forEach((p, j) => {
        const hh = String(Math.floor(p.localMinutes / 60)).padStart(2, '0');
        const mm = String(p.localMinutes % 60).padStart(2, '0');
        lines.push(`${scorable[j].label}: ${hh}:${mm} (${p.tier})`);
      });
      strip.appendChild(
        el('div', {
          class: scored ? `gcp-cell tier-${c.tier}` : 'gcp-cell',
          title: lines.join('\n'),
        }),
      );
    });
  }

  function paintTicks() {
    ticksRow.replaceChildren();
    // A label every 6 hours across the 48 h window.
    for (let i = 0; i <= STEPS; i += 12) {
      const at = new Date(anchor.getTime() + i * STEP_MIN * 60_000);
      ticksRow.appendChild(
        el('span', {
          class: 'gcp-tick',
          style: `left: ${((i / STEPS) * 100).toFixed(2)}%`,
          text: fmtDayTime.format(at),
        }),
      );
    }
  }

  function paintChips(scored) {
    chipsRow.replaceChildren();
    if (!scored) {
      chipsRow.append(
        'Scrub to preview any time. Add markers in Customize to find meeting times across locations.',
      );
      return;
    }
    const wins = bundle.bestWindows(cells, anchor, STEP_MIN, {
      minMinutes: 60,
      max: 3,
    });
    if (!wins.length) {
      chipsRow.append(
        'No hour-long window where everyone is awake in the next 48 h.',
      );
      return;
    }
    chipsRow.append(wins[0].tier === 'work' ? 'Best:' : 'Least bad (nobody asleep):');
    for (const w of wins) {
      chipsRow.appendChild(
        el('button', {
          class: `gcp-chip tier-${w.tier}`,
          type: 'button',
          text: `${fmtDayTime.format(w.start)} – ${fmtTime.format(w.end)}`,
          title: 'Preview this window on the map (your local time)',
          onclick: () => setPreview(w.start),
        }),
      );
    }
  }

  function renderParticipants(parts) {
    partsRow.replaceChildren();
    for (const p of parts) {
      const cb = el('input', { type: 'checkbox' });
      cb.checked = !excluded.has(p.key) && p.tzid !== null;
      cb.disabled = p.tzid === null;
      cb.addEventListener('change', () => {
        if (cb.checked) excluded.delete(p.key);
        else excluded.add(p.key);
        persist();
        recompute();
      });
      // Resolved rows show just the label (the tooltip carries the
      // zone); only an unresolvable row needs an explanation.
      const status = p.tzid
        ? null
        : card.tzReady
          ? 'no time zone (ocean) — excluded'
          : 'resolving time zone…';
      partsRow.appendChild(
        el(
          'label',
          {
            class: `gcp-part${p.tzid ? '' : ' is-disabled'}`,
            title: p.tzid ? fmtZone(p.tzid) : null,
          },
          cb,
          p.label,
          status ? el('span', { class: 'gcp-tz', text: status }) : null,
        ),
      );
    }
  }

  function positionNowMark() {
    const frac =
      (Date.now() - anchor.getTime()) / (STEPS * STEP_MIN * 60_000);
    // "Now" can be outside a manually-anchored (probed-date) window;
    // a clamped mark at the edge would be a lie, so hide it.
    const visible = frac >= 0 && frac <= 1;
    nowMark.style.display = visible ? '' : 'none';
    if (visible) nowMark.style.left = `${(frac * 100).toFixed(3)}%`;
  }

  // ---- change sources -------------------------------------------

  // Marker add/remove/rename, geolocation fixes, Remember toggles.
  webApi.subscribe(() => {
    persist(); // applies (or clears, on opt-out) the planner key
    recompute();
  });
  // Marker tzids are provisional (null) until the IANA dataset lands.
  card.addEventListener('geoclock-tz-ready', () => recompute());
  // Keep the "now" mark honest and slide the window forward when the
  // anchor's half-hour passes. Cheap no-op tick otherwise. A manual
  // (probed-date) anchor never slides — the user pinned it.
  setInterval(() => {
    if (!open) return;
    if (
      anchorMode === 'now' &&
      floorToStep(new Date()).getTime() !== anchor.getTime()
    ) {
      recompute();
    } else {
      positionNowMark();
    }
  }, 60_000);

  if (open) recompute();
}
