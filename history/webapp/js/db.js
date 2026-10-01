// ============================================================================
// Firestore Database Operations
// ============================================================================

import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp, 
  increment 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let dbInstance = null;

export function initDb(app) {
  if (!app) return null;
  dbInstance = getFirestore(app);
  return dbInstance;
}

export function isDbReady() {
  return dbInstance !== null;
}

/**
 * Creates or updates the uploader profile document
 */
export async function syncUploaderProfile(profile, newPhotoThumb = null) {
  if (!dbInstance) return;

  const uploaderRef = doc(dbInstance, 'uploaders', profile.uploaderId);
  const snap = await getDoc(uploaderRef);

  if (!snap.exists()) {
    await setDoc(uploaderRef, {
      name: profile.name,
      uid: profile.uid,
      photoCount: newPhotoThumb ? 1 : 0,
      latestPhotoThumb: newPhotoThumb || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    const updateData = {
      name: profile.name,
      updatedAt: serverTimestamp()
    };
    if (newPhotoThumb) {
      updateData.photoCount = increment(1);
      updateData.latestPhotoThumb = newPhotoThumb;
    }
    await setDoc(uploaderRef, updateData, { merge: true });
  }
}

/**
 * Saves a newly uploaded photograph document to Firestore
 */
export async function savePhotoRecord(photoData) {
  if (!dbInstance) {
    throw new Error("Firestore is not initialized. Please verify your Firebase config.");
  }

  const payload = {
    uploaderId: photoData.uploaderId,
    uploaderName: photoData.uploaderName || 'Anonymous Villager',
    uploaderUid: photoData.uploaderUid,
    imageUrl: photoData.imageUrl,
    thumbUrl: photoData.thumbUrl || photoData.imageUrl,
    displayUrl: photoData.displayUrl || photoData.imageUrl,
    deleteUrl: photoData.deleteUrl || null,
    place: (photoData.place || '').trim(),
    person: (photoData.person || '').trim(),
    year: (photoData.year || '').trim(),
    story: (photoData.story || '').trim(),
    createdAt: serverTimestamp()
  };

  const colRef = collection(dbInstance, 'photos');
  const docRef = await addDoc(colRef, payload);

  // Sync uploader profile stats
  await syncUploaderProfile({
    uploaderId: photoData.uploaderId,
    uid: photoData.uploaderUid,
    name: photoData.uploaderName
  }, payload.thumbUrl);

  return { id: docRef.id, ...payload };
}

/**
 * Retrieves all registered uploaders ordered by activity
 */
export async function getUploaders() {
  if (!dbInstance) return [];

  try {
    const q = query(
      collection(dbInstance, 'uploaders'),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Could not query with orderBy('updatedAt'), falling back to unordered fetch:", err);
    const snapshot = await getDocs(collection(dbInstance, 'uploaders'));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

/**
 * Gets a single uploader by ID
 */
export async function getUploaderById(uploaderId) {
  if (!dbInstance || !uploaderId) return null;
  const snap = await getDoc(doc(dbInstance, 'uploaders', uploaderId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Gets all photos uploaded by a specific person
 */
export async function getPhotosByUploader(uploaderId) {
  if (!dbInstance || !uploaderId) return [];

  try {
    const q = query(
      collection(dbInstance, 'photos'),
      where('uploaderId', '==', uploaderId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Falling back to query without compound index:", err);
    const q = query(
      collection(dbInstance, 'photos'),
      where('uploaderId', '==', uploaderId)
    );
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    // Client-side sort fallback
    return list.sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });
  }
}

/**
 * Gets the most recent community photos across all uploaders
 */
export async function getRecentPhotos(limitCount = 24) {
  if (!dbInstance) return [];

  try {
    const q = query(
      collection(dbInstance, 'photos'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Recent photos query error:", err);
    return [];
  }
}
