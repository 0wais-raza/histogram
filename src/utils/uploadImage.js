/**
 * Upload an image to imgbb (free image hosting).
 * Requires VITE_IMGBB_API_KEY in your .env file.
 * Get a free key at https://imgbb.com/api
 *
 * @param {File} file - The image file to upload
 * @returns {Promise<string>} The hosted image URL
 */
const IMGBB_API = "https://api.imgbb.com/1/upload";

export async function uploadImage(file) {
  const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing VITE_IMGBB_API_KEY. Get a free key at https://imgbb.com/api and add it to your .env file."
    );
  }

  // Convert file to base64
  const base64 = await fileToBase64(file);

  const formData = new FormData();
  formData.append("key", apiKey);
  formData.append("image", base64);
  formData.append("name", `histogram_${Date.now()}`);

  let res;
  try {
    res = await fetch(IMGBB_API, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    if (!navigator.onLine) {
      throw new Error("No internet connection. Please check your network and try again.");
    }
    throw new Error("Could not reach the image server. Please try again.");
  }

  if (!res.ok) {
    // Try to parse error body for more detail
    let detail = "";
    try {
      const errBody = await res.json();
      detail = errBody?.error?.message || "";
    } catch {}
    if (res.status === 400 && (detail.includes("Invalid API key") || detail.includes("UNAUTHORIZED"))) {
      throw new Error("Image upload API key is invalid. Get a free key at https://imgbb.com/api and set VITE_IMGBB_API_KEY in your .env file.");
    }
    if (res.status === 400 && detail.includes("too large")) {
      throw new Error("Image is too large. Please use a smaller file (max 10 MB).");
    }
    throw new Error(detail || `Upload failed (server error ${res.status}). Please check your API key and try again.`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("Image server returned an unexpected response. Please try again.");
  }

  if (!data.success) {
    const errMsg = data?.error?.message || "";
    if (errMsg.includes("File is too big") || errMsg.includes("too large")) {
      throw new Error("Image is too large. Please use a smaller file (max 10 MB)."
      );
    }
    if (errMsg.includes("invalid")) {
      throw new Error("This file type is not supported. Use JPG, PNG, GIF, or WebP.");
    }
    throw new Error(errMsg || "Image upload failed. Please try again.");
  }

  return data.data.url;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Remove the data URL prefix (e.g. "data:image/jpeg;base64,")
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
