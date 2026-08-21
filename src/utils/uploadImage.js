/**
 * Upload an image using Cloudinary (free — no Firebase Storage needed).
 *
 * Requires VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your .env
 * (and in Vercel env vars).
 *
 * Set up:
 *   1. Create a free account at https://cloudinary.com
 *   2. Note your Cloud Name from the dashboard
 *   3. Go to Settings → Upload → Add upload preset → Unsigned
 *
 * @param {File} file - The image file to upload
 * @returns {Promise<string>} The hosted image URL
 */
export async function uploadImage(file) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Missing Cloudinary env vars. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your .env file."
    );
  }

  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", uploadPreset);

  let response;
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body }
    );
  } catch {
    if (!navigator.onLine) {
      throw new Error("No internet connection. Please check your network and try again.");
    }
    throw new Error("Image upload failed. Please try again.");
  }

  if (!response.ok) {
    let errorMsg = "";
    try {
      const errBody = await response.json();
      errorMsg = errBody?.error?.message || "";
      console.error("[cloudinary] status:", response.status, "body:", errBody);
    } catch {}

    if (response.status === 400) {
      if (errorMsg.includes("File is too big")) {
        throw new Error("Image is too large. Maximum size is 10 MB on the free tier.");
      }
      throw new Error(`Upload rejected (${errorMsg || "bad request"}). Check your upload preset in Cloudinary.`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("Invalid Cloudinary credentials. Check your cloud name and upload preset.");
    }
    throw new Error(`Upload failed (HTTP ${response.status}). Please try again.`);
  }

  const data = await response.json();

  if (!data.secure_url) {
    throw new Error("Image upload failed. Please try again.");
  }

  // Return the secure URL (full size)
  return data.secure_url;
}
