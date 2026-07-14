<?php require_once __DIR__ . '/../includes/config.php'; ?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Backoffice - Pemesanan Buku</title>
  <link rel="stylesheet" href="<?= BASE_PATH ?>/public/css/style.css">
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

  <script>const BASE = '<?= BASE_PATH ?>';</script>
  <script src="<?= BASE_PATH ?>/public/js/backoffice-php.js"></script>
</body>
</html>
