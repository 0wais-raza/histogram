/**
 * Upload an image using imgbb (free — no Firebase Storage needed).
 *
 * Requires VITE_IMGBB_API_KEY in your .env (and in Vercel env vars)
 * Get a key at https://imgbb.com/api  (free, no credit card)
 *
 * @param {File} file - The image file to upload
 * @returns {Promise<string>} The hosted image URL
 */

/** Convert a File to a base64 string (data prefix stripped). */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:image/...;base64,AAAA..."
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(file) {
  const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing VITE_IMGBB_API_KEY. Get a free key at https://imgbb.com/api and add it to your .env file."
    );
  }

  // Convert to base64 — imgbb's own docs use base64, and it avoids
  // binary-upload CORS issues in browsers.
  const base64 = await fileToBase64(file);

  // Use FormData with the base64 string (not the raw File).
  // FormData sets multipart/form-data automatically.
  const body = new FormData();
  body.append("key", apiKey);
  body.append("image", base64);

  let response;
  try {
    response = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body,
    });
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
      console.error("[imgbb] status:", response.status, "body:", errBody);
    } catch {}

    if (response.status === 400) {
      if (errorMsg.includes("File is too big")) {
        throw new Error("Image is too large. Maximum size is 32 MB.");
      }
      throw new Error(`Upload rejected (${errorMsg || "bad request"}). Check your API key at imgbb.com.`);
    }
    if (response.status === 403) {
      throw new Error("Invalid imgbb API key. Get a new one at https://imgbb.com/api");
    }
    throw new Error(`Upload failed (HTTP ${response.status}). Please try again.`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error("Image upload failed. Please try again.");
  }

  // Return the direct URL (full size)
  return data.data.url;
}