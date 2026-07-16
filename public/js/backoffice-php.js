const API = (typeof BASE !== 'undefined' ? BASE : '') + '/api';
let adminToken = null;
let allUsers = [];
let adminMonitor = null;
let adminGallery = null;

const $ = (sel) => document.querySelector(sel);

const adminLogin = $('#adminLogin');
const adminPanel = $('#adminPanel');
const adminLoginForm = $('#adminLoginForm');
const adminError = $('#adminError');
const registerForm = $('#registerForm');
const registerSuccess = $('#registerSuccess');
const registerError = $('#registerError');
const userTableBody = $('#userTableBody');
const emptyUsers = $('#emptyUsers');
const editModal = $('#editModal');
const editForm = $('#editForm');
const editError = $('#editError');
const settingsForm = $('#settingsForm');
const settingsSuccess = $('#settingsSuccess');
const settingsError = $('#settingsError');
const loginCodeSetting = $('#loginCodeSetting');

const CHAR_LABELS = {
  librarian: 'Pustakawan', student: 'Pelajar', merchant: 'Pedagang',
  writer: 'Penulis', reader: 'Pembaca', courier: 'Kurir'
};

function authHeaders() {
  return { Authorization: 'Bearer ' + adminToken };
}

const savedAdminToken = localStorage.getItem('admin_token');
if (savedAdminToken) {
  adminToken = savedAdminToken;
  showPanel();
}

adminLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  adminError.style.display = 'none';

  try {
    const res = await fetch(API + '/admin-login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: $('#adminUser').value.trim(),
        password: $('#adminPass').value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    adminToken = data.token;
    localStorage.setItem('admin_token', adminToken);
    showPanel();
  } catch (err) {
    adminError.textContent = err.message;
    adminError.style.display = 'block';
  }
});

$('#adminLogout').addEventListener('click', () => {
  adminMonitor?.stop();
  adminMonitor = null;
  adminGallery = null;
  localStorage.removeItem('admin_token');
  adminToken = null;
  adminPanel.style.display = 'none';
  adminLogin.style.display = 'flex';
});

function showPanel() {
  adminLogin.style.display = 'none';
  adminPanel.style.display = 'block';
  loadSettings();
  loadUsers();

  if (!adminMonitor) {
    adminMonitor = new AdminCameraMonitor({
      apiBase: API,
      authHeaders: () => authHeaders()
    });
    window.adminMonitor = adminMonitor;
  }
  if (!adminGallery && typeof MediaGallery !== 'undefined') {
    adminGallery = new MediaGallery({
      apiBase: API,
      authHeaders: () => authHeaders(),
      endpoint: '/admin-gallery.php',
      mode: 'inline'
    });
    adminGallery.initInline();
  }

  adminMonitor.start();
}

async function loadSettings() {
  try {
    const res = await fetch(API + '/admin-settings.php', { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    if (loginCodeSetting) loginCodeSetting.value = data.login_code || '';
  } catch (err) {
    console.error('Gagal memuat pengaturan:', err);
  }
}

if (loginCodeSetting) {
  loginCodeSetting.addEventListener('input', () => {
    loginCodeSetting.value = loginCodeSetting.value.replace(/\D/g, '').slice(0, 4);
  });
}

if (settingsForm) {
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    settingsSuccess.style.display = 'none';
    settingsError.style.display = 'none';

    const login_code = loginCodeSetting.value.trim();
    if (!/^\d{4}$/.test(login_code)) {
      settingsError.textContent = 'Kode harus 4 digit angka';
      settingsError.style.display = 'block';
      return;
    }

    try {
      const res = await fetch(API + '/admin-settings.php', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ login_code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      settingsSuccess.textContent = 'Kode akses berhasil disimpan';
      settingsSuccess.style.display = 'block';
    } catch (err) {
      settingsError.textContent = err.message;
      settingsError.style.display = 'block';
    }
  });
}

async function loadUsers() {
  try {
    const res = await fetch(API + '/admin-users.php', { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('admin_token');
      adminToken = null;
      adminPanel.style.display = 'none';
      adminLogin.style.display = 'flex';
      return;
    }
    allUsers = await res.json();
    renderUsers(allUsers);
    updateRegisterCharacterOptions();
  } catch (err) {
    console.error('Gagal memuat user:', err);
  }
}

function getTakenCharacters(excludeUserId = null) {
  return new Set(
    allUsers
      .filter(u => u.character_id && u.id !== excludeUserId)
      .map(u => u.character_id)
  );
}

function updateRegisterCharacterOptions() {
  const taken = getTakenCharacters();
  const select = $('#newCharacter');
  if (!select) return;
  [...select.options].forEach(opt => {
    if (!opt.value) return;
    opt.disabled = taken.has(opt.value);
    const label = CHAR_LABELS[opt.value] || opt.value;
    opt.textContent = taken.has(opt.value) ? `${label} (sudah dipakai)` : label;
  });
}

function renderCharacterCell(user) {
  const charId = user.character_id;
  const label = CHAR_LABELS[charId] || 'Belum ada';
  if (charId && PIXEL_CHARS[charId]) {
    return `<div style="display:flex;align-items:center;gap:8px">
      <div class="pixel-sprite ${PIXEL_CHARS[charId].sprite}" style="transform:scale(0.9);transform-origin:center;width:32px;height:32px;animation:none"></div>
      <strong>${escapeHtml(label)}</strong>
    </div>`;
  }
  return `<div style="display:flex;align-items:center;gap:8px">
    <div class="avatar avatar-sm" style="background:${user.avatar_color}">?</div>
    <span style="color:var(--text-muted)">Belum ada</span>
  </div>`;
}

function renderUsers(users) {
  userTableBody.innerHTML = '';
  if (!users.length) { emptyUsers.style.display = 'block'; return; }
  emptyUsers.style.display = 'none';

  users.forEach(user => {
    const tr = document.createElement('tr');
    const date = new Date(user.created_at);
    const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

    tr.innerHTML = `
      <td>${renderCharacterCell(user)}</td>
      <td>${escapeHtml(user.display_name)}</td>
      <td><span class="badge ${user.is_active ? 'badge-active' : 'badge-inactive'}">${user.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
      <td>${dateStr}</td>
      <td><div class="actions">
        <button class="btn btn-outline btn-sm" onclick="editUser(${user.id})">Edit</button>
        <button class="btn btn-outline btn-sm" onclick="toggleUser(${user.id})">${user.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id}, '${escapeHtml(user.display_name)}')">Hapus</button>
      </div></td>`;
    userTableBody.appendChild(tr);
  });
}

function openEditModal(user) {
  $('#editUserId').value = user.id;
  $('#editDisplayName').value = user.display_name;
  editError.style.display = 'none';

  const taken = getTakenCharacters(user.id);
  const select = $('#editCharacter');
  [...select.options].forEach(opt => {
    if (!opt.value) return;
    opt.disabled = taken.has(opt.value);
  });
  select.value = user.character_id || '';

  editModal.style.display = 'flex';
}

function closeEditModal() {
  editModal.style.display = 'none';
  editForm.reset();
}

$('#closeEditModal').addEventListener('click', closeEditModal);
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeEditModal();
});

function editUser(id) {
  const user = allUsers.find(u => u.id === id);
  if (user) openEditModal(user);
}

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  editError.style.display = 'none';

  const id = $('#editUserId').value;
  const character_id = $('#editCharacter').value;
  const display_name = $('#editDisplayName').value.trim();

  if (!character_id) {
    editError.textContent = 'Pilih karakter terlebih dahulu';
    editError.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(API + '/admin-user.php?id=' + id, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ character_id, display_name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    closeEditModal();
    loadUsers();
  } catch (err) {
    editError.textContent = err.message;
    editError.style.display = 'block';
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  registerSuccess.style.display = 'none';
  registerError.style.display = 'none';

  try {
    const res = await fetch(API + '/admin-users.php', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        character_id: $('#newCharacter').value,
        display_name: $('#newDisplayName').value.trim()
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    registerSuccess.textContent = `Karakter "${CHAR_LABELS[data.character_id] || data.character_id}" (${data.display_name}) berhasil didaftarkan!`;
    registerSuccess.style.display = 'block';
    registerForm.reset();
    loadUsers();
  } catch (err) {
    registerError.textContent = err.message;
    registerError.style.display = 'block';
  }
});

async function toggleUser(id) {
  try {
    const res = await fetch(API + '/admin-user.php?id=' + id, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle' })
    });
    if (!res.ok) throw new Error('Gagal mengubah status');
    loadUsers();
  } catch (err) { alert(err.message); }
}

async function deleteUser(id, name) {
  if (!confirm(`Yakin ingin menghapus user "${name}"?`)) return;
  try {
    const res = await fetch(API + '/admin-user.php?id=' + id, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!res.ok) throw new Error('Gagal menghapus user');
    loadUsers();
  } catch (err) { alert(err.message); }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.toggleUser = toggleUser;
window.deleteUser = deleteUser;
window.editUser = editUser;
