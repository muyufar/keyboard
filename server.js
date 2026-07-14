const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const JsonDB = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'light-chat-secret-key-2026';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
[dataDir, uploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const db = new JsonDB(path.join(dataDir, 'chat.json'));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|webm|mov|mp3|wav|ogg|m4a|aac/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype.split('/')[1] || '');
    if (ext || mime) cb(null, true);
    else cb(new Error('Tipe file tidak didukung'));
  }
});

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token tidak ditemukan' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token tidak valid' });
  }
}

function adminMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token tidak ditemukan' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) return res.status(403).json({ error: 'Akses ditolak' });
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token tidak valid' });
  }
}

function getMediaType(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'file';
}

const CHARACTERS = {
  librarian: { name: 'Pustakawan', title: 'Ahli buku', color: '#4a90d9' },
  student:   { name: 'Pelajar', title: 'Pencari ilmu', color: '#22c55e' },
  merchant:  { name: 'Pedagang', title: 'Jual beli buku', color: '#f97316' },
  writer:    { name: 'Penulis', title: 'Pena giat', color: '#a855f7' },
  reader:    { name: 'Pembaca', title: 'Kutu buku', color: '#ec4899' },
  courier:   { name: 'Kurir', title: 'Antar pesanan', color: '#ef4444' }
};

// ============ API Routes ============

app.get('/api/characters', (req, res) => {
  const chars = Object.entries(CHARACTERS).map(([id, meta]) => {
    const user = db.findUserByCharacterId(id);
    return {
      id,
      name: meta.name,
      title: meta.title,
      color: meta.color,
      available: !!(user && user.is_active),
      display_name: user ? user.display_name : null
    };
  });
  res.json(chars);
});

app.post('/api/login', (req, res) => {
  const { character_id } = req.body;
  if (!character_id || !CHARACTERS[character_id]) {
    return res.status(400).json({ error: 'Karakter tidak valid' });
  }

  const user = db.findUserByCharacterId(character_id);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Karakter belum tersedia. Hubungi admin.' });
  }

  res.json({
    token: generateToken(user),
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_color: user.avatar_color,
      character_id: user.character_id
    }
  });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = jwt.sign({ isAdmin: true, username }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, username });
  }
  res.status(401).json({ error: 'Kredensial admin salah' });
});

app.get('/api/admin/users', adminMiddleware, (req, res) => {
  const users = db.getAllUsers().map(({ password, ...u }) => u);
  res.json(users);
});

app.post('/api/admin/users', adminMiddleware, (req, res) => {
  const { character_id, display_name } = req.body;
  if (!character_id || !display_name) {
    return res.status(400).json({ error: 'Karakter dan nama tampilan wajib diisi' });
  }
  if (!CHARACTERS[character_id]) {
    return res.status(400).json({ error: 'Karakter tidak valid' });
  }
  if (db.findUserByCharacterId(character_id)) {
    return res.status(409).json({ error: 'Karakter sudah digunakan' });
  }

  const meta = CHARACTERS[character_id];
  const user = db.createUser({
    username: character_id,
    password: bcrypt.hashSync(require('crypto').randomBytes(8).toString('hex'), 10),
    display_name,
    avatar_color: meta.color,
    character_id
  });

  res.status(201).json({
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    avatar_color: user.avatar_color,
    character_id: user.character_id
  });
});

app.patch('/api/admin/users/:id/toggle', adminMiddleware, (req, res) => {
  const user = db.toggleUser(parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  res.json({ id: user.id, is_active: user.is_active });
});

app.put('/api/admin/users/:id', adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const { character_id, display_name } = req.body;

  if (!character_id || !display_name) {
    return res.status(400).json({ error: 'Karakter dan nama tampilan wajib diisi' });
  }
  if (!CHARACTERS[character_id]) {
    return res.status(400).json({ error: 'Karakter tidak valid' });
  }

  const user = db.findUserById(id);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

  const existing = db.findUserByCharacterId(character_id);
  if (existing && existing.id !== id) {
    return res.status(409).json({ error: 'Karakter sudah digunakan user lain' });
  }

  const meta = CHARACTERS[character_id];
  const updated = db.updateUser(id, {
    character_id,
    display_name,
    avatar_color: meta.color
  });

  const { password, ...safe } = updated;
  res.json(safe);
});

app.delete('/api/admin/users/:id', adminMiddleware, (req, res) => {
  db.deleteUser(parseInt(req.params.id));
  res.json({ success: true });
});

app.get('/api/messages', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const before = req.query.before ? parseInt(req.query.before) : null;

  const messages = db.getMessages({ limit, before }).map(msg => db.enrichMessage(msg));

  res.json(messages);
});

app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });

  res.json({
    media_type: getMediaType(req.file.mimetype),
    media_url: '/uploads/' + req.file.filename,
    media_name: req.file.originalname
  });
});

app.get('/api/online', authMiddleware, (req, res) => {
  res.json({ count: onlineUsers.size, users: getOnlineUsersList(req.user.id) });
});

app.delete('/api/messages/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const msg = db.deleteMessage(id, req.user.id);
  if (!msg) return res.status(403).json({ error: 'Pesan tidak ditemukan atau bukan milik Anda' });

  if (msg.media_url) {
    const filename = path.basename(msg.media_url);
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  io.emit('message:deleted', { id });
  res.json({ success: true, id });
});

// ============ Socket.io ============
const onlineUsers = new Map(); // userId -> socketId
const socketUsers = new Map(); // socketId -> userId

function getOnlineUsersList(excludeId) {
  const list = [];
  for (const [userId] of onlineUsers) {
    if (userId === excludeId) continue;
    const user = db.findUserById(userId);
    if (user?.is_active) {
      list.push({
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_color: user.avatar_color
      });
    }
  }
  return list;
}

function emitToUser(userId, event, data) {
  const socketId = onlineUsers.get(userId);
  if (socketId) io.to(socketId).emit(event, data);
}

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user.id;
  onlineUsers.set(userId, socket.id);
  socketUsers.set(socket.id, userId);

  const user = db.findUserById(userId);
  if (user) {
    socket.broadcast.emit('user:online', {
      userId,
      display_name: user.display_name,
      avatar_color: user.avatar_color,
      username: user.username
    });
    const onlineData = { count: onlineUsers.size, users: getOnlineUsersList(userId) };
    io.emit('online:count', onlineData);
    socket.emit('online:count', onlineData);
  }

  socket.on('call:signal', (payload) => {
    const to = parseInt(payload?.to);
    const type = payload?.type;
    if (!to || !type) return;

    const fromUser = db.findUserById(userId);
    emitToUser(to, 'call:signal', {
      from: userId,
      from_name: fromUser?.display_name,
      from_color: fromUser?.avatar_color,
      type,
      data: payload.data || null
    });
  });

  socket.on('message:send', (data) => {
    const { content, media_type, media_url, media_name, reply_to_id } = data;
    if (!content && !media_url) return;

    if (reply_to_id && !db.findMessageById(parseInt(reply_to_id))) return;

    const msg = db.createMessage({
      user_id: userId,
      content,
      media_type,
      media_url,
      media_name,
      reply_to_id: reply_to_id ? parseInt(reply_to_id) : null
    });

    const fullMsg = db.getMessageWithUser(msg.id);
    io.emit('message:new', fullMsg);
  });

  socket.on('message:delete', (data) => {
    const id = parseInt(data?.id);
    if (!id) return;

    const deleted = db.deleteMessage(id, userId);
    if (!deleted) return;

    if (deleted.media_url) {
      const filename = path.basename(deleted.media_url);
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    io.emit('message:deleted', { id });
  });

  socket.on('typing:start', () => {
    const u = db.findUserById(userId);
    socket.broadcast.emit('typing:start', { userId, display_name: u?.display_name });
  });

  socket.on('typing:stop', () => {
    socket.broadcast.emit('typing:stop', { userId });
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    socketUsers.delete(socket.id);
    socket.broadcast.emit('user:offline', { userId });
    io.emit('online:count', { count: onlineUsers.size, users: getOnlineUsersList(userId) });
  });
});

server.listen(PORT, () => {
  console.log(`\n  Pemesanan Buku berjalan di http://localhost:${PORT}`);
  console.log(`  Backoffice: http://localhost:${PORT}/backoffice/`);
  console.log(`  Admin login: ${ADMIN_USER} / ${ADMIN_PASS}\n`);
});
