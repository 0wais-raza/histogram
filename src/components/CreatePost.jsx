import { useState, useRef } from "react";
import {
  doc,
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { alertError, alertSuccess } from "../utils/alerts";
import { uploadImage } from "../utils/uploadImage";
import { ImagePlus, X, Send } from "lucide-react";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE_MB = 10;

export default function CreatePost({ onClose, onCreated }) {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;

    if (!ALLOWED_TYPES.includes(f.type)) {
      return alertError(
        "Invalid file type",
        "Please upload a JPEG, PNG, GIF, or WebP image."
      );
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return alertError("File too large", `Image must be under ${MAX_SIZE_MB} MB.`);
    }

    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function handleRemoveImage() {
    setFile(null);
    setPreview("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return alertError("No image", "Please select an image to post.");

    setUploading(true);

    try {
      // 1. Upload image to imgbb
      const imageUrl = await uploadImage(file);

      // 2. Create post doc
      const postRef = await addDoc(collection(db, "posts"), {
        authorId: user.uid,
        authorName: user.displayName || user.email,
        imageUrl,
        caption: caption.trim(),
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });

      // 3. Update with its own ID
      await updateDoc(doc(db, "posts", postRef.id), { postId: postRef.id });

      onCreated?.();
      onClose();
      await alertSuccess("Posted!", "Your photo has been shared.");
    } catch (err) {
      alertError(
        "Upload failed",
        err.message.replace("Firebase: ", "") || "Something went wrong."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal create-post-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="create-post-header">
          <h3>New Post</h3>
          <button type="button" className="btn icon-only" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {preview ? (
          <div className="create-post-preview">
            <img src={preview} alt="Preview" />
            <button
              type="button"
              className="create-post-remove"
              onClick={handleRemoveImage}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div
            className="create-post-dropzone"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus size={36} strokeWidth={1.5} />
            <p>Click to select a photo</p>
            <span>JPEG, PNG, GIF, or WebP — max {MAX_SIZE_MB} MB</span>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        <textarea
          className="create-post-caption"
          placeholder="Write a caption..."
          rows={2}
          maxLength={2200}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <p className="create-post-count">{caption.length}/2200</p>

        <button
          type="submit"
          className="btn primary create-post-submit"
          disabled={uploading || !file}
        >
          {uploading ? (
            <span className="setup-btn-loading">
              <span className="setup-btn-spinner" />
              Posting...
            </span>
          ) : (
            <>
              <Send size={16} />
              Share
            </>
          )}
        </button>
      </form>
    </div>
  );
}
