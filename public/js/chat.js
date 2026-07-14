const API = '';
let socket = null;
let currentUser = null;
let pendingFile = null;
let typingTimeout = null;
let isTyping = false;
let videoCall = null;
let replyTo = null;

const $ = (sel) => document.querySelector(sel);

// Elements
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

// Check existing session
const savedToken = localStorage.getItem('chat_token');
const savedUser = localStorage.getItem('chat_user');
if (savedToken && savedUser) {
  currentUser = JSON.parse(savedUser);
  showChat();
} else {
  loadCharacters();
}

async function loadCharacters() {
  try {
    const res = await fetch(API + '/api/characters');
    const characters = await res.json();
    renderCharacterGrid(characters, characterGrid, (ch) => {
      selectedCharacter = ch;
      selectedCharName.textContent = ch.display_name
        ? `${PIXEL_CHARS[ch.id]?.name} — ${ch.display_name}`
        : '';
      updateEnterBtn();
    });
  } catch (err) {
    loginError.textContent = 'Gagal memuat karakter';
    loginError.style.display = 'block';
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
    const res = await fetch(API + '/api/login', {
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

// Logout
$('#logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('chat_token');
  localStorage.removeItem('chat_user');
  if (socket) socket.disconnect();
  videoCall?.cleanup();
  videoCall = null;
  currentUser = null;
  chatScreen.style.display = 'none';
  loginScreen.style.display = 'flex';
  messagesContainer.innerHTML = '';
  selectedCharacter = null;
  if (loginCode) loginCode.value = '';
  selectedCharName.textContent = '';
  updateEnterBtn();
  loadCharacters();
});

function showChat() {
  loginScreen.style.display = 'none';
  chatScreen.style.display = 'flex';

  const avatar = $('#userAvatar');
  avatar.textContent = currentUser.display_name.charAt(0).toUpperCase();
  avatar.style.background = currentUser.avatar_color;
  $('#userDisplayName').textContent = currentUser.display_name;

  videoCall = new VideoCallManager({
    currentUser,
    sendSignal: (to, type, data) => {
      socket?.emit('call:signal', { to, type, data });
    }
  });

  connectSocket();
  loadMessages();
  ChatNotify.init();
}

function connectSocket() {
  const token = localStorage.getItem('chat_token');
  socket = io({ auth: { token } });

  socket.on('message:new', (msg) => {
    if (!document.querySelector(`[data-id="${msg.id}"]`)) {
      appendMessage(msg);
      scrollToBottom();
      ChatNotify.notifyMessage(msg, currentUser.id);
    }
  });

  socket.on('message:deleted', (data) => {
    removeMessageFromDOM(data.id);
  });

  socket.on('typing:start', (data) => {
    if (data.userId !== currentUser.id) {
      typingIndicator.textContent = `${data.display_name} sedang mengetik...`;
    }
  });

  socket.on('typing:stop', (data) => {
    if (data.userId !== currentUser.id) {
      typingIndicator.textContent = '';
    }
  });

  socket.on('online:count', (data) => {
    onlineCount.textContent = `${data.count} online`;
    if (videoCall) videoCall.setOnlineUsers(data.users || []);
  });

  socket.on('call:signal', (signal) => {
    videoCall?.handleSignal(signal);
  });

  socket.on('connect_error', () => {
    alert('Koneksi gagal. Silakan login ulang.');
    $('#logoutBtn').click();
  });
}

async function loadMessages() {
  const token = localStorage.getItem('chat_token');
  try {
    const res = await fetch(API + '/api/messages?limit=50', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const messages = await res.json();
    messagesContainer.innerHTML = '';
    messages.forEach(appendMessage);
    scrollToBottom();
  } catch (err) {
    console.error('Gagal memuat pesan:', err);
  }
}

function appendMessage(msg) {
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

  const textHtml = msg.content ? `<div class="message-text">${escapeHtml(msg.content)}</div>` : '';
  const replyHtml = buildReplyQuoteHtml(msg.reply_to, isOwn);
  const deleteBtn = isOwn ? `<button class="delete-msg-btn" onclick="deleteMessage(${msg.id})" title="Hapus pesan">✕</button>` : '';
  const replyBtn = `<button class="reply-msg-btn" onclick="startReply(${msg.id})" title="Balas pesan">↩</button>`;

  if (isOwn) {
    div.innerHTML = `
      <div class="message-content">
        ${deleteBtn}${replyBtn}
        <div class="message-header">
          <span class="message-time">${time}</span>
          <span class="message-sender">Anda</span>
        </div>
        ${replyHtml}${textHtml}${mediaHtml}
      </div>
    `;
  } else {
    div.innerHTML = `
      <div class="avatar avatar-sm" style="background:${msg.avatar_color}">${initial}</div>
      <div class="message-content">
        ${replyBtn}
        <div class="message-header">
          <span class="message-sender">${escapeHtml(msg.display_name)}</span>
          <span class="message-time">${time}</span>
        </div>
        ${replyHtml}${textHtml}${mediaHtml}
      </div>
    `;
  }

  messagesContainer.appendChild(div);
}

function formatTime(dateStr) {
  const d = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
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
    const token = localStorage.getItem('chat_token');
    const res = await fetch(API + '/messages/' + id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token }
    });
    const data = await res.json();
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

// Send message
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

    try {
      const token = localStorage.getItem('chat_token');
      const res = await fetch(API + '/api/upload', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: formData
      });

      uploadProgressBar.style.width = '80%';
      const data = await res.json();
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

  socket.emit('message:send', {
    content: content || null,
    media_type: mediaData?.media_type || null,
    media_url: mediaData?.media_url || null,
    media_name: mediaData?.media_name || null,
    reply_to_id: replyTo?.id || null
  });

  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendBtn.disabled = false;
  clearReply();
  stopTyping();
}

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';

  if (!isTyping) {
    isTyping = true;
    socket?.emit('typing:start');
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(stopTyping, 2000);
});

function stopTyping() {
  if (isTyping) {
    isTyping = false;
    socket?.emit('typing:stop');
  }
}

// File attachment
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

// Lightbox
function openLightbox(src) {
  lightboxImg.src = src;
  lightbox.classList.add('active');
}

lightbox.addEventListener('click', () => {
  lightbox.classList.remove('active');
});

window.openLightbox = openLightbox;
