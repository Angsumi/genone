// ============================================================================
// Rangachakua Community Archive - Main Application Controller
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getActiveConfig, saveRuntimeConfig } from "./config.js";
import { initAuth, getProfile, setUploaderName } from "./auth.js";
import { 
  initDb, 
  getUploaders, 
  getUploaderById, 
  getPhotosByUploader, 
  getRecentPhotos, 
  savePhotoRecord 
} from "./db.js";
import { compressImage, uploadToImgBB } from "./storage.js";
import { Lightbox } from "./lightbox.js";

// Global Application State
const state = {
  firebaseApp: null,
  profile: null,
  config: null,
  currentCompressedPhoto: null,
  lightbox: null,
  photosCache: new Map(), // id -> photo object for lightbox
  pendingUploadTrigger: null // 'camera' or 'gallery'
};

// UI Elements
const dom = {
  configBanner: document.getElementById('config-banner'),
  btnOpenConfig: document.getElementById('btn-open-config'),
  configModal: document.getElementById('config-modal'),
  configModalClose: document.getElementById('config-modal-close'),
  configForm: document.getElementById('config-form'),
  cfgImgbb: document.getElementById('cfg-imgbb'),
  cfgApikey: document.getElementById('cfg-apikey'),
  cfgProjectid: document.getElementById('cfg-projectid'),
  cfgAppid: document.getElementById('cfg-appid'),

  userBadge: document.getElementById('user-badge'),
  userDisplayName: document.getElementById('user-display-name'),
  btnEditName: document.getElementById('btn-edit-name'),
  nameModal: document.getElementById('name-modal'),
  nameModalClose: document.getElementById('name-modal-close'),
  nameForm: document.getElementById('name-form'),
  inputUpdateName: document.getElementById('input-update-name'),
  btnCancelName: document.getElementById('btn-cancel-name'),
  nameModalTitle: document.getElementById('name-modal-title'),
  nameModalSubtitle: document.getElementById('name-modal-subtitle'),
  btnSaveNameSubmit: document.getElementById('btn-save-name-submit'),

  btnSnapCamera: document.getElementById('btn-snap-camera'),
  btnChooseGallery: document.getElementById('btn-choose-gallery'),
  btnHeaderUpload: document.getElementById('btn-header-upload'),
  cameraInput: document.getElementById('camera-input'),
  galleryInput: document.getElementById('gallery-input'),

  uploadModal: document.getElementById('upload-modal'),
  uploadModalClose: document.getElementById('upload-modal-close'),
  btnCancelUpload: document.getElementById('btn-cancel-upload'),
  uploadForm: document.getElementById('upload-form'),
  uploadPreviewImg: document.getElementById('upload-preview-img'),
  previewMetaInfo: document.getElementById('preview-meta-info'),
  nameFieldGroup: document.getElementById('name-field-group'),
  inputUploaderName: document.getElementById('input-uploader-name'),
  inputPlace: document.getElementById('input-place'),
  inputPerson: document.getElementById('input-person'),
  inputYear: document.getElementById('input-year'),
  inputStory: document.getElementById('input-story'),
  uploadStatus: document.getElementById('upload-status'),
  btnSubmitUpload: document.getElementById('btn-submit-upload'),

  homeView: document.getElementById('home-view'),
  uploaderView: document.getElementById('uploader-view'),
  uploadersGrid: document.getElementById('uploaders-grid'),
  uploadersCount: document.getElementById('uploaders-count'),
  recentPhotosGrid: document.getElementById('recent-photos-grid'),
  recentCount: document.getElementById('recent-count'),

  uploaderNameHeading: document.getElementById('uploader-name-heading'),
  uploaderTotalBadge: document.getElementById('uploader-total-badge'),
  uploaderPhotosGrid: document.getElementById('uploader-photos-grid')
};

/**
 * Initialize Application
 */
async function init() {
  state.lightbox = new Lightbox();
  state.config = getActiveConfig();

  // Check if keys are set
  if (!state.config.isReady) {
    dom.configBanner.classList.remove('hidden');
  }

  // Initialize Firebase if credentials exist
  if (state.config.isFbValid) {
    try {
      state.firebaseApp = initializeApp(state.config.firebaseConfig);
      initDb(state.firebaseApp);
      state.profile = await initAuth(state.firebaseApp);
    } catch (err) {
      console.error("Firebase init failed:", err);
    }
  }

  if (!state.profile) {
    state.profile = getProfile();
  }

  updateUserUI();
  setupEventListeners();
  handleRoute();
}

/**
 * Update User identity UI in header & form
 */
function updateUserUI() {
  if (state.profile && state.profile.hasName) {
    dom.userDisplayName.textContent = state.profile.name;
    dom.userBadge.style.display = 'flex';
    dom.nameFieldGroup.style.display = 'none';
    dom.inputUploaderName.value = state.profile.name;
  } else {
    dom.userBadge.style.display = 'none';
    dom.nameFieldGroup.style.display = 'block';
    dom.inputUploaderName.value = '';
  }
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
  // Hash routing
  window.addEventListener('hashchange', handleRoute);

  // Camera & Gallery Triggers with pre-upload name check
  function triggerCapture(type) {
    if (!state.profile || !state.profile.hasName) {
      state.pendingUploadTrigger = type;
      dom.inputUpdateName.value = '';
      dom.nameModalTitle.textContent = "Enter Your Name";
      dom.nameModalSubtitle.textContent = "Please enter your name or family name before taking or selecting a photograph.";
      dom.btnSaveNameSubmit.textContent = type === 'camera' ? "Continue to Camera 📸" : "Continue to Choose Photo 📁";
      dom.nameModal.classList.add('active');
      setTimeout(() => dom.inputUpdateName.focus(), 100);
      return;
    }

    if (type === 'camera') {
      dom.cameraInput.click();
    } else {
      dom.galleryInput.click();
    }
  }

  dom.btnSnapCamera?.addEventListener('click', () => triggerCapture('camera'));
  dom.btnChooseGallery?.addEventListener('click', () => triggerCapture('gallery'));
  dom.btnHeaderUpload?.addEventListener('click', () => triggerCapture('gallery'));

  dom.cameraInput?.addEventListener('change', handleFileSelected);
  dom.galleryInput?.addEventListener('change', handleFileSelected);

  // Upload Form
  dom.uploadForm?.addEventListener('submit', handleUploadSubmit);
  dom.uploadModalClose?.addEventListener('click', closeUploadModal);
  dom.btnCancelUpload?.addEventListener('click', closeUploadModal);

  // Name Modal (used for initial prompt and editing)
  dom.btnEditName?.addEventListener('click', () => {
    state.pendingUploadTrigger = null;
    dom.nameModalTitle.textContent = "Your Contributor Name";
    dom.nameModalSubtitle.textContent = "Change how your contributions are attributed across the archive.";
    dom.btnSaveNameSubmit.textContent = "Save Name";
    dom.inputUpdateName.value = state.profile?.name || '';
    dom.nameModal.classList.add('active');
  });

  dom.nameModalClose?.addEventListener('click', () => {
    state.pendingUploadTrigger = null;
    dom.nameModal.classList.remove('active');
  });

  dom.btnCancelName?.addEventListener('click', () => {
    state.pendingUploadTrigger = null;
    dom.nameModal.classList.remove('active');
  });

  dom.nameForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const newName = dom.inputUpdateName.value.trim();
    if (newName) {
      state.profile = setUploaderName(newName);
      updateUserUI();
      dom.nameModal.classList.remove('active');

      const trigger = state.pendingUploadTrigger;
      state.pendingUploadTrigger = null;

      // Automatically proceed to camera or gallery picker
      if (trigger === 'camera') {
        setTimeout(() => dom.cameraInput.click(), 150);
      } else if (trigger === 'gallery') {
        setTimeout(() => dom.galleryInput.click(), 150);
      }
    }
  });

  // Config Modal
  dom.btnOpenConfig?.addEventListener('click', () => {
    dom.cfgImgbb.value = state.config.imgbbApiKey.includes('YOUR_') ? '' : state.config.imgbbApiKey;
    dom.cfgApikey.value = state.config.firebaseConfig.apiKey?.includes('YOUR_') ? '' : state.config.firebaseConfig.apiKey;
    dom.cfgProjectid.value = state.config.firebaseConfig.projectId || '';
    dom.cfgAppid.value = state.config.firebaseConfig.appId?.includes('YOUR_') ? '' : state.config.firebaseConfig.appId;
    dom.configModal.classList.add('active');
  });
  dom.configModalClose?.addEventListener('click', () => dom.configModal.classList.remove('active'));
  dom.configForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const imgbb = dom.cfgImgbb.value.trim();
    const apiKey = dom.cfgApikey.value.trim();
    const projectId = dom.cfgProjectid.value.trim() || 'rangachakua';
    const appId = dom.cfgAppid.value.trim();

    const fb = {
      apiKey,
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: `${projectId}.appspot.com`,
      appId
    };

    saveRuntimeConfig(fb, imgbb);
    window.location.reload();
  });
}

/**
 * Handle File Selection (from camera or gallery)
 */
async function handleFileSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    dom.previewMetaInfo.textContent = "Compressing photo for fast upload...";
    dom.uploadModal.classList.add('active');

    // Client-side canvas compression
    const result = await compressImage(file, 1920, 0.85);
    state.currentCompressedPhoto = result;

    dom.uploadPreviewImg.src = result.previewUrl;
    const origMB = (result.originalSize / (1024 * 1024)).toFixed(1);
    const compKB = Math.round(result.compressedSize / 1024);
    dom.previewMetaInfo.textContent = `Optimized: ${origMB}MB original → ${compKB}KB (${result.width}×${result.height}px)`;

    // Reset inputs
    e.target.value = '';
  } catch (err) {
    alert("Could not process photo: " + err.message);
    closeUploadModal();
  }
}

function closeUploadModal() {
  dom.uploadModal.classList.remove('active');
  dom.uploadStatus.style.display = 'none';
  dom.btnSubmitUpload.disabled = false;
  state.currentCompressedPhoto = null;
}

/**
 * Handle Upload Submission
 */
async function handleUploadSubmit(e) {
  e.preventDefault();
  if (!state.currentCompressedPhoto) {
    alert("Please select a photograph first.");
    return;
  }

  // Resolve uploader name
  let uploaderName = state.profile?.name;
  if (!uploaderName) {
    uploaderName = dom.inputUploaderName.value.trim();
    if (!uploaderName) {
      alert("Please enter your name so the archive can properly attribute your photo.");
      dom.inputUploaderName.focus();
      return;
    }
    state.profile = setUploaderName(uploaderName);
    updateUserUI();
  }

  const activeCfg = getActiveConfig();
  if (!activeCfg.isImgbbValid) {
    alert("ImgBB API key is required to upload images. Click 'Configure Credentials' at the top.");
    dom.btnOpenConfig?.click();
    return;
  }

  try {
    dom.btnSubmitUpload.disabled = true;
    dom.uploadStatus.style.display = 'block';
    dom.uploadStatus.textContent = '⏳ Uploading high-resolution photo to archive...';

    // 1. Upload to ImgBB
    const imgResult = await uploadToImgBB(
      state.currentCompressedPhoto.blob, 
      activeCfg.imgbbApiKey,
      (p) => { dom.uploadStatus.textContent = p.message; }
    );

    // 2. Save metadata to Firestore
    dom.uploadStatus.textContent = '💾 Saving details to archive database...';

    const photoPayload = {
      uploaderId: state.profile.uploaderId,
      uploaderUid: state.profile.uid,
      uploaderName: state.profile.name,
      imageUrl: imgResult.imageUrl,
      thumbUrl: imgResult.thumbUrl,
      displayUrl: imgResult.displayUrl,
      deleteUrl: imgResult.deleteUrl,
      place: dom.inputPlace.value.trim(),
      person: dom.inputPerson.value.trim(),
      year: dom.inputYear.value.trim(),
      story: dom.inputStory.value.trim()
    };

    if (state.config.isFbValid) {
      await savePhotoRecord(photoPayload);
    } else {
      console.log("Mock Firestore save (Firebase not yet configured):", photoPayload);
    }

    closeUploadModal();
    // Clear optional inputs
    dom.inputPlace.value = '';
    dom.inputPerson.value = '';
    dom.inputYear.value = '';
    dom.inputStory.value = '';

    // Route to contributor page or refresh
    window.location.hash = `#/uploader/${state.profile.uploaderId}`;
    handleRoute();
  } catch (err) {
    console.error("Upload error:", err);
    alert("Upload failed: " + err.message);
    dom.uploadStatus.style.display = 'none';
    dom.btnSubmitUpload.disabled = false;
  }
}

/**
 * Handle Hash Routes
 */
async function handleRoute() {
  const hash = window.location.hash || '#/';

  if (hash.startsWith('#/uploader/')) {
    const uploaderId = hash.replace('#/uploader/', '');
    renderUploaderView(uploaderId);
  } else {
    renderHomeView();
  }
}

/**
 * Render Home View (Contributors directory + Recent photos)
 */
async function renderHomeView() {
  dom.homeView.style.display = 'block';
  dom.uploaderView.style.display = 'none';
  window.scrollTo(0, 0);

  // Load contributors
  try {
    const uploaders = await getUploaders();
    dom.uploadersCount.textContent = uploaders.length ? `${uploaders.length} Contributors` : '';

    if (uploaders.length === 0) {
      dom.uploadersGrid.innerHTML = `
        <div class="empty-box" style="grid-column: 1 / -1;">
          <h3>No Photographs Added Yet</h3>
          <p>Be the very first to contribute an ancient village photograph to the archive!</p>
        </div>
      `;
    } else {
      dom.uploadersGrid.innerHTML = uploaders.map(u => `
        <a href="#/uploader/${u.id}" class="uploader-card">
          <div class="uploader-card-header">
            <span class="uploader-name">${escapeHtml(u.name || 'Anonymous')}</span>
            <span class="uploader-badge">${u.photoCount || 1} ${u.photoCount === 1 ? 'photo' : 'photos'}</span>
          </div>
          <div class="uploader-card-preview">
            ${u.latestPhotoThumb ? `<img src="${u.latestPhotoThumb}" alt="${escapeHtml(u.name)}" loading="lazy" />` : `<div class="uploader-empty-thumb">View archive &rarr;</div>`}
          </div>
        </a>
      `).join('');
    }
  } catch (err) {
    console.warn("Could not load contributors:", err);
  }

  // Load recent photos
  try {
    const photos = await getRecentPhotos(24);
    dom.recentCount.textContent = photos.length ? `${photos.length} Photos` : '';

    if (photos.length === 0) {
      dom.recentPhotosGrid.innerHTML = `
        <div class="empty-box" style="grid-column: 1 / -1;">
          <p>Historical photographs contributed by the community will appear here in chronological order.</p>
        </div>
      `;
    } else {
      photos.forEach(p => state.photosCache.set(p.id, p));
      dom.recentPhotosGrid.innerHTML = photos.map(p => renderPhotoCard(p)).join('');
      attachPhotoCardListeners(dom.recentPhotosGrid);
    }
  } catch (err) {
    console.warn("Could not load recent photos:", err);
  }
}

/**
 * Render Uploader Gallery View
 */
async function renderUploaderView(uploaderId) {
  dom.homeView.style.display = 'none';
  dom.uploaderView.style.display = 'block';
  window.scrollTo(0, 0);

  dom.uploaderNameHeading.textContent = "Loading Archive...";
  dom.uploaderTotalBadge.textContent = "...";
  dom.uploaderPhotosGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">Fetching contributor's photographs...</div>`;

  try {
    const [uploader, photos] = await Promise.all([
      getUploaderById(uploaderId),
      getPhotosByUploader(uploaderId)
    ]);

    const title = uploader?.name || (photos[0]?.uploaderName) || 'Community Contributor';
    dom.uploaderNameHeading.textContent = title;
    dom.uploaderTotalBadge.textContent = `${photos.length} ${photos.length === 1 ? 'Photograph' : 'Photographs'}`;

    if (photos.length === 0) {
      dom.uploaderPhotosGrid.innerHTML = `
        <div class="empty-box" style="grid-column: 1 / -1;">
          <h3>No Photos Found</h3>
          <p>No photographs have been published under this contributor archive yet.</p>
        </div>
      `;
    } else {
      photos.forEach(p => state.photosCache.set(p.id, p));
      dom.uploaderPhotosGrid.innerHTML = photos.map(p => renderPhotoCard(p)).join('');
      attachPhotoCardListeners(dom.uploaderPhotosGrid);
    }
  } catch (err) {
    console.error("Error loading uploader archive:", err);
    dom.uploaderPhotosGrid.innerHTML = `<div class="empty-box" style="grid-column: 1 / -1;"><p>Failed to load archive.</p></div>`;
  }
}

/**
 * Render minimal photo card with tiny subdued details
 */
function renderPhotoCard(photo) {
  const person = photo.person ? escapeHtml(photo.person) : null;
  const place = photo.place ? escapeHtml(photo.place) : null;
  const year = photo.year ? escapeHtml(photo.year) : null;
  const story = photo.story ? escapeHtml(photo.story) : null;

  return `
    <article class="photo-card" data-photo-id="${photo.id}">
      <div class="photo-thumb-wrap">
        <img src="${photo.thumbUrl || photo.imageUrl}" alt="${person || place || 'Historic photo'}" loading="lazy" />
      </div>
      <div class="photo-meta">
        ${person ? `<div class="photo-meta-person">${person}</div>` : ''}
        <div class="photo-meta-sub">
          ${place ? `<span>📍 ${place}</span>` : ''}
          ${year ? `<span>🗓️ ${year}</span>` : ''}
        </div>
        ${story ? `<div class="photo-meta-story">${story}</div>` : ''}
      </div>
    </article>
  `;
}

function attachPhotoCardListeners(container) {
  const cards = container.querySelectorAll('.photo-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const photoId = card.getAttribute('data-photo-id');
      const photo = state.photosCache.get(photoId);
      if (photo && state.lightbox) {
        state.lightbox.open(photo);
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

// Start application
init();
