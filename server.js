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

const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#06b6d4'];

// ============ API Routes ============

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi' });

  const user = db.findUserByUsername(username);
  if (!user || !user.is_active || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  res.json({
    token: generateToken(user),
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_color: user.avatar_color
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
  const { username, password, display_name } = req.body;
  if (!username || !password || !display_name) {
    return res.status(400).json({ error: 'Semua field wajib diisi' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Password minimal 4 karakter' });
  }

  if (db.findUserByUsername(username)) {
    return res.status(409).json({ error: 'Username sudah digunakan' });
  }

  const color = colors[Math.floor(Math.random() * colors.length)];
  const user = db.createUser({
    username,
    password: bcrypt.hashSync(password, 10),
    display_name,
    avatar_color: color
  });

  res.status(201).json({
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    avatar_color: user.avatar_color
  });
});

app.patch('/api/admin/users/:id/toggle', adminMiddleware, (req, res) => {
  const user = db.toggleUser(parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  res.json({ id: user.id, is_active: user.is_active });
});

app.delete('/api/admin/users/:id', adminMiddleware, (req, res) => {
  db.deleteUser(parseInt(req.params.id));
  res.json({ success: true });
});

app.get('/api/messages', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const before = req.query.before ? parseInt(req.query.before) : null;

  const messages = db.getMessages({ limit, before }).map(msg => {
    const user = db.findUserById(msg.user_id);
    return {
      ...msg,
      display_name: user?.display_name,
      avatar_color: user?.avatar_color,
      username: user?.username
    };
  });

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
    const { content, media_type, media_url, media_name } = data;
    if (!content && !media_url) return;

    const msg = db.createMessage({
      user_id: userId,
      content,
      media_type,
      media_url,
      media_name
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
  console.log(`\n  Light Chat berjalan di http://localhost:${PORT}`);
  console.log(`  Backoffice: http://localhost:${PORT}/backoffice/`);
  console.log(`  Admin login: ${ADMIN_USER} / ${ADMIN_PASS}\n`);
});
