// geoclock-pwa.js — PWA plumbing for the geoclock.world demo page:
// service-worker registration, the header "Install app" button, the
// offline badge, and the imagery backfill trigger.
//
// Layering: imported ONLY by index.html. Never load this from
// wallpaper.html (it would put a SW-controlling script inside the
// macOS screenshot pipeline), and it is not copied by the Chrome
// extension's build.sh or the macOS app's sync-web-assets.sh (both
// copy named files only). Self-initializes on import — unlike
// initWebConfig/initPlanner it needs nothing from the host page.

const PWA_CSS = `
#pwa-install {
  display: none;
  /* <button> doesn't inherit font metrics the way the .cta-btn
     anchors do — spell them out so the pill matches its siblings. */
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  line-height: 1.5;
  cursor: pointer;
}
#pwa-install.is-available { display: inline-flex; }
/* The .ctas cluster is display:none at phone widths, but install
   matters most there — this button is a direct child of <header>
   (not inside .ctas) and right-aligns itself when it's the only
   CTA left. */
@media (max-width: 640px) {
  #pwa-install.is-available { margin-left: auto; }
}
.pwa-offline {
  display: none;
  align-items: center; gap: 0.35rem;
  margin-top: 0.15rem;
  color: #9aa3b0; font-size: 0.75rem;
}
.pwa-offline::before {
  content: ''; width: 7px; height: 7px; border-radius: 50%;
  background: #d9a53f;
}
body.is-offline .pwa-offline { display: inline-flex; }
`;

function injectStyles() {
  if (document.getElementById('pwa-styles')) return;
  const s = document.createElement('style');
  s.id = 'pwa-styles';
  s.textContent = PWA_CSS;
  document.head.appendChild(s);
}

// Same tiny DOM helper as the other UI modules (duplicated on
// purpose — page modules don't import each other).
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

injectStyles();

// --- Service worker + imagery backfill ---------------------------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.warn('geoclock: SW registration failed', err));

    // Once a worker is active (first visit included — `ready` doesn't
    // need the page to be controlled), ask it to fill in the rest of
    // the monthly imagery when the page goes idle. Re-triggering on
    // every load is how an interrupted fill resumes.
    navigator.serviceWorker.ready.then((reg) => {
      const kick = () => reg.active?.postMessage({ type: 'backfill' });
      if ('requestIdleCallback' in window) {
        requestIdleCallback(kick, { timeout: 15000 });
      } else {
        setTimeout(kick, 5000);
      }
    });
  });
}

// --- Install button ----------------------------------------------

const standalone = matchMedia('(display-mode: standalone)');
let deferredPrompt = null;

const installBtn = el('button', {
  class: 'cta-btn',
  id: 'pwa-install',
  type: 'button',
  text: 'Install app',
  onclick: async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    installBtn.classList.remove('is-available');
  },
});
// Direct child of <header>, AFTER .ctas — so the phone-width
// `.ctas { display:none }` rule can't take it down too.
document.querySelector('header')?.appendChild(installBtn);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // no mini-infobar; we offer our own button
  deferredPrompt = e;
  if (!standalone.matches) installBtn.classList.add('is-available');
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  installBtn.classList.remove('is-available');
});
standalone.addEventListener?.('change', (e) => {
  if (e.matches) installBtn.classList.remove('is-available');
});
// iOS Safari never fires beforeinstallprompt — the button simply
// stays hidden; Share → Add to Home Screen works via the manifest
// and apple-touch-icon.

// --- Offline badge -----------------------------------------------

const badge = el('span', { class: 'pwa-offline', text: 'offline' });
document.querySelector('header .wordmark')?.appendChild(badge);

const syncOnline = () => {
  document.body.classList.toggle('is-offline', navigator.onLine === false);
};
window.addEventListener('online', syncOnline);
window.addEventListener('offline', syncOnline);
syncOnline();
