// GeoClock new-tab bootstrap. Loaded as an ES module from newtab.html
// (MV3 bans inline scripts). Reuses the same headless mount helpers and
// Customize panel as the geoclock.world demo — the only differences are
// (a) assets resolve locally over chrome-extension:// and (b) the panel
// remembers settings by default since this is the user's own browser.
import { loadCardBundle } from './geoclock-config.js';
import { initWebConfig } from './geoclock-webconfig.js';

// '.' → load the card bundle (and, via import.meta.url, the imagery +
// GeoJSON) from this extension's own directory. Nothing is fetched off
// the network; the whole thing works offline.
const ASSET_BASE = '.';

async function main() {
  try {
    await loadCardBundle(ASSET_BASE);
  } catch (err) {
    console.error('geoclock-newtab: failed to load card bundle', err);
    document.getElementById('stage-error')?.classList.add('is-visible');
    return;
  }

  const card = document.createElement('geo-clock-card');
  document.body.appendChild(card);

  // Mounts the slide-out Customize panel, applies the stored/default
  // config, and wires geolocation + persistence. rememberByDefault keeps
  // the user's center/markers/locale across new tabs without a checkbox.
  initWebConfig(card, { rememberByDefault: true });

  keepAspectRatioInSync(card);
}

// The CSS letterbox keys off --geo-frame-ar (the map's width/height
// ratio). The card publishes that var on its shadow .frame, but page CSS
// targeting the host can't read a shadow-scoped var — so mirror it onto
// <html>. Re-mirror whenever the frame's style changes (the hour-band
// toggle changes the ratio), since a stale ratio would letterbox to the
// wrong box and the SVG would crop or the markers would drift.
function keepAspectRatioInSync(card) {
  const mirror = (frame) => {
    const ar = getComputedStyle(frame).getPropertyValue('--geo-frame-ar').trim();
    if (ar) document.documentElement.style.setProperty('--geo-frame-ar', ar);
  };
  const waitForFrame = () => {
    const frame = card.shadowRoot?.querySelector('.frame');
    if (!frame) {
      requestAnimationFrame(waitForFrame);
      return;
    }
    mirror(frame);
    new MutationObserver(() => mirror(frame)).observe(frame, {
      attributes: true,
      attributeFilter: ['style'],
    });
  };
  waitForFrame();
}

main();
