// ============================================================================
// Rangachakua Community Archive - Configuration
// ============================================================================

export const firebaseConfig = {
  projectId: "axomrank-prod",
  appId: "1:728272897239:web:21c6914cb8d8cb9aa39c92",
  storageBucket: "axomrank-prod.firebasestorage.app",
  apiKey: "AIzaSyDv2YiOc0-QevajUAh2eckOC366cC942g4",
  authDomain: "axomrank-prod.firebaseapp.com",
  messagingSenderId: "728272897239",
  measurementId: "G-32KHETBZVE"
};

// ImgBB API Key
export const IMGBB_API_KEY = "d1efd100d21e72617ba2dd5a2be326b0";

// Helper to determine if actual credentials are provided
export function getActiveConfig() {
  const localFb = localStorage.getItem('rck_firebase_config');
  const localImgbb = localStorage.getItem('rck_imgbb_key');

  const fb = localFb ? JSON.parse(localFb) : firebaseConfig;
  const imgbb = localImgbb || IMGBB_API_KEY;

  const isFbValid = Boolean(fb && fb.apiKey && !fb.apiKey.includes('YOUR_FIREBASE_API_KEY'));
  const isImgbbValid = Boolean(imgbb && !imgbb.includes('YOUR_IMGBB_API_KEY'));

  return {
    firebaseConfig: fb,
    imgbbApiKey: imgbb,
    isReady: isFbValid && isImgbbValid,
    isFbValid,
    isImgbbValid
  };
}

export function saveRuntimeConfig(fbConfig, imgbbKey) {
  if (fbConfig) localStorage.setItem('rck_firebase_config', JSON.stringify(fbConfig));
  if (imgbbKey) localStorage.setItem('rck_imgbb_key', imgbbKey);
}
