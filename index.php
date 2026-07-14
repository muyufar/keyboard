<?php require_once __DIR__ . '/includes/config.php'; ?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#6366f1">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Pemesanan Buku">
  <title>Pemesanan Buku</title>
  <link rel="manifest" href="<?= BASE_PATH ?>/manifest.php">
  <link rel="apple-touch-icon" href="<?= BASE_PATH ?>/public/icons/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="192x192" href="<?= BASE_PATH ?>/public/icons/icon-192.png">
  <link rel="stylesheet" href="<?= BASE_PATH ?>/public/css/style.css">
  <link rel="stylesheet" href="<?= BASE_PATH ?>/public/css/characters.css">
</head>
<body>

  <div id="loginScreen" class="character-login">
    <div class="character-login-header">
      <h1>PEMESANAN BUKU</h1>
      <p>Pilih karakter Anda untuk masuk</p>
    </div>
    <div id="loginError" class="error-msg" style="max-width:400px;width:100%;margin-bottom:16px"></div>
    <div class="character-grid" id="characterGrid"></div>
    <div class="character-login-footer">
      <div class="character-selected-name" id="selectedCharName"></div>
      <div class="login-code-wrap">
        <label for="loginCode">Kode Akses</label>
        <input type="password" id="loginCode" class="login-code-input" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off">
      </div>
      <button class="btn btn-primary" id="enterBtn" disabled>Masuk</button>
      <p class="character-hint">Karakter dikunci? Daftarkan di Backoffice</p>
      <button type="button" class="btn btn-outline btn-sm" id="installAppBtnLogin" style="margin-top:12px;display:none">📲 Instal Aplikasi</button>
    </div>
  </div>

  <div id="chatScreen" class="chat-app" style="display:none">
    <header class="chat-header">
      <h2>
        <span class="online-dot"></span>
        Pemesanan Buku
        <span class="online-count" id="onlineCount">0 online</span>
      </h2>
      <div class="user-info">
        <div class="avatar" id="userAvatar"></div>
        <span id="userDisplayName"></span>
        <button class="video-call-btn" id="installAppBtn" title="Instal ke Layar Utama" style="display:none">📲</button>
        <button class="video-call-btn" id="videoCallBtn" title="Video Call">📹</button>
        <button class="video-call-btn" id="notifyBtn" title="Notifikasi">🔔</button>
        <button class="logout-btn" id="logoutBtn">Keluar</button>
      </div>
    </header>

    <div class="messages-container" id="messagesContainer"></div>
    <div class="typing-indicator" id="typingIndicator"></div>

    <div class="chat-input-area">
      <div class="reply-preview" id="replyPreview">
        <div class="reply-preview-bar"></div>
        <div class="reply-preview-content">
          <span class="reply-preview-label">Balas <strong id="replyPreviewName"></strong></span>
          <span class="reply-preview-text" id="replyPreviewText"></span>
        </div>
        <button class="remove-attachment" id="cancelReply" title="Batal balas">&times;</button>
      </div>
      <div class="upload-progress" id="uploadProgress">
        <div class="upload-progress-bar" id="uploadProgressBar"></div>
      </div>
      <div class="attachment-preview" id="attachmentPreview">
        <img class="preview-thumb" id="previewThumb" src="" alt="" style="display:none">
        <div class="preview-info">
          <div class="preview-name" id="previewName"></div>
          <div class="preview-size" id="previewSize"></div>
        </div>
        <button class="remove-attachment" id="removeAttachment" title="Hapus">&times;</button>
      </div>
      <div class="input-row">
        <button class="attach-btn" id="attachBtn" title="Lampirkan file">📎</button>
        <input type="file" id="fileInput" accept="image/*,video/*,audio/*" hidden>
        <textarea class="message-input" id="messageInput" placeholder="Ketik pesanan atau pesan..." rows="1"></textarea>
        <button class="send-btn" id="sendBtn" title="Kirim">➤</button>
      </div>
    </div>
  </div>

  <div class="lightbox" id="lightbox">
    <img id="lightboxImg" src="" alt="">
  </div>

  <div id="callPickerModal" class="vc-modal" style="display:none">
    <div class="vc-modal-card">
      <h3>Video Call</h3>
      <div id="onlineUsersList"></div>
      <button id="closeCallPicker" class="btn btn-outline" style="width:100%;margin-top:12px">Batal</button>
    </div>
  </div>

  <div id="incomingCall" class="vc-incoming" style="display:none">
    <div class="vc-incoming-card">
      <div class="vc-caller-avatar" id="incomingAvatar"></div>
      <p id="incomingName">Seseorang memanggil...</p>
      <div class="vc-incoming-actions">
        <button id="acceptCallBtn" class="vc-btn vc-btn-accept">Terima</button>
        <button id="rejectCallBtn" class="vc-btn vc-btn-reject">Tolak</button>
      </div>
    </div>
  </div>

  <div id="activeCall" class="vc-active" style="display:none">
    <div class="vc-videos">
      <video id="remoteVideo" autoplay playsinline></video>
      <video id="localVideo" autoplay playsinline muted></video>
    </div>
    <div class="vc-call-info"><span id="callStatusText">Menghubungkan...</span></div>
    <div class="vc-controls">
      <button id="toggleMicBtn" class="vc-ctrl-btn" title="Mikrofon">🎤</button>
      <button id="toggleCamBtn" class="vc-ctrl-btn" title="Kamera">📷</button>
      <button id="hangupBtn" class="vc-ctrl-btn vc-hangup" title="Tutup">📞</button>
    </div>
  </div>

  <div id="installBanner" class="install-banner" style="display:none">
    <div class="install-banner-inner">
      <span class="install-banner-icon">📲</span>
      <p id="installBannerText"></p>
      <button id="installBannerBtn" class="btn btn-primary btn-sm">Instal</button>
      <button id="installBannerClose" class="install-banner-close" aria-label="Tutup">&times;</button>
    </div>
  </div>

  <script>const BASE = '<?= BASE_PATH ?>';</script>
  <script src="<?= BASE_PATH ?>/public/js/pwa.js"></script>
  <script src="<?= BASE_PATH ?>/public/js/characters.js"></script>
  <script src="<?= BASE_PATH ?>/public/js/notifications.js"></script>
  <script src="<?= BASE_PATH ?>/public/js/videocall.js"></script>
  <script src="<?= BASE_PATH ?>/public/js/chat-php.js"></script>
</body>
</html>
