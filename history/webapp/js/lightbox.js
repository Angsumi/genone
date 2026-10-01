// ============================================================================
// Minimal Distraction-Free Lightbox Viewer
// ============================================================================

export class Lightbox {
  constructor() {
    this.el = document.getElementById('lightbox-modal');
    this.imgEl = document.getElementById('lightbox-image');
    this.detailsEl = document.getElementById('lightbox-details');
    this.closeBtn = document.getElementById('lightbox-close');

    if (this.el) {
      this.bindEvents();
    }
  }

  bindEvents() {
    this.closeBtn?.addEventListener('click', () => this.close());
    
    // Close when tapping outside the image
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el || e.target.classList.contains('lightbox-backdrop')) {
        this.close();
      }
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }

  open(photo) {
    if (!this.el) return;

    this.imgEl.src = '';
    this.imgEl.alt = photo.person || photo.place || 'Historic Photograph';
    this.imgEl.src = photo.imageUrl || photo.displayUrl || photo.thumbUrl;

    const metaParts = [];
    if (photo.person) {
      metaParts.push(`<strong>👤 ${escapeHtml(photo.person)}</strong>`);
    }
    if (photo.place) {
      metaParts.push(`<span>📍 ${escapeHtml(photo.place)}</span>`);
    }
    if (photo.year) {
      metaParts.push(`<span>🗓️ ${escapeHtml(photo.year)}</span>`);
    }
    if (photo.uploaderName) {
      metaParts.push(`<span class="uploader-tag">Uploaded by ${escapeHtml(photo.uploaderName)}</span>`);
    }

    let html = `<div class="lightbox-meta-row">${metaParts.join('<span class="meta-sep">•</span>')}</div>`;

    if (photo.story) {
      html += `<p class="lightbox-story">${escapeHtml(photo.story)}</p>`;
    }

    this.detailsEl.innerHTML = html;
    this.el.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  close() {
    if (!this.el) return;
    this.el.classList.remove('active');
    document.body.style.overflow = '';
  }

  isOpen() {
    return this.el?.classList.contains('active');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}
