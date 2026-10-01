// ============================================================================
// Image Processing & ImgBB Upload Service
// ============================================================================

/**
 * Resizes and compresses an image file using an offscreen HTML Canvas.
 * Keeps aspect ratio intact with max dimension of 1920px.
 * Converts to high-quality JPEG to minimize upload time on cellular data.
 */
export async function compressImage(file, maxDimension = 1920, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image into element"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        // Smooth scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas to Blob compression failed"));
              return;
            }
            resolve({
              blob,
              width,
              height,
              originalSize: file.size,
              compressedSize: blob.size,
              previewUrl: URL.createObjectURL(blob)
            });
          },
          'image/jpeg',
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a compressed image blob or file to ImgBB
 */
export async function uploadToImgBB(imageBlob, apiKey, onProgress) {
  if (!apiKey || apiKey.includes('YOUR_IMGBB_API_KEY')) {
    throw new Error("ImgBB API key is missing. Please configure it in config.js.");
  }

  const formData = new FormData();
  formData.append('image', imageBlob, 'historic_photo.jpg');

  if (onProgress) onProgress({ status: 'uploading', message: 'Sending photo to archive storage...' });

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const msg = errorData.error?.message || `Upload failed with HTTP ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error?.message || "ImgBB upload was unsuccessful");
  }

  return {
    imageUrl: data.data.url,
    thumbUrl: data.data.thumb?.url || data.data.medium?.url || data.data.url,
    displayUrl: data.data.display_url || data.data.url,
    deleteUrl: data.data.delete_url || null,
    width: data.data.width,
    height: data.data.height,
    size: data.data.size
  };
}
