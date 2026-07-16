(function () {
  const base = typeof BASE !== 'undefined' ? BASE : '';
  const manifestUrl = base + (base ? '/manifest.php' : '/manifest.json');
  const swUrl = base + (base ? '/sw.js' : '/sw.js');
  const scope = (base || '') + '/';

  const DISMISS_KEY = 'pwa_install_dismissed';
  const DISMISS_DAYS = 7;

  let deferredPrompt = null;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  function isDismissed() {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = parseInt(raw, 10);
    if (Number.isNaN(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  }

  function dismissBanner() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    hideBanner();
  }

  function hideBanner() {
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'none';
  }

  function showBanner(text, showInstallBtn) {
    if (isStandalone || isDismissed()) return;

    const banner = document.getElementById('installBanner');
    const textEl = document.getElementById('installBannerText');
    const btn = document.getElementById('installBannerBtn');
    if (!banner || !textEl) return;

    textEl.textContent = text;
    if (btn) btn.style.display = showInstallBtn ? 'inline-flex' : 'none';
    banner.style.display = 'block';
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register(swUrl, { scope });
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'skipWaiting' });
      }
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'skipWaiting' });
          }
        });
      });
    } catch (err) {
      console.warn('Service worker gagal didaftarkan:', err);
    }
  }

  async function promptInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === 'accepted') hideBanner();
  }

  function setupInstallUI() {
    const closeBtn = document.getElementById('installBannerClose');
    const installBtn = document.getElementById('installBannerBtn');
    const headerBtn = document.getElementById('installAppBtn');
    const loginBtn = document.getElementById('installAppBtnLogin');

    function handleInstallClick() {
      if (deferredPrompt) {
        promptInstall();
      } else if (isIOS) {
        showBanner(
          'Di iPhone/iPad: tap ikon Bagikan (↑) di Safari, lalu pilih "Add to Home Screen" / "Tambahkan ke Layar Utama".',
          false
        );
      } else if (isAndroid) {
        showBanner(
          'Buka menu browser (⋮) lalu pilih "Install app" / "Tambahkan ke Layar Utama".',
          false
        );
      }
    }

    if (closeBtn) closeBtn.addEventListener('click', dismissBanner);
    if (installBtn) installBtn.addEventListener('click', promptInstall);
    if (headerBtn) headerBtn.addEventListener('click', handleInstallClick);
    if (loginBtn) loginBtn.addEventListener('click', handleInstallClick);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showBanner('Instal aplikasi Pemesanan Buku ke layar utama untuk akses lebih cepat.', true);
      if (headerBtn) headerBtn.style.display = 'inline-flex';
      if (loginBtn) loginBtn.style.display = 'inline-flex';
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      hideBanner();
      if (headerBtn) headerBtn.style.display = 'none';
      if (loginBtn) loginBtn.style.display = 'none';
    });

    if (isStandalone) {
      if (headerBtn) headerBtn.style.display = 'none';
      if (loginBtn) loginBtn.style.display = 'none';
      return;
    }

    if (isIOS && !isDismissed()) {
      const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
      if (isSafari) {
        showBanner(
          'Tambahkan ke Layar Utama: tap ikon Bagikan (↑), lalu pilih "Add to Home Screen" / "Tambahkan ke Layar Utama".',
          false
        );
        if (headerBtn) headerBtn.style.display = 'inline-flex';
        if (loginBtn) loginBtn.style.display = 'inline-flex';
      }
    } else if (isAndroid && !deferredPrompt && !isDismissed()) {
      setTimeout(() => {
        if (!deferredPrompt && !isStandalone) {
          showBanner(
            'Instal aplikasi: buka menu browser (⋮) lalu pilih "Install app" / "Tambahkan ke Layar Utama".',
            false
          );
        }
      }, 3000);
    }
  }

  registerServiceWorker();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupInstallUI);
  } else {
    setupInstallUI();
  }
})();
