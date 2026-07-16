<?php require_once __DIR__ . '/../includes/config.php'; ?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Backoffice - Pemesanan Buku</title>
  <link rel="stylesheet" href="<?= BASE_PATH ?>/public/css/style.css">
  <link rel="stylesheet" href="<?= BASE_PATH ?>/public/css/characters.css">
</head>
<body>

  <div id="adminLogin" class="login-page">
    <div class="login-card">
      <h1>Backoffice</h1>
      <p>Panel administrasi Pemesanan Buku</p>
      <div id="adminError" class="error-msg"></div>
      <form id="adminLoginForm">
        <div class="form-group">
          <label for="adminUser">Username Admin</label>
          <input type="text" id="adminUser" placeholder="admin" required>
        </div>
        <div class="form-group">
          <label for="adminPass">Password Admin</label>
          <input type="password" id="adminPass" placeholder="Password" required>
        </div>
        <button type="submit" class="btn btn-primary">Masuk</button>
      </form>
      <p style="margin-top:16px;text-align:center;font-size:0.8rem;color:var(--text-muted)">
        <a href="<?= BASE_PATH ?>/" style="color:var(--primary);text-decoration:none">← Kembali ke Aplikasi</a>
      </p>
    </div>
  </div>

  <div id="adminPanel" class="backoffice" style="display:none">
    <div class="backoffice-header">
      <h1>Backoffice - Kelola User</h1>
      <div style="display:flex;gap:10px;align-items:center">
        <a href="<?= BASE_PATH ?>/" class="btn btn-outline btn-sm">Buka Aplikasi</a>
        <button class="logout-btn" id="adminLogout">Keluar</button>
      </div>
    </div>

    <div class="card">
      <h2>Pengaturan Akses</h2>
      <div id="settingsSuccess" class="success-msg"></div>
      <div id="settingsError" class="error-msg"></div>
      <form id="settingsForm">
        <div class="form-row">
          <div class="form-group">
            <label for="loginCodeSetting">Kode Akses Login</label>
            <input type="text" id="loginCodeSetting" inputmode="numeric" maxlength="4" pattern="\d{4}" required placeholder="0505">
            <p style="margin-top:6px;font-size:0.8rem;color:var(--text-muted)">Kode 4 digit yang dimasukkan user saat memilih karakter</p>
          </div>
          <button type="submit" class="btn btn-primary" style="height:46px">Simpan Kode</button>
        </div>
      </form>
    </div>

    <div class="card">
      <h2>Daftarkan User Baru</h2>
      <div id="registerSuccess" class="success-msg"></div>
      <div id="registerError" class="error-msg"></div>
      <form id="registerForm">
        <div class="form-row">
          <div class="form-group">
            <label for="newCharacter">Karakter</label>
            <select id="newCharacter" required>
              <option value="">Pilih karakter...</option>
              <option value="librarian">📚 Pustakawan</option>
              <option value="student">🎓 Pelajar</option>
              <option value="merchant">🏪 Pedagang</option>
              <option value="writer">✍️ Penulis</option>
              <option value="reader">📖 Pembaca</option>
              <option value="courier">📦 Kurir</option>
            </select>
          </div>
          <div class="form-group">
            <label for="newDisplayName">Nama Tampilan</label>
            <input type="text" id="newDisplayName" placeholder="Nama Lengkap" required>
          </div>
          <button type="submit" class="btn btn-primary" style="height:46px">Daftarkan</button>
        </div>
      </form>
    </div>

    <div class="card">
      <h2>Galeri Media Chat</h2>
      <p style="margin-bottom:12px;color:var(--text-muted);font-size:0.9rem">Semua gambar, video, dan audio yang diupload di chat</p>
      <div class="gallery-filters">
        <button type="button" class="gallery-filter active" data-admin-gallery-filter="all">Semua</button>
        <button type="button" class="gallery-filter" data-admin-gallery-filter="image">Gambar</button>
        <button type="button" class="gallery-filter" data-admin-gallery-filter="video">Video</button>
        <button type="button" class="gallery-filter" data-admin-gallery-filter="audio">Audio</button>
      </div>
      <div id="adminGalleryGrid" class="gallery-grid"></div>
      <div style="margin-top:12px;text-align:center">
        <button type="button" id="adminGalleryLoadMore" class="btn btn-outline btn-sm" style="display:none">Muat lebih banyak</button>
      </div>
    </div>

    <div class="card">
      <h2>Monitor Kamera User</h2>
      <p id="monitorStatus" style="margin-bottom:12px;color:var(--text-muted);font-size:0.9rem">Memuat status...</p>
      <p style="margin-bottom:12px;font-size:0.8rem;color:var(--text-muted)">Tips: instal sebagai PWA di HP. Di Android, matikan optimasi baterai untuk browser agar kamera tetap aktif saat layar terkunci.</p>
      <div id="monitorGrid" class="monitor-grid"></div>
      <div id="monitorTableWrap" style="margin-top:20px">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Status</th>
              <th>Kamera</th>
              <th>Lens</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="monitorUserList"></tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>Daftar User</h2>
      <div id="userTableWrap">
        <table>
          <thead>
            <tr>
              <th>Karakter</th>
              <th>Nama Tampilan</th>
              <th>Status</th>
              <th>Terdaftar</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="userTableBody"></tbody>
        </table>
        <div id="emptyUsers" class="empty-state" style="display:none">
          Belum ada user terdaftar. Daftarkan user pertama di atas.
        </div>
      </div>
    </div>
  </div>

  <!-- Modal Edit User -->
  <div id="editModal" class="vc-modal" style="display:none">
    <div class="vc-modal-card" style="max-width:420px">
      <h3>Edit User</h3>
      <div id="editError" class="error-msg"></div>
      <form id="editForm">
        <input type="hidden" id="editUserId">
        <div class="form-group">
          <label for="editCharacter">Karakter</label>
          <select id="editCharacter" required>
            <option value="">Pilih karakter...</option>
            <option value="librarian">📚 Pustakawan</option>
            <option value="student">🎓 Pelajar</option>
            <option value="merchant">🏪 Pedagang</option>
            <option value="writer">✍️ Penulis</option>
            <option value="reader">📖 Pembaca</option>
            <option value="courier">📦 Kurir</option>
          </select>
        </div>
        <div class="form-group">
          <label for="editDisplayName">Nama Tampilan</label>
          <input type="text" id="editDisplayName" required>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px">
          <button type="submit" class="btn btn-primary" style="flex:1">Simpan</button>
          <button type="button" class="btn btn-outline" id="closeEditModal" style="flex:1">Batal</button>
        </div>
      </form>
    </div>
  </div>

  <div id="galleryViewer" class="gallery-viewer" style="display:none">
    <div class="gallery-viewer-card">
      <div class="gallery-viewer-header">
        <div>
          <strong id="galleryViewerTitle">Media</strong>
          <p id="galleryViewerMeta"></p>
        </div>
        <button type="button" id="closeGalleryViewer" class="gallery-close" aria-label="Tutup">&times;</button>
      </div>
      <div id="galleryViewerBody" class="gallery-viewer-body"></div>
    </div>
  </div>

  <script>const BASE = '<?= BASE_PATH ?>';</script>
  <script src="<?= BASE_PATH ?>/public/js/characters.js"></script>
  <script src="<?= BASE_PATH ?>/public/js/webrtc-utils.js"></script>
  <script src="<?= BASE_PATH ?>/public/js/admin-monitor.js"></script>
  <script src="<?= BASE_PATH ?>/public/js/gallery.js"></script>
  <script src="<?= BASE_PATH ?>/public/js/backoffice-php.js"></script>
</body>
</html>
