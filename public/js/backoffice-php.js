const API = (typeof BASE !== 'undefined' ? BASE : '') + '/api';
let adminToken = null;

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
  localStorage.removeItem('admin_token');
  adminToken = null;
  adminPanel.style.display = 'none';
  adminLogin.style.display = 'flex';
});

function showPanel() {
  adminLogin.style.display = 'none';
  adminPanel.style.display = 'block';
  loadUsers();
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
    renderUsers(await res.json());
  } catch (err) {
    console.error('Gagal memuat user:', err);
  }
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
      <td><div style="display:flex;align-items:center;gap:8px">
        <div class="avatar avatar-sm" style="background:${user.avatar_color}">${(CHAR_LABELS[user.character_id] || user.display_name).charAt(0).toUpperCase()}</div>
        <strong>${escapeHtml(CHAR_LABELS[user.character_id] || user.character_id || '-')}</strong>
      </div></td>
      <td>${escapeHtml(user.display_name)}</td>
      <td><span class="badge ${user.is_active ? 'badge-active' : 'badge-inactive'}">${user.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
      <td>${dateStr}</td>
      <td><div class="actions">
        <button class="btn btn-outline btn-sm" onclick="toggleUser(${user.id})">${user.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')">Hapus</button>
      </div></td>`;
    userTableBody.appendChild(tr);
  });
}

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
      headers: authHeaders()
    });
    if (!res.ok) throw new Error('Gagal mengubah status');
    loadUsers();
  } catch (err) { alert(err.message); }
}

async function deleteUser(id, username) {
  if (!confirm(`Yakin ingin menghapus user "${username}"?`)) return;
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
