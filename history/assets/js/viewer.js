/**
 * Interactive Heritage Archive Photo Viewer
 * Supports Before/After Split Slider, Side-by-Side, Filters, and Fullscreen Lightbox
 */

class HeritageViewer {
  constructor(config) {
    this.dataSource = config.dataSource;
    this.containerId = config.containerId || 'gallery-grid';
    this.collectionName = config.collectionName || 'Archive';
    this.data = null;
    this.currentViewMode = 'slider'; // 'slider', 'side', 'before', 'after'
    this.currentOrientation = 'all';
    this.currentStatus = 'all'; // 'all', 'paired', 'unpaired'
    this.currentSort = 'default';
    this.searchQuery = '';
    this.activeLightboxIndex = -1;
    this.filteredItems = [];
    
    // Lightbox zoom state
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    this.globalVar = config.globalVar;
    this.init();
  }

  async init() {
    try {
      if (this.globalVar && window[this.globalVar]) {
        this.data = window[this.globalVar];
      } else {
        const resp = await fetch(this.dataSource);
        this.data = await resp.json();
      }
      this.renderStats();
      this.bindEvents();
      this.applyFiltersAndRender();
      this.initLightbox();
    } catch (err) {
      console.error('Failed to load dataset:', err);
      const container = document.getElementById(this.containerId);
      if (container) {
        container.innerHTML = `
          <div style="text-align: center; padding: 3rem; color: #ef4444;">
            <h3>Failed to load collection data</h3>
            <p style="color: #94a3b8;">${err.message}</p>
          </div>
        `;
      }
    }
  }

  renderStats() {
    const totalEl = document.getElementById('stat-total-orig');
    const pairedEl = document.getElementById('stat-total-paired');
    const unpairedEl = document.getElementById('stat-total-unpaired');
    const rateEl = document.getElementById('stat-rate');

    if (!this.data) return;

    const total = this.data.total_orig || 0;
    const paired = this.data.total_paired || 0;
    const unpaired = this.data.total_unpaired || 0;
    const rate = total > 0 ? Math.round((paired / total) * 100) : 0;

    if (totalEl) totalEl.textContent = total;
    if (pairedEl) pairedEl.textContent = paired;
    if (unpairedEl) unpairedEl.textContent = unpaired;
    if (rateEl) rateEl.textContent = `${rate}%`;
  }

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.applyFiltersAndRender();
      });
    }

    // View mode buttons
    document.querySelectorAll('[data-view-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-view-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentViewMode = btn.dataset.viewMode;
        this.updateCardViewModes();
      });
    });

    // Orientation filters
    document.querySelectorAll('[data-orientation]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-orientation]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentOrientation = btn.dataset.orientation;
        this.applyFiltersAndRender();
      });
    });

    // Sort select
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        this.applyFiltersAndRender();
      });
    }

    // Grid layout density buttons
    document.querySelectorAll('[data-grid-density]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-grid-density]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const grid = document.getElementById(this.containerId);
        if (grid) {
          grid.classList.remove('compact', 'list');
          if (btn.dataset.gridDensity !== 'normal') {
            grid.classList.add(btn.dataset.gridDensity);
          }
        }
      });
    });

    // Window resize to update card width CSS property for accurate pixel scaling
    window.addEventListener('resize', () => {
      this.updateViewportDimensions();
    });

    // ResizeObserver on grid container
    const grid = document.getElementById(this.containerId);
    if (grid && window.ResizeObserver) {
      new ResizeObserver(() => {
        this.updateViewportDimensions();
      }).observe(grid);
    }
  }

  applyFiltersAndRender() {
    if (!this.data) return;

    // Combine paired and unpaired items based on status
    let items = [];
    if (this.currentStatus === 'all' || this.currentStatus === 'paired') {
      items = items.concat(this.data.pairs || []);
    }
    if (this.currentStatus === 'all' || this.currentStatus === 'unpaired') {
      items = items.concat(this.data.unpaired || []);
    }

    // Filter by orientation
    if (this.currentOrientation !== 'all') {
      items = items.filter(item => item.orientation === this.currentOrientation);
    }

    // Filter by search query
    if (this.searchQuery) {
      items = items.filter(item => {
        const title = (item.title || '').toLowerCase();
        const origFile = (item.orig_file || '').toLowerCase();
        const clearFile = (item.clear_file || '').toLowerCase();
        const id = (item.id || '').toLowerCase();
        return title.includes(this.searchQuery) ||
               origFile.includes(this.searchQuery) ||
               clearFile.includes(this.searchQuery) ||
               id.includes(this.searchQuery);
      });
    }

    // Sort items: preserve restored first, unrestored stacked at end
    if (this.currentSort === 'score-desc') {
      items.sort((a, b) => {
        if (a.is_paired !== b.is_paired) return a.is_paired ? -1 : 1;
        return (b.score || 0) - (a.score || 0);
      });
    } else if (this.currentSort === 'name-asc') {
      items.sort((a, b) => {
        if (a.is_paired !== b.is_paired) return a.is_paired ? -1 : 1;
        return (a.title || '').localeCompare(b.title || '');
      });
    } else if (this.currentSort === 'name-desc') {
      items.sort((a, b) => {
        if (a.is_paired !== b.is_paired) return a.is_paired ? -1 : 1;
        return (b.title || '').localeCompare(a.title || '');
      });
    }

    this.filteredItems = items;
    this.renderGallery();
  }

  renderGallery() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const countEl = document.getElementById('results-count');
    if (countEl) {
      countEl.textContent = `Showing ${this.filteredItems.length} photos`;
    }

    if (this.filteredItems.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: #94a3b8;">
          <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">No matching photographs found</p>
          <p style="font-size: 0.85rem; color: #64748b;">Try adjusting your search query or filters.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.filteredItems.map((item, index) => this.buildCardHtml(item, index)).join('');
    this.attachCardInteractions();
    this.updateCardViewModes();
    this.updateViewportDimensions();
  }

  buildCardHtml(item, index) {
    const isPaired = item.is_paired;
    const aspect = item.clear_aspect || item.orig_aspect || (item.clear_width && item.clear_height ? (item.clear_width / item.clear_height) : 1.333);
    
    if (isPaired) {
      return `
        <div class="comp-card mode-${this.currentViewMode}" data-index="${index}" data-id="${item.id}">
          <div class="card-viewport" data-viewport-idx="${index}" style="aspect-ratio: ${aspect};">
            <div class="slider-after-wrap">
              <img src="${item.clear_thumb}" alt="${this.escapeHtml(item.title)}" class="slider-img after-img" loading="lazy" />
            </div>
            <div class="slider-before-wrap">
              <img src="${item.orig_thumb}" alt="Original: ${item.orig_file}" class="slider-img before-img" loading="lazy" />
            </div>
            <div class="slider-handle">↔</div>
            <div class="viewport-label before">Original</div>
            <div class="viewport-label after">Upscaled</div>
            ${item.is_featured ? `<div class="card-floating-badge">⭐ ${this.escapeHtml(item.featured_tag || 'Featured')}</div>` : ''}
            <div class="card-actions-top-right">
              <button class="card-action-btn share-trigger" title="Share Photo to Social Media" onclick="event.stopPropagation(); window.galleryViewer.toggleShareMenu(event, ${index})">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              </button>
              <button class="card-action-btn" title="Open Fullscreen Lightbox" onclick="event.stopPropagation(); window.galleryViewer.openLightbox(${index})">⛶</button>
            </div>
          </div>
        </div>
      `;
    } else {
      // Unpaired original photo awaiting upscale
      return `
        <div class="comp-card mode-before" data-index="${index}" data-id="${item.id}">
          <div class="card-viewport" data-viewport-idx="${index}" style="aspect-ratio: ${aspect};" onclick="window.galleryViewer.openLightbox(${index})">
            <div class="slider-after-wrap">
              <img src="${item.orig_thumb}" alt="${this.escapeHtml(item.title)}" class="slider-img" loading="lazy" />
            </div>
            <div class="viewport-label before" style="right: auto; left: 0.75rem;">Original</div>
            <div class="card-floating-badge badge-needs-restore">⏳ Still Needs to be Restored</div>
            <div class="card-actions-top-right">
              <button class="card-action-btn share-trigger" title="Share Photo to Social Media" onclick="event.stopPropagation(); window.galleryViewer.toggleShareMenu(event, ${index})">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              </button>
              <button class="card-action-btn" title="Open Fullscreen Lightbox" onclick="event.stopPropagation(); window.galleryViewer.openLightbox(${index})">⛶</button>
            </div>
          </div>
        </div>
      `;
    }
  }

  attachCardInteractions() {
    document.querySelectorAll('.card-viewport').forEach(vp => {
      const idx = parseInt(vp.dataset.viewportIdx, 10);
      const item = this.filteredItems[idx];
      if (!item) return;

      let isMoving = false;
      let startX = 0;
      let hasDragged = false;

      const updatePos = (clientX) => {
        const rect = vp.getBoundingClientRect();
        let pct = ((clientX - rect.left) / rect.width) * 100;
        pct = Math.max(0, Math.min(100, pct));
        vp.style.setProperty('--slider-pos', `${pct}%`);
      };

      vp.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        hasDragged = false;
        if (this.currentViewMode !== 'slider' || !item.is_paired) return;
        isMoving = true;
        updatePos(e.clientX);
      });

      window.addEventListener('mousemove', (e) => {
        if (!isMoving) return;
        if (Math.abs(e.clientX - startX) > 6) hasDragged = true;
        updatePos(e.clientX);
      });

      window.addEventListener('mouseup', (e) => {
        if (isMoving && !hasDragged) {
          this.openLightbox(idx);
        }
        isMoving = false;
      });

      // Touch support
      vp.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        hasDragged = false;
        if (this.currentViewMode !== 'slider' || !item.is_paired) return;
        isMoving = true;
        updatePos(e.touches[0].clientX);
      }, { passive: true });

      window.addEventListener('touchmove', (e) => {
        if (!isMoving) return;
        if (Math.abs(e.touches[0].clientX - startX) > 6) hasDragged = true;
        updatePos(e.touches[0].clientX);
      }, { passive: true });

      window.addEventListener('touchend', (e) => {
        if (isMoving && !hasDragged) {
          this.openLightbox(idx);
        }
        isMoving = false;
      });

      // Click card to open lightbox in non-slider modes or unpaired cards
      vp.addEventListener('click', (e) => {
        if (this.currentViewMode !== 'slider' || !item.is_paired) {
          this.openLightbox(idx);
        }
      });
    });
  }

  updateCardViewModes() {
    document.querySelectorAll('.comp-card').forEach(card => {
      card.classList.remove('mode-slider', 'mode-side', 'mode-before', 'mode-after');
      card.classList.add(`mode-${this.currentViewMode}`);
      const vp = card.querySelector('.card-viewport');
      if (vp) {
        const idx = parseInt(vp.dataset.viewportIdx, 10);
        const item = this.filteredItems[idx];
        if (item) {
          const baseAspect = item.clear_aspect || item.orig_aspect || (item.clear_width ? item.clear_width / item.clear_height : 1.333);
          vp.style.aspectRatio = (this.currentViewMode === 'side' && item.is_paired) ? `${baseAspect * 2}` : `${baseAspect}`;
        }
      }
    });
    this.updateViewportDimensions();
  }

  updateViewportDimensions() {
    requestAnimationFrame(() => {
      document.querySelectorAll('.card-viewport').forEach(vp => {
        const width = vp.offsetWidth;
        if (width > 0) {
          vp.style.setProperty('--card-width', `${width}px`);
        }
      });
    });
  }

  /* Lightbox Methods */
  initLightbox() {
    const backdrop = document.getElementById('lightbox-modal');
    if (!backdrop) return;

    // Close button
    document.getElementById('lb-close')?.addEventListener('click', () => this.closeLightbox());
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.closeLightbox();
    });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (!backdrop.classList.contains('active')) return;
      if (e.key === 'Escape') this.closeLightbox();
      if (e.key === 'ArrowRight') this.nextLightbox();
      if (e.key === 'ArrowLeft') this.prevLightbox();
      if (e.key === ' ') {
        e.preventDefault();
        this.flipLightbox();
      }
    });

    // Share button
    document.getElementById('lb-share-btn')?.addEventListener('click', () => {
      if (this.activeLightboxIndex >= 0 && this.activeLightboxIndex < this.filteredItems.length) {
        this.openShareModal(this.filteredItems[this.activeLightboxIndex]);
      }
    });

    // Next/Prev buttons
    document.getElementById('lb-next')?.addEventListener('click', () => this.nextLightbox());
    document.getElementById('lb-prev')?.addEventListener('click', () => this.prevLightbox());

    // Lightbox Slider interaction
    const lbVp = document.getElementById('lb-viewport');
    if (lbVp) {
      let isMoving = false;
      const updateLbPos = (clientX) => {
        const rect = lbVp.getBoundingClientRect();
        let pct = ((clientX - rect.left) / rect.width) * 100;
        pct = Math.max(0, Math.min(100, pct));
        lbVp.style.setProperty('--lb-pos', `${pct}%`);
      };

      lbVp.addEventListener('mousedown', (e) => {
        isMoving = true;
        updateLbPos(e.clientX);
      });

      window.addEventListener('mousemove', (e) => {
        if (!isMoving) return;
        updateLbPos(e.clientX);
      });

      window.addEventListener('mouseup', () => {
        isMoving = false;
      });

      lbVp.addEventListener('touchstart', (e) => {
        isMoving = true;
        updateLbPos(e.touches[0].clientX);
      }, { passive: true });

      window.addEventListener('touchmove', (e) => {
        if (!isMoving) return;
        updateLbPos(e.touches[0].clientX);
      }, { passive: true });

      window.addEventListener('touchend', () => {
        isMoving = false;
      });
    }
  }

  openLightbox(index) {
    if (index < 0 || index >= this.filteredItems.length) return;
    this.activeLightboxIndex = index;
    const item = this.filteredItems[index];
    const backdrop = document.getElementById('lightbox-modal');
    if (!backdrop || !item) return;

    // Set title and details
    document.getElementById('lb-title').textContent = item.title;
    const subText = item.is_paired
      ? `Original: ${item.orig_file} (${item.orig_width}×${item.orig_height}) &bull; Upscaled (${item.clear_width}×${item.clear_height})`
      : `Original: ${item.orig_file} (${item.orig_width}×${item.orig_height}) &bull; <span style="color:#ef4444;font-weight:700;">⏳ Still Needs to be Restored</span>`;
    document.getElementById('lb-sub').innerHTML = subText;

    // Set download links
    const dlClear = document.getElementById('lb-dl-clear');
    const dlOrig = document.getElementById('lb-dl-orig');
    if (dlClear) {
      if (item.is_paired) {
        dlClear.href = item.clear_path;
        dlClear.style.display = 'inline-flex';
      } else {
        dlClear.style.display = 'none';
      }
    }
    if (dlOrig) {
      dlOrig.href = item.orig_path;
    }

    // Set images
    const afterImg = document.getElementById('lb-after-img');
    const beforeImg = document.getElementById('lb-before-img');
    const beforeWrap = document.getElementById('lb-before-wrap');
    const handle = document.getElementById('lb-handle');

    if (item.is_paired) {
      afterImg.src = item.clear_path;
      beforeImg.src = item.orig_path;
      beforeWrap.style.display = 'block';
      handle.style.display = 'flex';
    } else {
      afterImg.src = item.orig_path;
      beforeWrap.style.display = 'none';
      handle.style.display = 'none';
    }

    const lbVp = document.getElementById('lb-viewport');
    if (lbVp) {
      lbVp.style.setProperty('--lb-pos', '50%');
    }

    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  toggleShareMenu(event, index) {
    if (index < 0 || index >= this.filteredItems.length) return;
    const item = this.filteredItems[index];
    this.openShareModal(item);
  }

  getShareData(item) {
    const isPaired = item.is_paired;
    const title = item.title || 'Historic Photograph';
    const collName = this.collectionName ? `${this.collectionName} Household Archive` : 'Heritage Archive';
    
    // Resolve absolute image URL
    const relativeImg = isPaired ? (item.clear_path || item.clear_thumb) : (item.orig_path || item.orig_thumb);
    const absImgUrl = new URL(relativeImg, window.location.href).href;
    const pageUrl = window.location.href.split('#')[0] + (item.id ? `#photo-${item.id}` : '');
    
    const text = `Explore this historic photograph from the ${collName} (${title}) — Rangachakua Local History Project & GenOne Archives.`;
    
    return {
      title: `${title} — ${collName} | GenOne History`,
      text: text,
      url: pageUrl,
      imageUrl: absImgUrl,
      item: item
    };
  }

  async shareNative(item) {
    const data = this.getShareData(item);
    if (navigator.share) {
      try {
        // Try sharing file if Web Share API level 2 file sharing supported
        let shared = false;
        if (navigator.canShare) {
          try {
            const resp = await fetch(data.imageUrl);
            const blob = await resp.blob();
            const filename = data.imageUrl.substring(data.imageUrl.lastIndexOf('/') + 1) || 'photo.jpg';
            const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: data.title,
                text: `${data.text}\n${data.url}`,
                files: [file]
              });
              shared = true;
            }
          } catch (e) {
            console.log('File share fallback to url/text share:', e);
          }
        }
        
        if (!shared) {
          await navigator.share({
            title: data.title,
            text: data.text,
            url: data.url
          });
        }
        this.closeShareModal();
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Native share failed:', err);
        }
      }
    }
    this.openShareModal(item);
  }

  openShareModal(item) {
    let modal = document.getElementById('heritage-share-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'heritage-share-modal';
      modal.className = 'share-modal-backdrop';
      modal.innerHTML = `
        <div class="share-modal-card">
          <div class="share-modal-header">
            <div class="share-modal-title">Share Photograph</div>
            <button class="share-modal-close" id="share-modal-close-btn" title="Close">✕</button>
          </div>
          <div class="share-preview-box">
            <img id="share-preview-img" src="" alt="Share Preview" />
            <div class="share-preview-info">
              <div class="share-preview-title" id="share-preview-title">Photo Title</div>
              <div class="share-preview-desc" id="share-preview-desc">Text summary</div>
            </div>
          </div>
          <div class="share-platforms-grid">
            <button class="share-btn share-btn-whatsapp" id="share-whatsapp">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-5.805 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
              <span>WhatsApp</span>
            </button>
            <button class="share-btn share-btn-facebook" id="share-facebook">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              <span>Facebook</span>
            </button>
            <button class="share-btn share-btn-twitter" id="share-twitter">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              <span>X (Twitter)</span>
            </button>
            <button class="share-btn share-btn-telegram" id="share-telegram">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
              <span>Telegram</span>
            </button>
            <button class="share-btn share-btn-pinterest" id="share-pinterest">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345-.09.375-.291 1.199-.332 1.365-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 12-5.373 12-12 0-6.628-5.393-12-12-12z"/></svg>
              <span>Pinterest</span>
            </button>
            <button class="share-btn share-btn-copy" id="share-copy-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              <span id="share-copy-text">Copy Link</span>
            </button>
          </div>
          <div class="share-direct-actions">
            <a id="share-download-img" href="#" download class="share-btn-action">
              <span>⬇</span> Download Photo
            </a>
            <button class="share-btn-action" id="share-native-btn" style="display: none;">
              <span>📱</span> More Options (Apps)
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeShareModal();
      });
      document.getElementById('share-modal-close-btn').addEventListener('click', () => this.closeShareModal());
    }

    const data = this.getShareData(item);
    const prevImg = document.getElementById('share-preview-img');
    const prevTitle = document.getElementById('share-preview-title');
    const prevDesc = document.getElementById('share-preview-desc');
    const dlBtn = document.getElementById('share-download-img');
    const nativeBtn = document.getElementById('share-native-btn');
    const copyText = document.getElementById('share-copy-text');

    if (prevImg) prevImg.src = data.imageUrl;
    if (prevTitle) prevTitle.textContent = data.item.title;
    if (prevDesc) prevDesc.textContent = `${this.collectionName} Collection • ${data.item.orig_file}`;
    if (dlBtn) dlBtn.href = data.imageUrl;
    if (copyText) copyText.textContent = 'Copy Link';

    if (navigator.share && nativeBtn) {
      nativeBtn.style.display = 'inline-flex';
      nativeBtn.onclick = () => {
        this.shareNative(item);
      };
    } else if (nativeBtn) {
      nativeBtn.style.display = 'none';
    }

    // Bind platform clicks
    const encodedUrl = encodeURIComponent(data.url);
    const encodedText = encodeURIComponent(`${data.text}\n${data.url}`);
    const encodedTitle = encodeURIComponent(data.title);
    const encodedImg = encodeURIComponent(data.imageUrl);

    // WhatsApp (Web/App)
    const btnWa = document.getElementById('share-whatsapp');
    if (btnWa) {
      btnWa.onclick = () => {
        window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank', 'noopener,noreferrer');
      };
    }

    // Facebook Share
    const btnFb = document.getElementById('share-facebook');
    if (btnFb) {
      btnFb.onclick = () => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`, '_blank', 'noopener,noreferrer,width=600,height=500');
      };
    }

    // X (Twitter)
    const btnTw = document.getElementById('share-twitter');
    if (btnTw) {
      btnTw.onclick = () => {
        window.open(`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`, '_blank', 'noopener,noreferrer,width=600,height=400');
      };
    }

    // Telegram
    const btnTg = document.getElementById('share-telegram');
    if (btnTg) {
      btnTg.onclick = () => {
        window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`, '_blank', 'noopener,noreferrer');
      };
    }

    // Pinterest (Passes direct image URL and description)
    const btnPin = document.getElementById('share-pinterest');
    if (btnPin) {
      btnPin.onclick = () => {
        window.open(`https://pinterest.com/pin/create/button/?url=${encodedUrl}&media=${encodedImg}&description=${encodedTitle}`, '_blank', 'noopener,noreferrer,width=750,height=600');
      };
    }

    // Copy Link button
    const btnCopy = document.getElementById('share-copy-link');
    if (btnCopy) {
      btnCopy.onclick = async () => {
        try {
          await navigator.clipboard.writeText(`${data.title}\n${data.url}`);
          if (copyText) copyText.textContent = '✓ Copied!';
          setTimeout(() => { if (copyText) copyText.textContent = 'Copy Link'; }, 2000);
        } catch (e) {
          const input = document.createElement('input');
          input.value = data.url;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          document.body.removeChild(input);
          if (copyText) copyText.textContent = '✓ Copied!';
          setTimeout(() => { if (copyText) copyText.textContent = 'Copy Link'; }, 2000);
        }
      };
    }

    modal.classList.add('active');
  }

  closeShareModal() {
    const modal = document.getElementById('heritage-share-modal');
    if (modal) modal.classList.remove('active');
  }

  closeLightbox() {
    const backdrop = document.getElementById('lightbox-modal');
    if (backdrop) backdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  nextLightbox() {
    if (this.filteredItems.length === 0) return;
    const nextIdx = (this.activeLightboxIndex + 1) % this.filteredItems.length;
    this.openLightbox(nextIdx);
  }

  prevLightbox() {
    if (this.filteredItems.length === 0) return;
    const prevIdx = (this.activeLightboxIndex - 1 + this.filteredItems.length) % this.filteredItems.length;
    this.openLightbox(prevIdx);
  }

  flipLightbox() {
    const lbVp = document.getElementById('lb-viewport');
    if (!lbVp) return;
    const current = lbVp.style.getPropertyValue('--lb-pos') || '50%';
    lbVp.style.setProperty('--lb-pos', current === '0%' ? '100%' : (current === '100%' ? '50%' : '0%'));
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.HeritageViewer = HeritageViewer;
