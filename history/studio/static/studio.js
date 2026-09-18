/**
 * Rangachakua Heritage Restorer Studio Client
 * Supports: Side-by-Side Comparison, Split Slider, Changing Scope, One-Click Confirm
 */

let currentUploadData = null;
let currentComparisonMode = 'side'; // 'side' or 'slider'
let currentScope = 'all'; // 'all', 'unrestored', 'paired', 'das', 'upadhyaya'
let currentTab = 'unrestored';
let databaseCache = { unrestored: [], paired: [] };

document.addEventListener('DOMContentLoaded', () => {
  initDropzone();
  loadDatabase();
});

function initDropzone() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');

  ['dragenter', 'dragover'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  });
}

async function handleFiles(files) {
  const file = files[0];
  showToast(`Uploading & correlating ${file.name}...`);

  const formData = new FormData();
  formData.append('image', file);
  formData.append('scope', currentScope);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      alert('Error uploading image: ' + (data.error || 'Server error'));
      return;
    }
    renderActiveSession(data);
  } catch (err) {
    alert('Upload failed: ' + err.message);
  }
}

function setComparisonMode(mode) {
  currentComparisonMode = mode;
  document.getElementById('btnModeSide').classList.toggle('active', mode === 'side');
  document.getElementById('btnModeSlider').classList.toggle('active', mode === 'slider');
  
  if (currentUploadData) {
    renderMatchCards(currentUploadData);
  }
}

async function changeScope(scope) {
  currentScope = scope;
  document.querySelectorAll('[data-scope]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scope === scope);
  });

  if (!currentUploadData) return;

  showToast(`Re-correlating with scope: ${scope}...`);

  try {
    const res = await fetch('/api/recorrelate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploaded_file: currentUploadData.uploaded_file,
        scope: currentScope
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      alert('Recorrelation failed: ' + (data.error || 'Server error'));
      return;
    }
    currentUploadData.matches = data.matches;
    renderMatchCards(currentUploadData);
  } catch (err) {
    alert('Error changing scope: ' + err.message);
  }
}

function renderActiveSession(data) {
  currentUploadData = data;
  const session = document.getElementById('activeSession');
  session.style.display = 'block';
  session.scrollIntoView({ behavior: 'smooth' });

  document.getElementById('activeUploadName').textContent = data.orig_filename;
  document.getElementById('activeUploadDims').textContent = `${data.width} × ${data.height} px (${data.aspect} aspect)`;

  renderMatchCards(data);
}

function renderMatchCards(data) {
  const container = document.getElementById('matchesGrid');
  container.innerHTML = '';

  if (!data.matches || data.matches.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; color: #94A3B8;">
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">No candidates found in current scope (${currentScope}).</p>
        <p style="font-size: 0.85rem; color: #64748B;">Try selecting "All Photos" or picking an original manually from the archive below.</p>
      </div>
    `;
    return;
  }

  data.matches.forEach((m, idx) => {
    const card = document.createElement('div');
    card.className = `match-item-card ${idx === 0 ? 'top-rank' : ''}`;
    const aspect = data.aspect || 1.33;

    let compHtml = '';
    if (currentComparisonMode === 'side') {
      // True Side-by-Side Comparison
      compHtml = `
        <div class="studio-comp-viewport mode-side" style="aspect-ratio: ${aspect * 2};">
          <div class="side-col">
            <img src="/${m.thumb_rel || m.rel_path}" alt="Original: ${m.filename}">
            <div class="studio-badge-label left">Original: ${m.filename}</div>
          </div>
          <div class="side-col">
            <img src="${data.uploaded_url}" alt="New Upscale">
            <div class="studio-badge-label right">New Upscale</div>
          </div>
        </div>
      `;
    } else {
      // Split Comparison Slider
      compHtml = `
        <div class="studio-comp-viewport mode-slider" style="aspect-ratio: ${aspect};" data-idx="${idx}">
          <img src="${data.uploaded_url}" class="studio-comp-img after" alt="New Upscale">
          <div class="studio-comp-before-wrap" style="--pos: 50%;">
            <img src="/${m.thumb_rel || m.rel_path}" class="studio-comp-img before" alt="Original: ${m.filename}">
          </div>
          <div class="studio-comp-handle">↔</div>
          <div class="studio-badge-label left">Original: ${m.filename}</div>
          <div class="studio-badge-label right">New Upscale</div>
        </div>
      `;
    }

    card.innerHTML = `
      ${compHtml}
      
      <div class="match-body">
        <div>
          <div class="match-meta-row">
            <span class="match-score-pill ${m.confidence < 60 ? 'low' : ''}">
              ${idx === 0 ? '⭐ Best Match: ' : ''}${m.confidence}% Confidence (Score: ${m.score})
            </span>
            <span style="font-size: 0.75rem; text-transform: uppercase; color: #94A3B8; font-weight: 700;">
              ${m.collection} &bull; ${m.status}
            </span>
          </div>
          <div class="match-details">
            <strong>Target:</strong> ${m.filename}<br>
            <strong>Dimensions:</strong> ${m.width} × ${m.height} px<br>
            <strong>Status:</strong> ${m.status === 'unrestored' ? '⏳ Awaiting Upscale' : '🔄 Already Paired (Correction)'}
            ${m.rotation !== 0 ? `<br><strong>Rotation Applied:</strong> ${m.rotation}&deg;` : ''}
          </div>
        </div>

        <button class="btn-confirm-match" onclick="confirmMatch('${data.uploaded_file}', '${m.collection}', '${m.filename}', '${m.status}', ${m.rotation})">
          <span>✓ Confirm &amp; Update Site</span>
        </button>
      </div>
    `;

    if (currentComparisonMode === 'slider') {
      attachSliderEvents(card.querySelector('.studio-comp-viewport'));
    }

    container.appendChild(card);
  });
}

function attachSliderEvents(vp) {
  let isMoving = false;
  const updatePos = (clientX) => {
    const rect = vp.getBoundingClientRect();
    let pct = ((clientX - rect.left) / rect.width) * 100;
    pct = Math.max(0, Math.min(100, pct));
    vp.style.setProperty('--pos', `${pct}%`);
  };

  vp.addEventListener('mousedown', (e) => { isMoving = true; updatePos(e.clientX); });
  window.addEventListener('mousemove', (e) => { if (isMoving) updatePos(e.clientX); });
  window.addEventListener('mouseup', () => { isMoving = false; });
  
  vp.addEventListener('touchstart', (e) => { isMoving = true; updatePos(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchmove', (e) => { if (isMoving) updatePos(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchend', () => { isMoving = false; });
}

async function confirmMatch(uploadFile, collection, targetFile, targetStatus, rotation) {
  if (!confirm(`Are you sure you want to pair this upscaled photo with ${targetFile} in the ${collection.toUpperCase()} archive? This will update the public website immediately.`)) {
    return;
  }

  showToast('Applying match, regenerating thumbnails and updating site...');

  try {
    const res = await fetch('/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_file: uploadFile,
        collection: collection,
        target_file: targetFile,
        target_status: targetStatus,
        rotation: rotation
      })
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      alert('Failed: ' + (data.error || 'Server error'));
      return;
    }

    showToast('Match applied successfully! Website updated!');
    document.getElementById('activeSession').style.display = 'none';
    currentUploadData = null;
    loadDatabase();
  } catch (err) {
    alert('Error confirming match: ' + err.message);
  }
}

async function loadDatabase() {
  try {
    const res = await fetch('/api/database');
    const data = await res.json();
    databaseCache = data;
    
    document.getElementById('countUnrestored').textContent = data.unrestored.length;
    document.getElementById('countPaired').textContent = data.paired.length;
    renderBrowseGrid();
  } catch (err) {
    console.error('Failed to load database:', err);
  }
}

function switchBrowseTab(tab) {
  currentTab = tab;
  document.getElementById('tabUnrestored').classList.toggle('active', tab === 'unrestored');
  document.getElementById('tabPaired').classList.toggle('active', tab === 'paired');
  renderBrowseGrid();
}

function renderBrowseGrid() {
  const container = document.getElementById('browseGrid');
  container.innerHTML = '';
  const items = databaseCache[currentTab] || [];

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'match-item-card';
    const aspect = item.aspect || 1.33;

    card.innerHTML = `
      <div style="position: relative; width: 100%; aspect-ratio: ${aspect}; overflow: hidden; background: #000;">
        <img src="/${item.thumb_rel || item.rel_path}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">
        <div class="studio-badge-label left" style="top: 8px; left: 8px;">${item.collection.toUpperCase()} &bull; ${item.filename}</div>
      </div>
      <div class="match-body">
        <div class="match-details" style="margin-bottom: 0.75rem;">
          <strong>File:</strong> ${item.filename}<br>
          <strong>Resolution:</strong> ${item.width} × ${item.height} px<br>
          <strong>Status:</strong> ${currentTab === 'unrestored' ? '⏳ Still Needs to be Restored' : '🔄 Paired Original'}
        </div>
        ${currentUploadData ? `
          <button class="btn-confirm-match" onclick="confirmMatch('${currentUploadData.uploaded_file}', '${item.collection}', '${item.filename}', '${currentTab}', 0)">
            <span>✓ Match with Current Upload</span>
          </button>
        ` : `
          <div style="font-size: 0.75rem; color: #64748b; text-align: center;">Drop an image above to pair</div>
        `}
      </div>
    `;
    container.appendChild(card);
  });
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toastText').textContent = msg;
  toast.style.display = 'flex';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 4000);
}
