const EMOJI_CATEGORIES = [
  {
    id: 'smile',
    label: '😀',
    title: 'Emotikon',
    items: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
      '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘',
      '😋', '😛', '😜', '🤪', '😎', '🤔', '😏', '😌',
      '😢', '😭', '😤', '😡', '🥺', '😱', '😴', '🤗'
    ]
  },
  {
    id: 'book',
    label: '📚',
    title: 'Buku & Pesanan',
    items: [
      '📚', '📖', '📝', '✍️', '📦', '🛒', '🛍️', '💰',
      '💳', '🧾', '📋', '✅', '❌', '⏳', '🔔', '📌',
      '🏪', '🎓', '📬', '📭', '🚚', '🏷️', '🔖', '📎'
    ]
  },
  {
    id: 'gesture',
    label: '👋',
    title: 'Gestur',
    items: [
      '👋', '👍', '👎', '👏', '🙏', '🤝', '💪', '✌️',
      '🤞', '🤙', '👌', '🫶', '💅', '🙌', '🤷', '🙋',
      '👀', '💬', '💭', '🗨️', '🎉', '🎊', '🎁', '🌟'
    ]
  },
  {
    id: 'heart',
    label: '❤️',
    title: 'Simbol',
    items: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '💯', '🔥', '⭐', '✨', '💫', '⚡', '☀️', '🌙',
      '☁️', '🌈', '☔', '❄️', '🌸', '🍀', '🎯', '💡'
    ]
  },
  {
    id: 'special',
    label: '★',
    title: 'Karakter Khusus',
    items: [
      '★', '☆', '♥', '♡', '✓', '✗', '→', '←',
      '↑', '↓', '•', '…', '©', '®', '™', '°',
      '±', '×', '÷', '∞', '※', '✦', '✧', '¶',
      ':)', ':(', ':D', ';)', ':P', '<3', '^_^', 'T_T'
    ]
  }
];

function insertAtCursor(textarea, text) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  textarea.value = value.slice(0, start) + text + value.slice(end);
  const pos = start + text.length;
  textarea.selectionStart = textarea.selectionEnd = pos;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
}

function isMostlyEmoji(text) {
  if (!text) return false;
  const stripped = text.replace(/[\s\u200d\ufe0f]/g, '');
  if (!stripped) return false;
  const emojiPattern = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u;
  let emojiCount = 0;
  for (const ch of stripped) {
    if (emojiPattern.test(ch)) emojiCount++;
  }
  return emojiCount / stripped.length >= 0.6;
}

function initEmojiPicker({ button, panel, input }) {
  if (!button || !panel || !input) return;

  let activeCategory = EMOJI_CATEGORIES[0].id;

  function render() {
    const tabs = EMOJI_CATEGORIES.map(cat =>
      `<button type="button" class="emoji-tab${cat.id === activeCategory ? ' active' : ''}" data-cat="${cat.id}" title="${cat.title}">${cat.label}</button>`
    ).join('');

    const cat = EMOJI_CATEGORIES.find(c => c.id === activeCategory);
    const items = (cat?.items || []).map(item =>
      `<button type="button" class="emoji-item" data-char="${item.replace(/"/g, '&quot;')}">${item}</button>`
    ).join('');

    panel.innerHTML = `
      <div class="emoji-picker-header">
        <span>${cat?.title || 'Emoji'}</span>
        <button type="button" class="emoji-picker-close" aria-label="Tutup">&times;</button>
      </div>
      <div class="emoji-tabs">${tabs}</div>
      <div class="emoji-grid">${items}</div>
    `;

    panel.querySelector('.emoji-picker-close').addEventListener('click', close);
    panel.querySelectorAll('.emoji-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeCategory = tab.dataset.cat;
        render();
      });
    });
    panel.querySelectorAll('.emoji-item').forEach(item => {
      item.addEventListener('click', () => {
        insertAtCursor(input, item.dataset.char);
      });
    });
  }

  function open() {
    render();
    panel.style.display = 'block';
  }

  function close() {
    panel.style.display = 'none';
  }

  function toggle() {
    if (panel.style.display === 'block') close();
    else open();
  }

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== button) close();
  });
}
