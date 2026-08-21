import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase/config";

/**
 * Upload an image to Firebase Storage.
 *
 * @param {File} file - The image file to upload
 * @returns {Promise<string>} The hosted image URL
 */
export async function uploadImage(file) {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `uploads/${timestamp}_${safeName}`;
  const storageRef = ref(storage, path);

  let snapshot;
  try {
    snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
    });
  } catch (err) {
    if (err.code === "storage/unauthorized") {
      throw new Error(
        "Permission denied. Check your Firebase Storage security rules."
      );
    }
    if (err.code === "storage/quota-exceeded") {
      throw new Error("Storage quota exceeded. Please contact support.");
    }
    if (!navigator.onLine) {
      throw new Error("No internet connection. Please check your network and try again.");
    }
    throw new Error("Image upload failed. Please try again.");
  }

  return getDownloadURL(snapshot.ref);
}
