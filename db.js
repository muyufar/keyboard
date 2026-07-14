const fs = require('fs');
const path = require('path');

class JsonDB {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { users: [], messages: [], deleted_messages: [], _counters: { users: 0, messages: 0 } };
    this._load();
  }

  _load() {
    if (fs.existsSync(this.filePath)) {
      try {
        this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        if (!this.data._counters) this.data._counters = { users: 0, messages: 0 };
      } catch {
        this._save();
      }
    } else {
      this._save();
    }
  }

  _save() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  // Users
  findUserByUsername(username) {
    return this.data.users.find(u => u.username === username) || null;
  }

  findUserById(id) {
    return this.data.users.find(u => u.id === id) || null;
  }

  getAllUsers() {
    return [...this.data.users].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  createUser({ username, password, display_name, avatar_color }) {
    const user = {
      id: ++this.data._counters.users,
      username,
      password,
      display_name,
      avatar_color,
      is_active: 1,
      created_at: new Date().toISOString()
    };
    this.data.users.push(user);
    this._save();
    return user;
  }

  toggleUser(id) {
    const user = this.findUserById(id);
    if (!user) return null;
    user.is_active = user.is_active ? 0 : 1;
    this._save();
    return user;
  }

  deleteUser(id) {
    this.data.messages = this.data.messages.filter(m => m.user_id !== id);
    this.data.users = this.data.users.filter(u => u.id !== id);
    this._save();
  }

  // Messages
  createMessage({ user_id, content, media_type, media_url, media_name, reply_to_id }) {
    const msg = {
      id: ++this.data._counters.messages,
      user_id,
      content: content || null,
      media_type: media_type || null,
      media_url: media_url || null,
      media_name: media_name || null,
      reply_to_id: reply_to_id || null,
      created_at: new Date().toISOString()
    };
    this.data.messages.push(msg);
    this._save();
    return msg;
  }

  getMessages({ limit = 50, before = null } = {}) {
    let msgs = [...this.data.messages];
    if (before) msgs = msgs.filter(m => m.id < before);
    msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return msgs.slice(-limit);
  }

  getMessageWithUser(id) {
    const msg = this.findMessageById(id);
    return msg ? this.enrichMessage(msg) : null;
  }

  enrichMessage(msg) {
    const user = this.findUserById(msg.user_id);
    const result = {
      ...msg,
      display_name: user?.display_name,
      avatar_color: user?.avatar_color,
      username: user?.username
    };

    if (msg.reply_to_id) {
      const replyMsg = this.findMessageById(msg.reply_to_id);
      if (replyMsg) {
        const replyUser = this.findUserById(replyMsg.user_id);
        result.reply_to = {
          id: replyMsg.id,
          user_id: replyMsg.user_id,
          display_name: replyUser?.display_name || 'User',
          content: replyMsg.content,
          media_type: replyMsg.media_type,
          media_name: replyMsg.media_name
        };
      }
    }

    return result;
  }

  findMessageById(id) {
    return this.data.messages.find(m => m.id === id) || null;
  }

  deleteMessage(id, userId) {
    const msg = this.findMessageById(id);
    if (!msg || msg.user_id !== userId) return null;

    this.data.messages = this.data.messages.filter(m => m.id !== id);
    if (!this.data.deleted_messages) this.data.deleted_messages = [];
    if (!this.data.deleted_messages.includes(id)) {
      this.data.deleted_messages.push(id);
    }
    this._save();
    return msg;
  }
}

module.exports = JsonDB;
