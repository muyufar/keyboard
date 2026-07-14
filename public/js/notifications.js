const ChatNotify = {
  enabled: false,

  init() {
    if (!('Notification' in window)) return;
    this.enabled = Notification.permission === 'granted';
    this.renderBanner();
    this.bindNotifyBtn();
  },

  bindNotifyBtn() {
    const btn = document.getElementById('notifyBtn');
    if (!btn) return;
    this.updateNotifyBtn(btn);
    btn.addEventListener('click', async () => {
      if (Notification.permission === 'granted') {
        this.enabled = !this.enabled;
        btn.title = this.enabled ? 'Notifikasi aktif' : 'Notifikasi nonaktif';
        btn.classList.toggle('notify-active', this.enabled);
      } else {
        await this.requestPermission();
        this.updateNotifyBtn(btn);
      }
    });
  },

  updateNotifyBtn(btn) {
    const active = Notification.permission === 'granted' && this.enabled;
    btn.classList.toggle('notify-active', active);
    btn.title = active ? 'Notifikasi aktif (klik untuk nonaktifkan)'
      : Notification.permission === 'denied' ? 'Notifikasi diblokir browser'
      : 'Aktifkan notifikasi';
  },

  renderBanner() {
    if (Notification.permission !== 'default') return;
    if (document.getElementById('notifyBanner')) return;
    if (localStorage.getItem('notify_dismissed') === '1') return;

    const chatScreen = document.getElementById('chatScreen');
    if (!chatScreen) return;

    const banner = document.createElement('div');
    banner.id = 'notifyBanner';
    banner.className = 'notify-banner';
    banner.innerHTML = `
      <span>🔔 Aktifkan notifikasi untuk pesan &amp; panggilan baru?</span>
      <div class="notify-banner-actions">
        <button id="notifyAllowBtn" class="btn btn-primary btn-sm">Izinkan</button>
        <button id="notifyDismissBtn" class="btn btn-outline btn-sm">Nanti</button>
      </div>
    `;
    chatScreen.insertBefore(banner, chatScreen.firstChild);

    document.getElementById('notifyAllowBtn').addEventListener('click', () => this.requestPermission());
    document.getElementById('notifyDismissBtn').addEventListener('click', () => {
      localStorage.setItem('notify_dismissed', '1');
      banner.remove();
    });
  },

  async requestPermission() {
    if (!('Notification' in window)) {
      alert('Browser Anda tidak mendukung notifikasi.');
      return 'unsupported';
    }
    const result = await Notification.requestPermission();
    this.enabled = result === 'granted';
    document.getElementById('notifyBanner')?.remove();
    this.updateNotifyBtn(document.getElementById('notifyBtn'));
    if (result === 'granted') localStorage.removeItem('notify_dismissed');
    if (result === 'denied') alert('Notifikasi diblokir. Aktifkan melalui pengaturan browser.');
    return result;
  },

  canNotify() {
    return 'Notification' in window && this.enabled && Notification.permission === 'granted';
  },

  show(title, body, options = {}) {
    if (!this.canNotify()) return;
    if (document.hasFocus() && !options.force) return;

    try {
      const n = new Notification(title, {
        body: (body || '').substring(0, 200),
        tag: options.tag || 'light-chat',
        requireInteraction: !!options.requireInteraction
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) { /* ignore */ }
  },

  notifyMessage(msg, currentUserId) {
    if (!msg || msg.user_id === currentUserId) return;
    let body = msg.content || '';
    if (!body && msg.media_type) {
      const labels = { image: '📷 Gambar', video: '🎬 Video', audio: '🎵 Audio' };
      body = labels[msg.media_type] || '📎 Media';
    }
    if (msg.reply_to) body = '↩ Balasan: ' + body;
    this.show(msg.display_name, body, { tag: 'msg-' + msg.id });
  },

  notifyIncomingCall(name) {
    this.show('Panggilan Video', (name || 'Seseorang') + ' memanggil Anda', {
      tag: 'incoming-call',
      requireInteraction: true,
      force: true
    });
  }
};

window.ChatNotify = ChatNotify;

function getMessagePreview(msg) {
  if (msg.content) {
    return msg.content.length > 80 ? msg.content.substring(0, 80) + '…' : msg.content;
  }
  const labels = { image: '📷 Gambar', video: '🎬 Video', audio: '🎵 Audio' };
  return labels[msg.media_type] || '📎 Media';
}

function buildReplyQuoteHtml(replyTo, isOwn) {
  if (!replyTo) return '';
  const preview = getMessagePreview(replyTo);
  return `<div class="reply-quote" onclick="scrollToMessage(${replyTo.id})" title="Lihat pesan asli">
    <span class="reply-quote-name">${escapeHtmlStatic(replyTo.display_name)}</span>
    <span class="reply-quote-text">${escapeHtmlStatic(preview)}</span>
  </div>`;
}

function escapeHtmlStatic(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

window.getMessagePreview = getMessagePreview;
window.buildReplyQuoteHtml = buildReplyQuoteHtml;
