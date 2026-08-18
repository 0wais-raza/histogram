import { useState, useEffect } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { storage, db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { alertError, alertSuccess, alertLoading } from "../utils/alerts";

// ──────────────────────────────────────
// 👤  USERNAME RULES  — edit these
// ──────────────────────────────────────
const USERNAME_RULES = [
  { test: (u) => u.length >= 3, label: "At least 3 characters" },
  { test: (u) => u.length <= 20, label: "At most 20 characters" },
  {
    test: (u) => /^[a-zA-Z0-9._]+$/.test(u),
    label: "Letters, numbers, dots, or underscores only",
  },
];

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE_MB = 5;

function RuleChecklist({ rules, value }) {
  return (
    <ul className="pw-rules">
      {rules.map((r, i) => (
        <li key={i} className={r.test(value) ? "pass" : ""}>
          {r.test(value) ? "✅" : "⬜"} {r.label}
        </li>
      ))}
    </ul>
  );
}

export default function SetupProfile({ profile, onComplete }) {
  const { user, claimUsername } = useAuth();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);

  // Prevent closing if no username claimed
  function handleClose() {
    alertError(
      "Profile required",
      "You need to pick a username to continue."
    );
  }

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

    // Validate username
    for (const rule of USERNAME_RULES) {
      if (!rule.test(username)) {
        return alertError("Invalid username", rule.label);
      }
    }

    setUploading(true);
    const toast = alertLoading("Setting up your profile…");

    try {
      // 1. Claim the username
      await claimUsername(username);

      // 2. Upload profile picture if selected
      let profilePic = profile?.profilePic || "";
      if (file) {
        const storageRef = ref(storage, `profilePics/${user.uid}`);
        await uploadBytes(storageRef, file);
        profilePic = await getDownloadURL(storageRef);
      }

      // 3. Save bio + profile pic
      await updateDoc(doc(db, "users", user.uid), {
        bio: bio.trim(),
        profilePic,
      });

      toast.close();
      await alertSuccess(
        "Profile complete! 🎉",
        `Welcome @${username.trim()} — you're all set!`
      );
      onComplete();
    } catch (err) {
      toast.close();
      alertError(
        "Setup failed",
        err.message.replace("Firebase: ", "") || "Something went wrong."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <form
        className="modal setup-profile-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>Set up your profile</h3>
        <p className="muted" style={{ margin: "-4px 0 8px", fontSize: "13px" }}>
          Pick a unique username — this is how people find you.
        </p>

        <label className="muted">Username *</label>
        <input
          type="text"
          placeholder="e.g. john.doe"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        {username && <RuleChecklist rules={USERNAME_RULES} value={username} />}

        <label className="muted">Profile picture</label>
        {preview && (
          <img src={preview} alt="Preview" className="avatar-preview" />
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
        />

        <label className="muted">Bio (optional, max 150)</label>
        <textarea
          rows="3"
          maxLength={150}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          style={{ fontFamily: "inherit", fontSize: "14px" }}
        />
        <p className="muted">{bio.length}/150</p>

        <button type="submit" disabled={uploading}>
          {uploading ? "Saving…" : "Complete setup"}
        </button>
      </form>
    </div>
  );
}
