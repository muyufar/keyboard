/**
 * Usaha menjaga aplikasi & kamera tetap aktif saat layar terkunci / background.
 * Catatan: browser mobile membatasi eksekusi background; PWA + audio senyap + wake lock
 * memperpanjang waktu aktif, terutama di Android.
 */
(function () {
  const SILENT_AUDIO =
    'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/tQCmAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7kGQAD/AAABpAAAACAAADSAAAAEAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

  class BackgroundKeepAlive {
    constructor() {
      this.active = false;
      this.wakeLock = null;
      this.audioEl = null;
      this.audioCtx = null;
      this.oscillator = null;
      this.heartbeatTimer = null;
      this.onHeartbeat = null;
      this.onVisible = null;
      this._onVisibility = this.handleVisibility.bind(this);
      this._onPageShow = this.handlePageShow.bind(this);
    }

    async start() {
      if (this.active) return;
      this.active = true;

      await this.acquireWakeLock();
      this.startSilentAudio();
      this.setupMediaSession();
      this.startHeartbeat();

      document.addEventListener('visibilitychange', this._onVisibility);
      window.addEventListener('pageshow', this._onPageShow);
    }

    stop() {
      this.active = false;
      this.stopHeartbeat();

      document.removeEventListener('visibilitychange', this._onVisibility);
      window.removeEventListener('pageshow', this._onPageShow);

      if (this.wakeLock) {
        this.wakeLock.release().catch(() => {});
        this.wakeLock = null;
      }

      if (this.audioEl) {
        this.audioEl.pause();
        this.audioEl.src = '';
        this.audioEl = null;
      }

      if (this.oscillator) {
        try { this.oscillator.stop(); } catch (e) { /* ignore */ }
        this.oscillator = null;
      }
      if (this.audioCtx) {
        this.audioCtx.close().catch(() => {});
        this.audioCtx = null;
      }

      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
    }

    async acquireWakeLock() {
      if (!this.active || !('wakeLock' in navigator)) return;
      try {
        if (this.wakeLock) return;
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
          if (this.active) this.acquireWakeLock();
        });
      } catch (e) {
        /* Izin ditolak atau tidak didukung */
      }
    }

    startSilentAudio() {
      if (!this.audioEl) {
        this.audioEl = new Audio(SILENT_AUDIO);
        this.audioEl.loop = true;
        this.audioEl.volume = 0.01;
        this.audioEl.setAttribute('playsinline', '');
        this.audioEl.setAttribute('webkit-playsinline', 'true');
      }
      this.audioEl.play().catch(() => {});

      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        if (!this.audioCtx) {
          this.audioCtx = new AudioContext();
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        if (!this.oscillator) {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          gain.gain.value = 0.00001;
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start();
          this.oscillator = osc;
        }
      } catch (e) { /* ignore */ }
    }

    setupMediaSession() {
      if (!('mediaSession' in navigator)) return;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Pemesanan Buku',
          artist: 'Sesi aktif',
          album: 'Monitoring'
        });
        navigator.mediaSession.playbackState = 'playing';
      } catch (e) { /* ignore */ }
    }

    startHeartbeat() {
      this.stopHeartbeat();
      this.heartbeatTimer = setInterval(() => {
        if (!this.active) return;

        if (this.audioEl?.paused) this.audioEl.play().catch(() => {});
        if (this.audioCtx?.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        if (!this.wakeLock) this.acquireWakeLock();

        if (typeof this.onHeartbeat === 'function') {
          this.onHeartbeat();
        }

        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'keepalive', ts: Date.now() });
        }
      }, 12000);
    }

    stopHeartbeat() {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
    }

    handleVisibility() {
      if (!this.active) return;
      if (document.hidden) {
        this.startSilentAudio();
        this.acquireWakeLock();
        if (typeof window.onBackgroundMode === 'function') {
          window.onBackgroundMode(true);
        }
      } else {
        this.acquireWakeLock();
        this.startSilentAudio();
        if (typeof window.onBackgroundMode === 'function') {
          window.onBackgroundMode(false);
        }
        if (typeof this.onVisible === 'function') {
          this.onVisible();
        }
      }
    }

    handlePageShow() {
      if (!this.active) return;
      this.startSilentAudio();
      this.acquireWakeLock();
      if (typeof this.onVisible === 'function') {
        this.onVisible();
      }
    }
  }

  window.BackgroundKeepAlive = BackgroundKeepAlive;
})();
