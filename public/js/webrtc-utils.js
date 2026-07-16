(function () {
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function getIceConfig() {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10
    };
  }

  function waitForIceGatheringComplete(pc, timeoutMs = 10000) {
    if (!pc || pc.iceGatheringState === 'complete') {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      };
      const onChange = () => {
        if (pc.iceGatheringState === 'complete') done();
      };
      const timer = setTimeout(done, timeoutMs);
      pc.addEventListener('icegatheringstatechange', onChange);
    });
  }

  async function addCandidateSafe(pc, candidate) {
    if (!pc || !candidate || pc.signalingState === 'closed') return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) { /* stale or duplicate */ }
  }

  function createIceQueue() {
    const pending = [];
    let ready = false;

    return {
      markReady() {
        ready = true;
      },
      clear() {
        pending.length = 0;
        ready = false;
      },
      async add(pc, candidate) {
        if (!candidate) return;
        if (!ready || !pc?.remoteDescription) {
          pending.push(candidate);
          return;
        }
        await addCandidateSafe(pc, candidate);
      },
      async flush(pc) {
        ready = true;
        while (pending.length) {
          await addCandidateSafe(pc, pending.shift());
        }
      }
    };
  }

  function preferH264(pc) {
    if (!pc || typeof RTCRtpReceiver === 'undefined' || !RTCRtpReceiver.getCapabilities) return;
    try {
      const caps = RTCRtpReceiver.getCapabilities('video');
      if (!caps?.codecs?.length) return;

      const h264 = caps.codecs.filter((c) => c.mimeType.toLowerCase() === 'video/h264');
      if (!h264.length) return;

      const rest = caps.codecs.filter((c) => c.mimeType.toLowerCase() !== 'video/h264');
      const preferred = [...h264, ...rest];

      pc.getTransceivers().forEach((transceiver) => {
        if (transceiver.sender?.track?.kind === 'audio' || transceiver.receiver?.track?.kind === 'audio') {
          return;
        }
        try {
          transceiver.setCodecPreferences(preferred);
        } catch (e) { /* browser may reject */ }
      });
    } catch (e) { /* unsupported */ }
  }

  function attachVideoStream(videoEl, stream, onLive) {
    if (!videoEl || !stream) return;

    const markLiveIfReady = () => {
      if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
        onLive?.();
        return true;
      }
      return false;
    };

    videoEl.srcObject = stream;
    videoEl.play().catch(() => {});

    if (markLiveIfReady()) return;

    videoEl.onloadeddata = () => markLiveIfReady();
    videoEl.onresize = () => markLiveIfReady();

    stream.getVideoTracks().forEach((track) => {
      track.onunmute = () => {
        videoEl.srcObject = stream;
        videoEl.play().catch(() => {});
        setTimeout(markLiveIfReady, 50);
      };
    });

    let attempts = 0;
    const poll = setInterval(() => {
      if (markLiveIfReady() || ++attempts >= 40) {
        clearInterval(poll);
      }
    }, 200);
  }

  async function waitForVideoFrames(videoEl, timeoutMs = 10000) {
    if (!videoEl) return false;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) return true;
      await videoEl.play?.().catch(() => {});
      await new Promise((r) => setTimeout(r, 200));
    }
    return videoEl.videoWidth > 0 && videoEl.videoHeight > 0;
  }

  window.WebRTCUtils = {
    isIOS,
    getIceConfig,
    waitForIceGatheringComplete,
    createIceQueue,
    preferH264,
    attachVideoStream,
    addCandidateSafe,
    waitForVideoFrames
  };
})();
