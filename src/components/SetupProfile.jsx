import { useState, useRef, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { alertError } from "../utils/alerts";
import { uploadImage } from "../utils/uploadImage";
import { User, Check, X, Camera } from "lucide-react";

// ──────────────────────────────────────
// USERNAME RULES
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
          {r.test(value) ? <Check size={12} /> : <X size={12} />} {r.label}
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

  const fileRef = useRef(null);

  // Lock body scroll when modal opens
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev || ""; };
  }, []);

  function handleClose(e) {
    // Prevent backdrop click from closing — profile setup is required
    if (e) e.stopPropagation();
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
      return alertError("File too large", `Image must be under ${MAX_SIZE_MB} MB.`);
    }

    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    for (const rule of USERNAME_RULES) {
      if (!rule.test(username)) {
        return alertError("Invalid username", rule.label);
      }
    }

    setUploading(true);
    let profilePic = profile?.profilePic || "";
    let usernameClaimed = false;

    try {
      // Step 1: Claim username first
      await claimUsername(username);
      usernameClaimed = true;

      // Step 2: Upload image if provided
      if (file) {
        profilePic = await uploadImage(file);
      }

      // Step 3: Update bio and profile pic
      await updateDoc(doc(db, "users", user.uid), {
        bio: bio.trim(),
        profilePic,
      });

      // Success — reset body scroll and notify parent
      document.body.style.overflow = "";
      onComplete();
    } catch (err) {
      // If username was already claimed but something else failed,
      // still complete — the user can edit bio/pic later
      if (usernameClaimed) {
        document.body.style.overflow = "";
        onComplete();
      } else {
        alertError(
          "Setup failed",
          err.message.replace("Firebase: ", "") || "Something went wrong."
        );
      }
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
        <div className="setup-profile-header">
          <User size={20} />
          <span>Set up your profile</span>
        </div>
        <p className="muted" style={{ margin: "-4px 0 8px", fontSize: "13px" }}>
          Pick a unique username — this is how people find you.
        </p>

        {/* ── Avatar picker ── */}
        <div className="setup-avatar-picker">
          <div
            className="setup-avatar-ring"
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="Preview" className="setup-avatar-img" />
            ) : (
              <div className="setup-avatar-placeholder">
                <Camera size={24} />
              </div>
            )}
            <div className="setup-avatar-overlay">
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

        <label className="muted">Username *</label>
        <input
          type="text"
          placeholder="e.g. john.doe"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        {username && <RuleChecklist rules={USERNAME_RULES} value={username} />}

        <label className="muted">Bio (optional, max 150)</label>
        <textarea
          rows="3"
          maxLength={150}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
        <p className="muted">{bio.length}/150</p>

        <button type="submit" disabled={uploading} className="setup-submit">
          {uploading ? (
            <span className="setup-btn-loading">
              <span className="setup-btn-spinner" />
              Saving...
            </span>
          ) : (
            "Complete setup"
          )}
        </button>
      </form>
    </div>
  );
}
