import { useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { storage, db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { alertError, alertSuccess, alertLoading } from "../utils/alerts";

const MAX_BIO = 150;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE_MB = 5;

export default function EditProfile({ profile, onClose }) {
  const { user, claimUsername } = useAuth();
  const [username, setUsername] = useState(profile.username || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(profile.profilePic || "");
  const [uploading, setUploading] = useState(false);

  const hasUsername = !!profile.username;

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
      return alertError(
        "File too large",
        `Image must be under ${MAX_SIZE_MB} MB.`
      );
    }

    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setUploading(true);

    const toast = alertLoading("Saving profile…");
    try {
      // If username changed (and user already had one), claim the new one
      if (hasUsername && username.trim().toLowerCase() !== profile.username.toLowerCase()) {
        await claimUsername(username);
      }

      let profilePic = profile.profilePic || "";
      if (file) {
        const storageRef = ref(storage, `profilePics/${user.uid}`);
        await uploadBytes(storageRef, file);
        profilePic = await getDownloadURL(storageRef);
      }

      const updateData = { bio: bio.trim(), profilePic };
      if (hasUsername && username.trim().toLowerCase() !== profile.username.toLowerCase()) {
        updateData.username = username.trim();
        updateData.usernameLower = username.trim().toLowerCase();
      }

      await updateDoc(doc(db, "users", user.uid), updateData);
      toast.close();
      await alertSuccess("Profile updated! ✨", "Your changes are saved.");
      onClose();
    } catch (err) {
      toast.close();
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
        <h3>Edit profile</h3>

        {hasUsername && (
          <>
            <label className="muted">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
            />
          </>
        )}

        <label className="muted">Profile picture</label>
        {preview && (
          <img src={preview} alt="Preview" className="avatar-preview" />
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
        />

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
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={uploading}>
            {uploading ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
