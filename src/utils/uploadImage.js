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

  const res = await fetch(IMGBB_API, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (!data.success) {
    throw new Error(data?.error?.message || "Image upload failed.");
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
