class VideoCallManager {
  constructor({ currentUser, sendSignal }) {
    this.currentUser = currentUser;
    this.sendSignal = sendSignal;
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

    this.iceConfig = {
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
      statusText: document.getElementById('callStatusText')
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
      if (typeof window.onVideoCallStart === 'function') window.onVideoCallStart();

      await this.getMedia();
      this.showActiveCall('Memanggil ' + user.display_name + '...');

      await this.sendSignal(user.id, 'call-request', {
        from_name: this.currentUser.display_name,
        from_color: this.currentUser.avatar_color
      });
    } catch (err) {
      alert('Tidak bisa memulai panggilan: ' + err.message);
      this.cleanup();
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
          this.cleanup();
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
        if (this.peerId === from) this.cleanup();
        break;
    }
  }

  showIncoming() {
    this.els.incomingAvatar.textContent = this.peerName.charAt(0).toUpperCase();
    this.els.incomingAvatar.style.background = this.peerColor;
    this.els.incomingName.textContent = this.peerName + ' memanggil...';
    this.els.incoming.style.display = 'flex';
  }

  async acceptCall() {
    try {
      this.inCall = true;
      if (typeof window.onVideoCallStart === 'function') window.onVideoCallStart();
      this.els.incoming.style.display = 'none';
      await this.getMedia();
      this.showActiveCall('Menghubungkan...');
      await this.sendSignal(this.peerId, 'call-accept', {});
    } catch (err) {
      alert('Tidak bisa menerima panggilan: ' + err.message);
      this.cleanup();
    }
  }

  rejectCall() {
    this.sendSignal(this.peerId, 'call-reject', {});
    this.cleanup();
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
      if (state === 'failed' || state === 'closed') this.cleanup();
    };
  }

  async getMedia() {
    if (this.localStream) return;
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true
    });
    this.els.localVideo.srcObject = this.localStream;
    this.micOn = true;
    this.camOn = true;
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
    this.cleanup();
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
    this.localStream.getVideoTracks().forEach(t => { t.enabled = this.camOn; });
    this.updateControlButtons();
  }

  updateControlButtons() {
    const micBtn = document.getElementById('toggleMicBtn');
    const camBtn = document.getElementById('toggleCamBtn');
    if (micBtn) micBtn.textContent = this.micOn ? '🎤' : '🔇';
    if (camBtn) camBtn.textContent = this.camOn ? '📷' : '🚫';
    if (micBtn) micBtn.classList.toggle('vc-muted', !this.micOn);
    if (camBtn) camBtn.classList.toggle('vc-muted', !this.camOn);
  }

  cleanup() {
    this.pc?.close();
    this.pc = null;
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
    this.peerId = null;
    this.peerName = '';
    this.isCaller = false;
    this.inCall = false;

    if (this.els.localVideo) this.els.localVideo.srcObject = null;
    if (this.els.remoteVideo) this.els.remoteVideo.srcObject = null;
    if (this.els.incoming) this.els.incoming.style.display = 'none';
    if (this.els.active) this.els.active.style.display = 'none';
    this.hidePicker();

    if (typeof window.onVideoCallEnd === 'function') window.onVideoCallEnd();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.VideoCallManager = VideoCallManager;
