/**
 * Upload an image using imgbb (free — no Firebase Storage needed).
 *
 * Requires VITE_IMGBB_API_KEY in your .env
 * Get a key at https://imgbb.com/api  (free, no credit card)
 *
 * @param {File} file - The image file to upload
 * @returns {Promise<string>} The hosted image URL
 */
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
  formData.append("expiration", "0"); // never expires (imgbb default)

  let response;
  try {
    response = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: formData,
    });
  } catch {
    if (!navigator.onLine) {
      throw new Error("No internet connection. Please check your network and try again.");
    }
    throw new Error("Image upload failed. Please try again.");
  }

  const data = await response.json();

  if (!data.success) {
    const msg = data?.error?.message || "";
    if (msg.includes("File is too big")) {
      throw new Error("Image is too large. Maximum size is 32 MB.");
    }
    throw new Error("Image upload failed. Please try again.");
  }

  // Return the direct URL (full size, no thumbnail)
  return data.data.url;
}

/**
 * Read a File as a base64 data URL, then strip the prefix.
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // "data:image/jpeg;base64,ABC..." → "ABC..."
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}
