import { loadCardBundle } from './shared/geoclock-config.js';
import { initWebConfig } from './shared/geoclock-webconfig.js';
import { initPlanner } from './shared/geoclock-planner.js';

try {
  const bundle = await loadCardBundle('../assets');
  const card = document.createElement('geo-clock-card');
  document.getElementById('stage').appendChild(card);
  const webApi = initWebConfig(card, { offline: true, rememberByDefault: true });
  initPlanner(card, { webApi, bundle, mount: document.getElementById('planner') });
  const stage = document.getElementById('stage');
  const exitButton = document.getElementById('fs-exit-btn');
  let exitTimer;
  const revealExit = () => {
    if (document.fullscreenElement !== stage) return;
    clearTimeout(exitTimer);
    exitButton.classList.add('is-visible');
    exitTimer = setTimeout(() => exitButton.classList.remove('is-visible'), 5000);
  };
  const syncFullscreen = () => {
    const frame = card.shadowRoot?.querySelector('.frame');
    if (!frame) return;
    const active = !!document.fullscreenElement;
    // Size the host explicitly: an auto-width custom element can collapse to
    // zero while its aspect-ratio frame overflows, clipping the SVG in ha-card.
    const ratio = Number.parseFloat(getComputedStyle(frame).getPropertyValue('--geo-frame-ar'));
    card.style.width = active && Number.isFinite(ratio)
      ? `${Math.min(stage.clientWidth, stage.clientHeight * ratio)}px` : '';
  };
  document.getElementById('fs-btn').addEventListener('click', () => {
    const result = document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen();
    result?.catch(() => {});
  });
  exitButton.addEventListener('click', () => document.exitFullscreen().catch(() => {}));
  for (const event of ['pointermove', 'pointerdown', 'wheel', 'focusin']) {
    stage.addEventListener(event, revealExit, { passive: true });
  }
  document.addEventListener('keydown', revealExit);
  document.addEventListener('fullscreenchange', () => {
    clearTimeout(exitTimer);
    exitButton.classList.remove('is-visible');
    exitButton.hidden = document.fullscreenElement !== stage;
    syncFullscreen();
    revealExit();
  });
  window.addEventListener('resize', syncFullscreen);
  webApi.subscribe(() => requestAnimationFrame(syncFullscreen));
} catch {
  document.getElementById('stage-error').hidden = false;
}
