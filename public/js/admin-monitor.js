class AdminCameraMonitor {
  constructor({ apiBase, authHeaders }) {
    this.api = apiBase;
    this.authHeaders = authHeaders;
    this.pollTimer = null;
    this.sessions = new Map();
    this.users = [];

    this.iceConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.grid = document.getElementById('monitorGrid');
    this.statusEl = document.getElementById('monitorStatus');
  }

  start() {
    this.stop();
    this.poll();
    this.pollTimer = setInterval(() => this.poll(), 1500);
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.sessions.forEach((session) => this.stopSession(session.userId, false));
    this.sessions.clear();
  }

  async poll() {
    try {
      const res = await fetch(this.api + '/admin-poll.php', { headers: this.authHeaders() });
      if (!res.ok) return;

      const data = await res.json();
      this.users = data.users || data;
      this.renderGrid();

      if (data.signals?.length) {
        for (const sig of data.signals) {
          await this.handleSignal(sig);
        }
      }
    } catch (err) {
      console.error('Admin monitor poll error:', err);
    }
  }

  async handleSignal(signal) {
    const userId = signal.from;
    const type = signal.type;
    const data = signal.data || {};

    switch (type) {
      case 'monitor-offer':
        await this.handleMonitorOffer(userId, signal.from_name, data.sdp);
        break;
      case 'monitor-ice': {
        const session = this.sessions.get(userId);
        if (session?.pc && data.candidate) {
          try {
            await session.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) { /* ignore */ }
        }
        break;
      }
      case 'monitor-stop':
        this.stopSession(userId);
        break;
    }
  }

  async handleMonitorOffer(userId, userName, sdp) {
    let session = this.sessions.get(userId);
    if (!session) {
      session = this.createSession(userId, userName);
    }

    if (session.pc) session.pc.close();

    const pc = new RTCPeerConnection(this.iceConfig);
    session.pc = pc;

    pc.ontrack = (e) => {
      if (e.streams[0] && session.video) {
        session.video.srcObject = e.streams[0];
        session.status.textContent = 'Live';
        session.status.className = 'monitor-tile-status live';
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.sendCameraAction('monitor_signal', userId, {
          type: 'monitor-ice',
          data: { candidate: e.candidate }
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        session.status.textContent = 'Terputus';
        session.status.className = 'monitor-tile-status offline';
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await this.sendCameraAction('monitor_signal', userId, {
      type: 'monitor-answer',
      data: { sdp: answer }
    });

    this.updateTile(session);
  }

  createSession(userId, userName) {
    const tile = document.createElement('div');
    tile.className = 'monitor-tile';
    tile.dataset.userId = userId;
    tile.innerHTML = `
      <div class="monitor-tile-video-wrap">
        <video autoplay playsinline muted></video>
        <span class="monitor-tile-status connecting">Menghubungkan...</span>
      </div>
      <div class="monitor-tile-info">
        <strong class="monitor-tile-name"></strong>
        <div class="monitor-tile-actions"></div>
      </div>
    `;

    const session = {
      userId,
      userName,
      tile,
      video: tile.querySelector('video'),
      status: tile.querySelector('.monitor-tile-status'),
      nameEl: tile.querySelector('.monitor-tile-name'),
      actionsEl: tile.querySelector('.monitor-tile-actions')
    };

    this.sessions.set(userId, session);
    return session;
  }

  facingLabel(facing) {
    return facing === 'environment' ? 'Belakang' : 'Depan';
  }

  facingButtons(userId, currentFacing, compact = false) {
    const frontClass = currentFacing !== 'environment' ? 'btn-facing-active' : '';
    const backClass = currentFacing === 'environment' ? 'btn-facing-active' : '';
    const prefix = compact ? '' : 'Kamera ';
    return `
      <button class="btn btn-outline btn-sm ${frontClass}" onclick="adminMonitor.setCameraFacing(${userId}, 'user')" title="${prefix}Depan">📱 ${compact ? 'Depan' : 'Depan'}</button>
      <button class="btn btn-outline btn-sm ${backClass}" onclick="adminMonitor.setCameraFacing(${userId}, 'environment')" title="${prefix}Belakang">📷 Belakang</button>
    `;
  }

  updateTile(session) {
    if (!this.grid) return;

    const user = this.users.find((u) => u.id === session.userId);
    const facing = user?.camera_facing || 'user';

    session.nameEl.textContent = session.userName || 'User #' + session.userId;
    session.actionsEl.innerHTML = `
      <button class="btn btn-danger btn-sm" data-action="stop">Stop</button>
      <button class="btn btn-outline btn-sm" data-action="cam_off">Matikan</button>
      ${this.facingButtons(session.userId, facing, true)}
    `;

    session.actionsEl.querySelector('[data-action="stop"]')?.addEventListener('click', () => {
      this.stopSession(session.userId);
    });
    session.actionsEl.querySelector('[data-action="cam_off"]')?.addEventListener('click', () => {
      this.setCamera(session.userId, false);
    });

    const existing = this.grid.querySelector(`[data-user-id="${session.userId}"]`);
    if (existing) existing.replaceWith(session.tile);
    else this.grid.prepend(session.tile);
  }

  renderGrid() {
    if (!this.grid) return;

    if (this.statusEl) {
      const online = this.users.filter((u) => u.is_online).length;
      const camOn = this.users.filter((u) => u.camera_active).length;
      this.statusEl.textContent = `${online} user online · ${camOn} kamera aktif`;
    }

    const listEl = document.getElementById('monitorUserList');
    if (!listEl) return;

    listEl.innerHTML = this.users.map((u) => {
      const onlineBadge = u.is_online
        ? '<span class="badge badge-active">Online</span>'
        : '<span class="badge badge-inactive">Offline</span>';
      const camBadge = u.camera_active
        ? '<span class="badge badge-cam-on">Kamera ON</span>'
        : '<span class="badge badge-cam-off">Kamera OFF</span>';
      const facingBadge = `<span class="badge badge-facing">${this.facingLabel(u.camera_facing)}</span>`;

      const actions = u.is_online ? `
        <button class="btn btn-primary btn-sm" onclick="adminMonitor.viewUser(${u.id})">Pantau</button>
        <button class="btn btn-outline btn-sm" onclick="adminMonitor.setCamera(${u.id}, true)">Hidupkan</button>
        <button class="btn btn-outline btn-sm" onclick="adminMonitor.setCamera(${u.id}, false)">Matikan</button>
        ${this.facingButtons(u.id, u.camera_facing || 'user')}
      ` : '<span style="color:var(--text-muted);font-size:0.8rem">User offline</span>';

      return `<tr>
        <td>${escapeHtml(u.display_name)}</td>
        <td>${onlineBadge}</td>
        <td>${camBadge}</td>
        <td>${facingBadge}</td>
        <td><div class="actions">${actions}</div></td>
      </tr>`;
    }).join('');
  }

  async viewUser(userId) {
    const user = this.users.find((u) => u.id === userId);
    if (!user?.is_online) {
      alert('User sedang offline');
      return;
    }

    const session = this.sessions.get(userId) || this.createSession(userId, user.display_name);
    this.updateTile(session);
    session.status.textContent = 'Meminta kamera...';
    session.status.className = 'monitor-tile-status connecting';

    await this.sendCameraAction('monitor_start', userId);
  }

  async stopSession(userId, notify = true) {
    const session = this.sessions.get(userId);
    if (!session) return;

    if (notify) {
      await this.sendCameraAction('monitor_stop', userId);
    }

    session.pc?.close();
    if (session.video) session.video.srcObject = null;
    session.tile.remove();
    this.sessions.delete(userId);
  }

  async setCamera(userId, on) {
    await this.sendCameraAction(on ? 'cam_on' : 'cam_off', userId);
    if (!on) {
      const session = this.sessions.get(userId);
      if (session) {
        session.status.textContent = 'Kamera dimatikan admin';
        session.status.className = 'monitor-tile-status offline';
        if (session.video) session.video.srcObject = null;
        session.pc?.close();
        session.pc = null;
      }
    }
  }

  async setCameraFacing(userId, facing) {
    const user = this.users.find((u) => u.id === userId);
    if (!user?.is_online) {
      alert('User sedang offline');
      return;
    }
    await this.sendCameraAction('cam_facing', userId, { facing });

    const session = this.sessions.get(userId);
    if (session) {
      session.status.textContent = 'Mengganti kamera...';
      session.status.className = 'monitor-tile-status connecting';
    }
  }

  async sendCameraAction(action, userId, extra = {}) {
    const body = { action, user_id: userId };
    if (extra.facing) body.facing = extra.facing;
    if (extra.type) {
      body.action = 'monitor_signal';
      body.type = extra.type;
      body.data = extra.data;
    }

    await fetch(this.api + '/admin-camera.php', {
      method: 'POST',
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
}

window.AdminCameraMonitor = AdminCameraMonitor;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
