const PIXEL_CHARS = {
  librarian: { sprite: 'pixel-librarian', name: 'Pustakawan', title: 'Ahli buku' },
  student:   { sprite: 'pixel-student',   name: 'Pelajar',    title: 'Pencari ilmu' },
  merchant:  { sprite: 'pixel-merchant',  name: 'Pedagang',   title: 'Jual beli buku' },
  writer:    { sprite: 'pixel-writer',    name: 'Penulis',    title: 'Pena giat' },
  reader:    { sprite: 'pixel-reader',    name: 'Pembaca',    title: 'Kutu buku' },
  courier:   { sprite: 'pixel-courier',   name: 'Kurir',      title: 'Antar pesanan' }
};

function renderCharacterGrid(characters, container, onSelect) {
  container.innerHTML = '';
  let selectedId = null;

  characters.forEach(ch => {
    const meta = PIXEL_CHARS[ch.id] || {};
    const card = document.createElement('div');
    card.className = 'character-card' + (ch.available ? ' available' : ' locked');
    card.dataset.id = ch.id;

    card.innerHTML = `
      <div class="character-stage">
        <div class="pixel-sprite ${meta.sprite || ''}"></div>
      </div>
      <div class="character-name">${meta.name || ch.name}</div>
      <div class="character-title">${meta.title || ch.title}</div>
      <span class="character-status ${ch.available ? 'available' : 'locked'}">
        ${ch.available ? (ch.display_name || 'Tersedia') : 'Kosong'}
      </span>
    `;

    if (ch.available) {
      card.addEventListener('click', () => {
        container.querySelectorAll('.character-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedId = ch.id;
        onSelect(ch);
      });
    }

    container.appendChild(card);
  });

  return () => selectedId;
}

window.PIXEL_CHARS = PIXEL_CHARS;
window.renderCharacterGrid = renderCharacterGrid;
