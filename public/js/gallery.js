class MediaGallery {
  constructor({ apiBase, authHeaders, endpoint = '/gallery.php', mode = 'modal' }) {
    this.api = apiBase;
    this.authHeaders = authHeaders;
    this.endpoint = endpoint;
    this.mode = mode;
    this.items = [];
    this.filter = 'all';
    this.hasMore = false;
    this.loading = false;
    this.before = null;

    this.modal = document.getElementById('galleryModal');
    this.grid = document.getElementById('galleryGrid');
    this.viewer = document.getElementById('galleryViewer');
    this.emptyEl = document.getElementById('galleryEmpty');
    this.loadMoreBtn = document.getElementById('galleryLoadMore');
    this.inlineGrid = document.getElementById('adminGalleryGrid');

    this.bindUI();
  }

  bindUI() {
    document.getElementById('galleryBtn')?.addEventListener('click', () => this.open());
    document.getElementById('closeGallery')?.addEventListener('click', () => this.close());
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    document.querySelectorAll('[data-gallery-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.filter = btn.dataset.galleryFilter || 'all';
        document.querySelectorAll('[data-gallery-filter]').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
        this.resetAndLoad();
      });
    });

    this.loadMoreBtn?.addEventListener('click', () => this.loadMore());

    document.getElementById('closeGalleryViewer')?.addEventListener('click', () => this.closeViewer());
    this.viewer?.addEventListener('click', (e) => {
      if (e.target === this.viewer) this.closeViewer();
    });

    document.querySelectorAll('[data-admin-gallery-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.filter = btn.dataset.adminGalleryFilter || 'all';
        document.querySelectorAll('[data-admin-gallery-filter]').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
        this.resetAndLoad();
      });
    });

    document.getElementById('adminGalleryLoadMore')?.addEventListener('click', () => this.loadMore());
  }

  open() {
    if (!this.modal) return;
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    this.resetAndLoad();
  }

  close() {
    if (!this.modal) return;
    this.modal.style.display = 'none';
    document.body.style.overflow = '';
    this.closeViewer();
  }

  initInline() {
    if (!this.inlineGrid) return;
    this.mode = 'inline';
    this.resetAndLoad();
  }

  resetAndLoad() {
    this.items = [];
    this.before = null;
    this.hasMore = false;
    const target = this.getGridEl();
    if (target) target.innerHTML = '';
    this.loadMore(true);
  }

  getGridEl() {
    return this.mode === 'inline' ? this.inlineGrid : this.grid;
  }

  async loadMore(reset = false) {
    if (this.loading) return;
    if (!reset && !this.hasMore) return;

    this.loading = true;
    if (this.loadMoreBtn) this.loadMoreBtn.disabled = true;
    const adminBtn = document.getElementById('adminGalleryLoadMore');
    if (adminBtn) adminBtn.disabled = true;

    try {
      let url = this.api + this.endpoint + '?limit=40';
      if (this.filter !== 'all') url += '&type=' + encodeURIComponent(this.filter);
      if (this.before) url += '&before=' + this.before;

      const res = await fetch(url, { headers: this.authHeaders(), cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal memuat galeri');

      const data = await res.json();
      const batch = data.items || [];

      if (reset) {
        this.items = batch;
      } else {
        this.items = this.items.concat(batch);
      }

      this.hasMore = !!data.has_more && batch.length > 0;
      if (batch.length) {
        this.before = batch[batch.length - 1].id;
      }

      this.render();
    } catch (err) {
      console.error('Galeri error:', err);
      const target = this.getGridEl();
      if (target && !this.items.length) {
        target.innerHTML = '<p class="gallery-empty-msg">Gagal memuat galeri. Coba lagi.</p>';
      }
    } finally {
      this.loading = false;
      if (this.loadMoreBtn) {
        this.loadMoreBtn.disabled = !this.hasMore;
        this.loadMoreBtn.style.display = this.hasMore ? 'block' : 'none';
      }
      if (adminBtn) {
        adminBtn.disabled = !this.hasMore;
        adminBtn.style.display = this.hasMore ? 'inline-flex' : 'none';
      }
    }
  }

  render() {
    const target = this.getGridEl();
    if (!target) return;

    if (!this.items.length) {
      target.innerHTML = '<p class="gallery-empty-msg">Belum ada media diupload.</p>';
      if (this.emptyEl) this.emptyEl.style.display = 'block';
      return;
    }

    if (this.emptyEl) this.emptyEl.style.display = 'none';

    target.innerHTML = this.items.map((item) => this.renderItem(item)).join('');

    target.querySelectorAll('.gallery-item').forEach((el) => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.id, 10);
        const item = this.items.find((i) => i.id === id);
        if (item) this.openViewer(item);
      });
    });
  }

  renderItem(item) {
    const date = this.formatDate(item.created_at);
    let thumb = '';

    if (item.media_type === 'image') {
      thumb = `<img src="${this.escapeAttr(item.media_url)}" alt="${this.escapeAttr(item.media_name)}" loading="lazy">`;
    } else if (item.media_type === 'video') {
      thumb = `<video src="${this.escapeAttr(item.media_url)}" muted preload="metadata"></video><span class="gallery-type-badge">▶ Video</span>`;
    } else if (item.media_type === 'audio') {
      thumb = `<div class="gallery-audio-thumb">🎵</div><span class="gallery-type-badge">Audio</span>`;
    } else {
      thumb = `<div class="gallery-audio-thumb">📎</div>`;
    }

    return `
      <div class="gallery-item" data-id="${item.id}">
        <div class="gallery-item-thumb">${thumb}</div>
        <div class="gallery-item-meta">
          <span class="gallery-item-name">${this.escapeHtml(item.display_name)}</span>
          <span class="gallery-item-date">${date}</span>
        </div>
      </div>`;
  }

  openViewer(item) {
    if (!this.viewer) {
      if (item.media_type === 'image' && window.openLightbox) {
        window.openLightbox(item.media_url);
      }
      return;
    }

    const body = document.getElementById('galleryViewerBody');
    const title = document.getElementById('galleryViewerTitle');
    const meta = document.getElementById('galleryViewerMeta');

    if (title) title.textContent = item.media_name || 'Media';
    if (meta) {
      meta.textContent = `${item.display_name} · ${this.formatDate(item.created_at)}`;
    }

    if (!body) return;

    if (item.media_type === 'image') {
      body.innerHTML = `<img src="${this.escapeAttr(item.media_url)}" alt="${this.escapeAttr(item.media_name)}">`;
    } else if (item.media_type === 'video') {
      body.innerHTML = `<video controls autoplay playsinline src="${this.escapeAttr(item.media_url)}"></video>`;
    } else if (item.media_type === 'audio') {
      body.innerHTML = `<audio controls autoplay src="${this.escapeAttr(item.media_url)}"></audio>`;
    } else {
      body.innerHTML = `<a href="${this.escapeAttr(item.media_url)}" target="_blank" rel="noopener" class="btn btn-primary">Buka file</a>`;
    }

    this.viewer.style.display = 'flex';
  }

  closeViewer() {
    if (!this.viewer) return;
    const body = document.getElementById('galleryViewerBody');
    if (body) {
      body.querySelector('video')?.pause();
      body.querySelector('audio')?.pause();
      body.innerHTML = '';
    }
    this.viewer.style.display = 'none';
  }

  formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  escapeAttr(text) {
    return this.escapeHtml(text).replace(/"/g, '&quot;');
  }
}

window.MediaGallery = MediaGallery;
