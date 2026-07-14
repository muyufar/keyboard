const API = '';
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

// Check existing admin session
const savedAdminToken = localStorage.getItem('admin_token');
if (savedAdminToken) {
  adminToken = savedAdminToken;
  showPanel();
}

// Admin login
adminLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  adminError.style.display = 'none';

  const username = $('#adminUser').value.trim();
  const password = $('#adminPass').value;

  try {
    const res = await fetch(API + '/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
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

// Admin logout
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
    const res = await fetch(API + '/api/admin/users', {
      headers: { Authorization: 'Bearer ' + adminToken }
    });

    if (res.status === 401) {
      localStorage.removeItem('admin_token');
      adminToken = null;
      adminPanel.style.display = 'none';
      adminLogin.style.display = 'flex';
      return;
    }

    const users = await res.json();
    renderUsers(users);
  } catch (err) {
    console.error('Gagal memuat user:', err);
  }
}

function renderUsers(users) {
  userTableBody.innerHTML = '';

  if (users.length === 0) {
    emptyUsers.style.display = 'block';
    return;
  }

  emptyUsers.style.display = 'none';

  users.forEach(user => {
    const tr = document.createElement('tr');
    const date = new Date(user.created_at + (user.created_at.includes('Z') ? '' : 'Z'));
    const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="avatar avatar-sm" style="background:${user.avatar_color}">${user.display_name.charAt(0).toUpperCase()}</div>
          <strong>${escapeHtml(user.username)}</strong>
        </div>
      </td>
      <td>${escapeHtml(user.display_name)}</td>
      <td>
        <span class="badge ${user.is_active ? 'badge-active' : 'badge-inactive'}">
          ${user.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>
      <td>${dateStr}</td>
      <td>
        <div class="actions">
          <button class="btn btn-outline btn-sm" onclick="toggleUser(${user.id})">
            ${user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')">Hapus</button>
        </div>
      </td>
    `;
    userTableBody.appendChild(tr);
  });
}

// Register user
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  registerSuccess.style.display = 'none';
  registerError.style.display = 'none';

  const username = $('#newUsername').value.trim();
  const password = $('#newPassword').value;
  const display_name = $('#newDisplayName').value.trim();

  try {
    const res = await fetch(API + '/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + adminToken
      },
      body: JSON.stringify({ username, password, display_name })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    registerSuccess.textContent = `User "${data.display_name}" (@${data.username}) berhasil didaftarkan!`;
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
    const res = await fetch(API + `/api/admin/users/${id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + adminToken }
    });
    if (!res.ok) throw new Error('Gagal mengubah status');
    loadUsers();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteUser(id, username) {
  if (!confirm(`Yakin ingin menghapus user "${username}"? Semua pesannya juga akan dihapus.`)) return;

  try {
    const res = await fetch(API + `/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + adminToken }
    });
    if (!res.ok) throw new Error('Gagal menghapus user');
    loadUsers();
  } catch (err) {
    alert(err.message);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.toggleUser = toggleUser;
window.deleteUser = deleteUser;
