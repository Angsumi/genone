// ============================================================================
// Identity & Anonymous Authentication Management
// ============================================================================

import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let authInstance = null;
let currentFirebaseUser = null;

const STORAGE_KEYS = {
  NAME: 'rck_uploader_name',
  UID: 'rck_uploader_uid',
  ID: 'rck_uploader_id'
};

/**
 * Initialize anonymous Firebase Auth
 */
export async function initAuth(app) {
  if (!app) return null;
  authInstance = getAuth(app);

  return new Promise((resolve) => {
    onAuthStateChanged(authInstance, async (user) => {
      if (user) {
        currentFirebaseUser = user;
        localStorage.setItem(STORAGE_KEYS.UID, user.uid);
        if (!localStorage.getItem(STORAGE_KEYS.ID)) {
          localStorage.setItem(STORAGE_KEYS.ID, user.uid);
        }
        resolve(getProfile());
      } else {
        try {
          const cred = await signInAnonymously(authInstance);
          currentFirebaseUser = cred.user;
          localStorage.setItem(STORAGE_KEYS.UID, cred.user.uid);
          if (!localStorage.getItem(STORAGE_KEYS.ID)) {
            localStorage.setItem(STORAGE_KEYS.ID, cred.user.uid);
          }
          resolve(getProfile());
        } catch (err) {
          console.warn("Anonymous auth failed (check Firebase Auth is enabled in Console):", err);
          // Fallback to local device identity
          resolve(getProfile());
        }
      }
    });
  });
}

/**
 * Returns currently known local uploader profile
 */
export function getProfile() {
  let uid = currentFirebaseUser ? currentFirebaseUser.uid : localStorage.getItem(STORAGE_KEYS.UID);
  if (!uid) {
    uid = 'dev_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(STORAGE_KEYS.UID, uid);
  }

  let uploaderId = localStorage.getItem(STORAGE_KEYS.ID) || uid;
  const name = localStorage.getItem(STORAGE_KEYS.NAME) || '';

  return {
    uid,
    uploaderId,
    name: name.trim(),
    hasName: Boolean(name.trim())
  };
}

/**
 * Saves or updates user's name
 */
export function setUploaderName(name) {
  const cleanName = (name || '').trim();
  if (cleanName) {
    localStorage.setItem(STORAGE_KEYS.NAME, cleanName);
  }
  return getProfile();
}
