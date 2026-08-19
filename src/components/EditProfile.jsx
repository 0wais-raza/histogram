import { useState, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { alertError, alertSuccess } from "../utils/alerts";
import { uploadImage } from "../utils/uploadImage";
import { Save, X, Camera } from "lucide-react";

const MAX_BIO = 150;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE_MB = 5;

export default function EditProfile({ profile, onClose, onSaved }) {
  const { user } = useAuth();
  const [bio, setBio] = useState(profile.bio || "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(profile.profilePic || "");
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

  async function handleSubmit(e) {
    e.preventDefault();
    setUploading(true);

    try {
      let profilePic = profile.profilePic || "";
      if (file) {
        profilePic = await uploadImage(file);
      }

      await updateDoc(doc(db, "users", user.uid), {
        bio: bio.trim(),
        profilePic,
      });

      await alertSuccess("Profile updated!", "Your changes have been saved.");
      onSaved?.();
      onClose();
    } catch (err) {
      alertError(
        "Update failed",
        err.message.replace("Firebase: ", "") || "Something went wrong."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="create-post-header">
          <h3>Edit profile</h3>
          <button type="button" className="btn icon-only" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* ── Avatar picker ── */}
        <div className="edit-avatar-picker">
          <div
            className="edit-avatar-ring"
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="Preview" className="edit-avatar-img" />
            ) : (
              <div className="edit-avatar-placeholder">
                <Camera size={24} />
              </div>
            )}
            <div className="edit-avatar-overlay">
              <Camera size={16} />
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>

        <label className="muted">Bio (max {MAX_BIO})</label>
        <textarea
          rows="4"
          maxLength={MAX_BIO}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
        <p className="muted">
          {bio.length}/{MAX_BIO}
        </p>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            <X size={16} />
            Cancel
          </button>
          <button className="btn primary" disabled={uploading}>
            {uploading ? (
              <span className="setup-btn-loading">
                <span className="setup-btn-spinner" />
                Saving...
              </span>
            ) : (
              <>
                <Save size={16} />
                Save
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
