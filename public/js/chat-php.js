const API = (typeof BASE !== 'undefined' ? BASE : '') + '/api';
let currentUser = null;
let pendingFile = null;
let typingTimeout = null;
let isTyping = false;
let pollTimer = null;
let lastMessageId = 0;
let pollInFlight = false;
let pollErrors = 0;
let pollingActive = false;
let hasMoreOlder = false;
let loadingOlder = false;
const MESSAGES_PAGE_SIZE = 100;
const MESSAGES_MAX_TOTAL = 500;
let videoCall = null;
let replyTo = null;

const $ = (sel) => document.querySelector(sel);

const loginScreen = $('#loginScreen');
const chatScreen = $('#chatScreen');
const loginError = $('#loginError');
const characterGrid = $('#characterGrid');
const enterBtn = $('#enterBtn');
const selectedCharName = $('#selectedCharName');
const loginCode = $('#loginCode');
let selectedCharacter = null;
const messagesContainer = $('#messagesContainer');
const messageInput = $('#messageInput');
const sendBtn = $('#sendBtn');
const attachBtn = $('#attachBtn');
const fileInput = $('#fileInput');
const attachmentPreview = $('#attachmentPreview');
const previewThumb = $('#previewThumb');
const previewName = $('#previewName');
const previewSize = $('#previewSize');
const removeAttachment = $('#removeAttachment');
const typingIndicator = $('#typingIndicator');
const onlineCount = $('#onlineCount');
const lightbox = $('#lightbox');
const lightboxImg = $('#lightboxImg');
const uploadProgress = $('#uploadProgress');
const uploadProgressBar = $('#uploadProgressBar');
const replyPreview = $('#replyPreview');
const replyPreviewName = $('#replyPreviewName');
const replyPreviewText = $('#replyPreviewText');
const cancelReply = $('#cancelReply');

function authHeaders() {
  return { Authorization: 'Bearer ' + localStorage.getItem('chat_token') };
}

async function parseJsonResponse(res) {
  const text = await res.text();
  if (!text) {
    throw new Error('Server tidak merespons (kosong). Cek permission folder data/ dan uploads/ (chmod 755).');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Error server: ' + text.substring(0, 120));
  }
}

const savedToken = localStorage.getItem('chat_token');
const savedUser = localStorage.getItem('chat_user');
if (savedToken && savedUser) {
  currentUser = JSON.parse(savedUser);
  showChat();
} else {
  loadCharacters();
}

async function loadCharacters(retry = 0) {
  loginError.style.display = 'none';

  if (typeof LOGIN_CHARACTERS !== 'undefined' && Array.isArray(LOGIN_CHARACTERS)) {
    try {
      renderCharacterGrid(LOGIN_CHARACTERS, characterGrid, (ch) => {
        selectedCharacter = ch;
        selectedCharName.textContent = ch.display_name
          ? `${PIXEL_CHARS[ch.id]?.name} — ${ch.display_name}`
          : '';
        updateEnterBtn();
      });
      return;
    } catch (err) {
      console.warn('LOGIN_CHARACTERS render gagal:', err);
    }
  }

  const urls = [
    (typeof BASE !== 'undefined' ? BASE : '') + '/get-characters.php',
    API + '/characters.php'
  ];

  let lastErr = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const text = await res.text();
      if (!text) {
        throw new Error('Respons kosong dari ' + url);
      }
      let characters;
      try {
        characters = JSON.parse(text);
      } catch {
        throw new Error('Bukan JSON valid: ' + text.substring(0, 80));
      }

      if (!res.ok) {
        throw new Error(characters.error || ('HTTP ' + res.status));
      }
      if (!Array.isArray(characters)) {
        throw new Error('Format data karakter tidak valid');
      }
      if (typeof renderCharacterGrid !== 'function') {
        throw new Error('Komponen karakter belum dimuat. Refresh halaman.');
      }

      renderCharacterGrid(characters, characterGrid, (ch) => {
        selectedCharacter = ch;
        selectedCharName.textContent = ch.display_name
          ? `${PIXEL_CHARS[ch.id]?.name} — ${ch.display_name}`
          : '';
        updateEnterBtn();
      });
      return;
    } catch (err) {
      lastErr = err;
    }
  }

  if (retry < 2) {
    await new Promise((r) => setTimeout(r, 1500));
    return loadCharacters(retry + 1);
  }

  loginError.innerHTML = `Gagal memuat karakter: ${escapeHtml(lastErr?.message || 'Unknown')}. <button type="button" class="btn btn-outline btn-sm" id="retryCharacters" style="margin-top:8px">Coba Lagi</button>`;
  loginError.style.display = 'block';
  $('#retryCharacters')?.addEventListener('click', () => loadCharacters());

  if (typeof renderCharacterGrid === 'function' && characterGrid) {
    const fallback = Object.keys(PIXEL_CHARS).map((id) => ({
      id,
      name: PIXEL_CHARS[id].name,
      title: PIXEL_CHARS[id].title,
      available: false,
      display_name: null
    }));
    renderCharacterGrid(fallback, characterGrid, () => {});
  }
}

function updateEnterBtn() {
  const code = loginCode?.value.trim() || '';
  enterBtn.disabled = !selectedCharacter || code.length !== 4;
}

if (loginCode) {
  loginCode.addEventListener('input', () => {
    loginCode.value = loginCode.value.replace(/\D/g, '').slice(0, 4);
    updateEnterBtn();
  });
  loginCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !enterBtn.disabled) enterBtn.click();
  });
}

enterBtn.addEventListener('click', async () => {
  if (!selectedCharacter) return;
  loginError.style.display = 'none';
  enterBtn.disabled = true;

  const code = loginCode?.value.trim() || '';
  if (code.length !== 4) {
    loginError.textContent = 'Masukkan kode akses 4 digit';
    loginError.style.display = 'block';
    updateEnterBtn();
    return;
  }

  try {
    const res = await fetch(API + '/login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character_id: selectedCharacter.id, code })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    localStorage.setItem('chat_token', data.token);
    localStorage.setItem('chat_user', JSON.stringify(data.user));
    currentUser = data.user;
    showChat();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.style.display = 'block';
    updateEnterBtn();
  }
});

$('#logoutBtn').addEventListener('click', () => {
  stopPolling();
  pollingActive = false;
  pollErrors = 0;
  hideConnectionBanner();
  videoCall?.cleanup();
  videoCall = null;
  localStorage.removeItem('chat_token');
  localStorage.removeItem('chat_user');
  currentUser = null;
  lastMessageId = 0;
  selectedCharacter = null;
  if (loginCode) loginCode.value = '';
  chatScreen.style.display = 'none';
  loginScreen.style.display = 'flex';
  messagesContainer.innerHTML = '';
  updateEnterBtn();
  selectedCharName.textContent = '';
  loadCharacters();
});

let emojiPickerInited = false;

function showChat() {
  loginScreen.style.display = 'none';
  chatScreen.style.display = 'flex';

  const avatar = $('#userAvatar');
  avatar.textContent = currentUser.display_name.charAt(0).toUpperCase();
  avatar.style.background = currentUser.avatar_color;
  $('#userDisplayName').textContent = currentUser.display_name;

  if (!emojiPickerInited) {
    initEmojiPicker({
      button: $('#emojiBtn'),
      panel: $('#emojiPicker'),
      input: messageInput
    });
    emojiPickerInited = true;
  }

  videoCall = new VideoCallManager({
    currentUser,
    sendSignal: async (to, type, data) => {
      await fetch(API + '/call-signal.php', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, type, data })
      });
    },
    sendMonitorSignal: async (type, data) => {
      await fetch(API + '/monitor-signal.php', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data })
      });
    },
    reportCameraStatus: async (active, permission, facing = 'user') => {
      try {
        await fetch(API + '/camera-status.php', {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ active, permission, facing })
        });
      } catch (e) { /* ignore */ }
    }
  });

  videoCall.startAutoCamera();

  loadMessages().then(() => {
    if (!pollingActive) {
      startPolling();
      pollingActive = true;
    }
  });
  ChatNotify.init();
}

function ensureConnectionBanner() {
  let banner = document.getElementById('connectionBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'connectionBanner';
    banner.className = 'connection-banner';
    banner.innerHTML = '<span id="connectionBannerText"></span><button type="button" id="connectionRelogin" class="btn btn-outline btn-sm" style="display:none">Login Ulang</button>';
    chatScreen.insertBefore(banner, chatScreen.firstChild);
    $('#connectionRelogin')?.addEventListener('click', () => $('#logoutBtn').click());
  }
  return banner;
}

function showConnectionBanner(text, showRelogin = false) {
  const banner = ensureConnectionBanner();
  $('#connectionBannerText').textContent = text;
  const btn = $('#connectionRelogin');
  if (btn) btn.style.display = showRelogin ? 'inline-flex' : 'none';
  banner.style.display = 'flex';
}

function hideConnectionBanner() {
  const banner = document.getElementById('connectionBanner');
  if (banner) banner.style.display = 'none';
}

function handleSessionExpired() {
  stopPolling();
  showConnectionBanner('Sesi berakhir. Silakan login ulang.', true);
}

window.onVideoCallStart = () => startPolling();
window.onVideoCallEnd = () => startPolling();

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && currentUser && chatScreen.style.display !== 'none') {
    loadMessages();
    startPolling();
    if (videoCall && !videoCall.inCall) {
      videoCall.startAutoCamera();
    }
  }
});

async function fetchMessagePage(before = null) {
  let url = API + '/messages.php?limit=' + MESSAGES_PAGE_SIZE;
  if (before) url += '&before=' + before;
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 401) { handleSessionExpired(); return null; }
  if (!res.ok) throw new Error('Gagal memuat pesan (' + res.status + ')');
  const messages = await parseJsonResponse(res);
  if (!Array.isArray(messages)) throw new Error('Format pesan tidak valid');
  return messages;
}

function ensureLoadOlderUI() {
  if (document.getElementById('loadOlderWrap')) return;
  const wrap = document.createElement('div');
  wrap.id = 'loadOlderWrap';
  wrap.className = 'load-older-wrap';
  wrap.innerHTML = '<button type="button" id="loadOlderBtn" class="btn btn-outline btn-sm">Muat pesan lebih lama</button>';
  messagesContainer.prepend(wrap);
  $('#loadOlderBtn')?.addEventListener('click', loadOlderMessages);
}

function updateLoadOlderUI(loading = false) {
  const wrap = document.getElementById('loadOlderWrap');
  const btn = document.getElementById('loadOlderBtn');
  if (!wrap || !btn) return;
  if (!hasMoreOlder) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';
  btn.disabled = loading;
  btn.textContent = loading ? 'Memuat...' : 'Muat pesan lebih lama';
}

function getOldestMessageId() {
  const first = messagesContainer.querySelector('.message[data-id]');
  return first ? parseInt(first.dataset.id, 10) : null;
}

async function loadOlderMessages() {
  if (loadingOlder || !hasMoreOlder) return;
  const before = getOldestMessageId();
  if (!before) return;

  loadingOlder = true;
  updateLoadOlderUI(true);

  try {
    const batch = await fetchMessagePage(before);
    if (!batch) return;

    if (!batch.length) {
      hasMoreOlder = false;
      updateLoadOlderUI(false);
      return;
    }

    const prevHeight = messagesContainer.scrollHeight;
    batch.forEach((msg) => {
      if (!document.querySelector(`[data-id="${msg.id}"]`)) {
        prependMessage(msg);
      }
    });
    messagesContainer.scrollTop += messagesContainer.scrollHeight - prevHeight;

    hasMoreOlder = batch.length >= MESSAGES_PAGE_SIZE;
    updateLoadOlderUI(false);
  } catch (err) {
    console.error('Gagal memuat pesan lama:', err);
    updateLoadOlderUI(false);
  } finally {
    loadingOlder = false;
  }
}

async function loadMessages() {
  try {
    ensureLoadOlderUI();
    messagesContainer.querySelectorAll('.message').forEach((el) => el.remove());

    let allMessages = [];
    let before = null;
    let lastBatchLen = 0;

    while (allMessages.length < MESSAGES_MAX_TOTAL) {
      const batch = await fetchMessagePage(before);
      if (!batch) return false;
      if (!batch.length) {
        lastBatchLen = 0;
        break;
      }

      lastBatchLen = batch.length;
      allMessages = batch.concat(allMessages);

      if (batch.length < MESSAGES_PAGE_SIZE) break;
      before = batch[0].id;
    }

    if (!allMessages.length && messagesContainer.querySelectorAll('.message').length > 0) {
      console.warn('Server mengembalikan 0 pesan, mempertahankan tampilan');
      return true;
    }

    allMessages.forEach((msg) => appendMessage(msg));

    if (allMessages.length) {
      lastMessageId = allMessages[allMessages.length - 1].id;
      hasMoreOlder = lastBatchLen >= MESSAGES_PAGE_SIZE;
    } else {
      hasMoreOlder = false;
    }

    updateLoadOlderUI(false);
    pollErrors = 0;
    hideConnectionBanner();
    scrollToBottom();
    return true;
  } catch (err) {
    pollErrors++;
    console.error('Gagal memuat pesan:', err);
    showConnectionBanner('Koneksi terganggu. Mencoba menyambung kembali...');
    return false;
  }
}

if (messagesContainer) {
  messagesContainer.addEventListener('scroll', () => {
    if (messagesContainer.scrollTop < 100 && hasMoreOlder && !loadingOlder) {
      loadOlderMessages();
    }
  });
}

function startPolling() {
  stopPolling();
  const interval = videoCall?.inCall ? 800 : 2000;
  pollTimer = setInterval(poll, interval);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function poll() {
  if (pollInFlight) return;
  pollInFlight = true;

  try {
    const res = await fetch(API + '/poll.php?since=' + lastMessageId, { headers: authHeaders() });
    if (res.status === 401) { handleSessionExpired(); return; }
    if (!res.ok) throw new Error('Poll gagal (' + res.status + ')');

    const data = await parseJsonResponse(res);

    if (data.messages?.length) {
      data.messages.forEach(msg => {
        if (!document.querySelector(`[data-id="${msg.id}"]`)) {
          appendMessage(msg);
          lastMessageId = Math.max(lastMessageId, msg.id);
          ChatNotify.notifyMessage(msg, currentUser.id);
        }
      });
      scrollToBottom();
    }

    if (data.deleted?.length) {
      data.deleted.forEach(id => removeMessageFromDOM(id));
    }

    if (data.typing?.length) {
      typingIndicator.textContent = data.typing.join(', ') + ' sedang mengetik...';
    } else {
      typingIndicator.textContent = '';
    }

    onlineCount.textContent = (data.online || 0) + ' online';

    if (videoCall) {
      videoCall.setOnlineUsers(data.online_users || []);
      if (data.call_signals?.length) {
        data.call_signals.forEach(sig => {
          videoCall.handleSignal({
            from: sig.from,
            from_name: sig.from_name,
            from_color: sig.from_color,
            type: sig.type,
            data: sig.data
          });
        });
      }
      if (data.admin_signals?.length) {
        data.admin_signals.forEach(sig => {
          videoCall.handleAdminSignal({
            type: sig.type,
            data: sig.data
          });
        });
      }
    }

    pollErrors = 0;
    hideConnectionBanner();
  } catch (err) {
    pollErrors++;
    console.error('Poll error:', err);
    if (pollErrors >= 3) {
      showConnectionBanner('Koneksi lambat. Menyegarkan pesan...');
      await loadMessages();
    }
  } finally {
    pollInFlight = false;
  }
}

function appendMessage(msg) {
  messagesContainer.appendChild(createMessageElement(msg));
}

function prependMessage(msg) {
  const wrap = document.getElementById('loadOlderWrap');
  const el = createMessageElement(msg);
  if (wrap && wrap.nextSibling) {
    messagesContainer.insertBefore(el, wrap.nextSibling);
  } else if (wrap) {
    messagesContainer.appendChild(el);
  } else {
    messagesContainer.insertBefore(el, messagesContainer.firstChild);
  }
}

function createMessageElement(msg) {
  const isOwn = msg.user_id === currentUser.id;
  const div = document.createElement('div');
  div.className = 'message' + (isOwn ? ' own' : '');
  div.dataset.id = msg.id;

  const time = formatTime(msg.created_at);
  const initial = msg.display_name.charAt(0).toUpperCase();

  let mediaHtml = '';
  if (msg.media_url) {
    if (msg.media_type === 'image') {
      mediaHtml = `<div class="message-media">
        <img src="${msg.media_url}" alt="${escapeHtml(msg.media_name || '')}" onclick="openLightbox('${msg.media_url}')">
        ${msg.media_name ? `<div class="media-filename">${escapeHtml(msg.media_name)}</div>` : ''}
      </div>`;
    } else if (msg.media_type === 'video') {
      mediaHtml = `<div class="message-media">
        <video controls preload="metadata" src="${msg.media_url}"></video>
        ${msg.media_name ? `<div class="media-filename">${escapeHtml(msg.media_name)}</div>` : ''}
      </div>`;
    } else if (msg.media_type === 'audio') {
      mediaHtml = `<div class="message-media">
        <audio controls preload="metadata" src="${msg.media_url}"></audio>
        ${msg.media_name ? `<div class="media-filename">${escapeHtml(msg.media_name)}</div>` : ''}
      </div>`;
    }
  }

  const textHtml = msg.content
    ? `<div class="message-text${isMostlyEmoji(msg.content) ? ' emoji-large' : ''}">${escapeHtml(msg.content)}</div>`
    : '';
  const replyHtml = buildReplyQuoteHtml(msg.reply_to, isOwn);
  const deleteBtn = isOwn ? `<button class="delete-msg-btn" onclick="deleteMessage(${msg.id})" title="Hapus pesan">✕</button>` : '';
  const replyBtn = `<button class="reply-msg-btn" onclick="startReply(${msg.id})" title="Balas pesan">↩</button>`;

  if (isOwn) {
    div.innerHTML = `<div class="message-content">
      ${deleteBtn}${replyBtn}
      <div class="message-header"><span class="message-time">${time}</span><span class="message-sender">Anda</span></div>
      ${replyHtml}${textHtml}${mediaHtml}
    </div>`;
  } else {
    div.innerHTML = `
      <div class="avatar avatar-sm" style="background:${msg.avatar_color}">${initial}</div>
      <div class="message-content">
        ${replyBtn}
        <div class="message-header"><span class="message-sender">${escapeHtml(msg.display_name)}</span><span class="message-time">${time}</span></div>
        ${replyHtml}${textHtml}${mediaHtml}
      </div>`;
  }

  return div;
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeMessageFromDOM(id) {
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) el.remove();
}

async function deleteMessage(id) {
  if (!confirm('Hapus pesan ini?')) return;

  try {
    const res = await fetch(API + '/delete-message.php?id=' + id, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error);
    removeMessageFromDOM(id);
  } catch (err) {
    alert('Gagal menghapus pesan: ' + err.message);
  }
}

window.deleteMessage = deleteMessage;

function startReply(id) {
  const el = document.querySelector(`[data-id="${id}"]`);
  if (!el) return;

  const sender = el.querySelector('.message-sender')?.textContent || 'User';
  const textEl = el.querySelector('.message-text');
  const mediaEl = el.querySelector('.message-media');

  replyTo = {
    id,
    display_name: sender === 'Anda' ? currentUser.display_name : sender,
    content: textEl?.textContent || null,
    media_type: mediaEl?.querySelector('img') ? 'image'
      : mediaEl?.querySelector('video') ? 'video'
      : mediaEl?.querySelector('audio') ? 'audio' : null
  };

  replyPreviewName.textContent = replyTo.display_name;
  replyPreviewText.textContent = getMessagePreview(replyTo);
  replyPreview.classList.add('active');
  messageInput.focus();
}

function clearReply() {
  replyTo = null;
  replyPreview.classList.remove('active');
}

cancelReply.addEventListener('click', clearReply);

function scrollToMessage(id) {
  const el = document.querySelector(`[data-id="${id}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('message-highlight');
  setTimeout(() => el.classList.remove('message-highlight'), 1500);
}

window.startReply = startReply;
window.scrollToMessage = scrollToMessage;

async function sendMessage() {
  const content = messageInput.value.trim();
  if (!content && !pendingFile) return;

  sendBtn.disabled = true;
  let mediaData = null;

  if (pendingFile) {
    uploadProgress.classList.add('active');
    uploadProgressBar.style.width = '30%';

    const formData = new FormData();
    formData.append('file', pendingFile);
    formData.append('token', localStorage.getItem('chat_token'));

    try {
      const res = await fetch(API + '/upload.php', {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });
      uploadProgressBar.style.width = '80%';
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error);
      mediaData = data;
    } catch (err) {
      alert('Gagal mengunggah file: ' + err.message);
      sendBtn.disabled = false;
      uploadProgress.classList.remove('active');
      return;
    }

    uploadProgressBar.style.width = '100%';
    setTimeout(() => uploadProgress.classList.remove('active'), 500);
    clearAttachment();
  }

  try {
    const res = await fetch(API + '/messages.php', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content || null,
        media_type: mediaData?.media_type || null,
        media_url: mediaData?.media_url || null,
        media_name: mediaData?.media_name || null,
        reply_to_id: replyTo?.id || null
      })
    });
    const msg = await parseJsonResponse(res);
    if (!res.ok) throw new Error(msg.error);

    if (!document.querySelector(`[data-id="${msg.id}"]`)) {
      appendMessage(msg);
      lastMessageId = Math.max(lastMessageId, msg.id);
      scrollToBottom();
    }
  } catch (err) {
    alert('Gagal mengirim pesan: ' + err.message);
  }

  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendBtn.disabled = false;
  clearReply();
  stopTyping();
}

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';

  if (!isTyping) {
    isTyping = true;
    fetch(API + '/typing.php', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' })
    });
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(stopTyping, 2000);
});

function stopTyping() {
  if (isTyping) {
    isTyping = false;
    fetch(API + '/typing.php', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' })
    });
  }
}

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  pendingFile = file;
  previewName.textContent = file.name;
  previewSize.textContent = formatFileSize(file.size);
  if (file.type.startsWith('image/')) {
    previewThumb.style.display = 'block';
    previewThumb.src = URL.createObjectURL(file);
  } else {
    previewThumb.style.display = 'none';
  }
  attachmentPreview.classList.add('active');
  fileInput.value = '';
});

removeAttachment.addEventListener('click', clearAttachment);

function clearAttachment() {
  pendingFile = null;
  attachmentPreview.classList.remove('active');
  previewThumb.src = '';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function openLightbox(src) {
  lightboxImg.src = src;
  lightbox.classList.add('active');
}

lightbox.addEventListener('click', () => lightbox.classList.remove('active'));
window.openLightbox = openLightbox;
