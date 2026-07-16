(function () {
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function getIceConfig() {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 4
    };
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
    videoEl.srcObject = stream;
    videoEl.play().catch(() => {});

    const tracks = stream.getVideoTracks();
    tracks.forEach((track) => {
      if (track.muted) {
        track.onunmute = () => {
          videoEl.srcObject = stream;
          videoEl.play().catch(() => {});
          onLive?.();
        };
      }
    });

    onLive?.();
  }

  window.WebRTCUtils = {
    isIOS,
    getIceConfig,
    createIceQueue,
    preferH264,
    attachVideoStream,
    addCandidateSafe
  };
})();
