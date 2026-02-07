/**
 * File Upload Service
 * MVP: Converts files to data URLs (base64)
 * In production, this would upload to cloud storage (S3, Cloudinary, etc.)
 */

/**
 * Convert Google Drive URLs to full-size image URLs.
 * Google Drive view/thumbnail links often serve cropped/zoomed thumbnails.
 * This converts them to the full-resolution embed format.
 * @see https://www.syncwithtech.org/google-drive-image-urls/
 */
export const toFullSizeImageUrl = (url: string): string => {
  if (!url || typeof url !== 'string') return url;

  const trimmed = url.trim();
  // Data URLs and blob URLs should pass through unchanged
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  let fileId: string | null = null;

  // Format: drive.google.com/file/d/FILE_ID/view or /file/d/FILE_ID
  const fileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    fileId = fileMatch[1];
  }

  // Format: drive.google.com/open?id=FILE_ID
  if (!fileId) {
    const openMatch = trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
    if (openMatch) fileId = openMatch[1];
  }

  // Format: drive.google.com/uc?id=FILE_ID or thumbnail?id=FILE_ID
  if (!fileId) {
    const ucMatch = trimmed.match(/drive\.google\.com\/(?:uc|thumbnail)\?(?:(?:[^&]*&)*)?id=([a-zA-Z0-9_-]+)/);
    if (ucMatch) fileId = ucMatch[1];
  }

  if (fileId) {
    // Full-size embed format - displays whole image, not thumbnail
    return `https://drive.google.com/uc?id=${fileId}&export=view`;
  }

  return trimmed;
};

/**
 * Convert file to base64 data URL
 * This is an MVP solution - in production, upload to cloud storage
 */
export const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to data URL'));
      }
    };
    reader.onerror = () => reject(new Error('File reading failed'));
    reader.readAsDataURL(file);
  });
};

/**
 * Upload image file and return URL
 * MVP: Returns data URL (base64)
 * Production: Would upload to cloud storage and return CDN URL
 */
export const uploadImage = async (file: File): Promise<string> => {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }

  // Validate file size (max 10MB for MVP)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new Error('Image size must be less than 10MB');
  }

  // MVP: Return data URL
  // Production: Upload to S3/Cloudinary/etc. and return CDN URL
  const dataURL = await fileToDataURL(file);
  
  return dataURL;
};

/**
 * Upload multiple images
 */
export const uploadImages = async (files: File[]): Promise<string[]> => {
  try {
    const uploadPromises = files.map(file => uploadImage(file));
    return Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading images:', error);
    throw error;
  }
};

/**
 * Validate image file
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: 'Image size must be less than 10MB' };
  }

  return { valid: true };
};
