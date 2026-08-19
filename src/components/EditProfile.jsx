import { useState, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { alertError, alertSuccess } from "../utils/alerts";
import { uploadImage } from "../utils/uploadImage";
import { Save, X, Camera, User, Lock, Check } from "lucide-react";

const MAX_BIO = 150;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE_MB = 5;

const USERNAME_RULES = [
  { test: (u) => u.length >= 3, label: "At least 3 characters" },
  { test: (u) => u.length <= 20, label: "At most 20 characters" },
  {
    test: (u) => /^[a-zA-Z0-9._]+$/.test(u),
    label: "Letters, numbers, dots, or underscores only",
  },
];

const PASSWORD_RULES = [
  { test: (p) => p.length >= 8, label: "At least 8 characters" },
  { test: (p) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p) => /[0-9]/.test(p), label: "One number" },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: "One special character" },
];

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

export default function EditProfile({ profile, onClose, onSaved }) {
  const { user, claimUsername } = useAuth();
  const [bio, setBio] = useState(profile.bio || "");
  const [username, setUsername] = useState(profile.username || "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(profile.profilePic || "");
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  // Password change state — all inline now
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const fileRef = useRef(null);

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;

    if (!ALLOWED_TYPES.includes(f.type)) {
      return alertError("Invalid file type", "Please upload a JPEG, PNG, GIF, or WebP image.");
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return alertError("File too large", `Image must be under ${MAX_SIZE_MB} MB.`);
    }

    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setUploading(true);

    try {
      let profilePic = profile.profilePic || "";
      if (file) {
        profilePic = await uploadImage(file);
      }

      const updates = {
        bio: bio.trim(),
        profilePic,
      };

      // Handle username change
      if (username.trim() && username.trim() !== profile.username) {
        const clean = username.trim().toLowerCase();
        for (const rule of USERNAME_RULES) {
          if (!rule.test(username.trim())) {
            throw new Error(rule.label);
          }
        }
        await claimUsername(username.trim());
        updates.username = username.trim();
        updates.usernameLower = clean;
      }

      await updateDoc(doc(db, "users", user.uid), updates);

      await alertSuccess("Profile updated!", "Your changes have been saved.");
      onSaved?.();
      onClose();
    } catch (err) {
      alertError("Update failed", err.message.replace("Firebase: ", "") || "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();

    if (!currentPassword) {
      return alertError("Current password required", "Enter your current password.");
    }
    if (newPassword !== confirmPassword) {
      return alertError("Passwords don't match", "Re-enter your new password.");
    }

    const allRulesPass = PASSWORD_RULES.every((r) => r.test(newPassword));
    if (!allRulesPass) {
      return alertError("Password too weak", "Please meet all password requirements.");
    }

    setChangingPassword(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await alertSuccess("Password updated!", "Your password has been changed successfully.");
    } catch (err) {
      const msg = err.message.replace("Firebase: ", "");
      if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        alertError("Wrong password", "The current password you entered is incorrect.");
      } else {
        alertError("Update failed", msg || "Something went wrong.");
      }
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal edit-profile-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={activeTab === "profile" ? handleProfileSubmit : handlePasswordSubmit}
      >
        <div className="create-post-header">
          <h3>Edit profile</h3>
          <button type="button" className="btn icon-only" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="edit-profile-tabs">
          <button
            type="button"
            className={`edit-profile-tab ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <User size={16} /> Profile
          </button>
          <button
            type="button"
            className={`edit-profile-tab ${activeTab === "password" ? "active" : ""}`}
            onClick={() => setActiveTab("password")}
          >
            <Lock size={16} /> Password
          </button>
        </div>

        {activeTab === "profile" ? (
          <>
            {/* Avatar picker */}
            <div className="edit-avatar-picker">
              <div className="edit-avatar-ring" onClick={() => fileRef.current?.click()}>
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

            <label className="muted">Username</label>
            <input
              type="text"
              placeholder="Your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            {username && username !== profile.username && (
              <RuleChecklist rules={USERNAME_RULES} value={username} />
            )}

            <label className="muted">Bio (max {MAX_BIO})</label>
            <textarea
              rows="4"
              maxLength={MAX_BIO}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <p className="muted">{bio.length}/{MAX_BIO}</p>

            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={onClose}>
                <X size={16} /> Cancel
              </button>
              <button className="btn primary" disabled={uploading}>
                {uploading ? (
                  <span className="setup-btn-loading">
                    <span className="setup-btn-spinner" /> Saving...
                  </span>
                ) : (
                  <><Save size={16} /> Save</>
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="muted">Current Password</label>
            <div className="password-field">
              <input
                type={showCurrentPw ? "text" : "password"}
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowCurrentPw((v) => !v)}
                tabIndex={-1}
              >
                {showCurrentPw ? <X size={16} /> : <Lock size={16} />}
              </button>
            </div>

            <label className="muted">New Password</label>
            <div className="password-field">
              <input
                type={showNewPw ? "text" : "password"}
                placeholder="New password (min 8)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowNewPw((v) => !v)}
                tabIndex={-1}
              >
                {showNewPw ? <X size={16} /> : <Lock size={16} />}
              </button>
            </div>
            {newPassword && <RuleChecklist rules={PASSWORD_RULES} value={newPassword} />}

            <label className="muted">Confirm Password</label>
            <div className="password-field">
              <input
                type={showNewPw ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="error" style={{ fontSize: 12 }}>Passwords don't match</p>
            )}

            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={onClose}>
                <X size={16} /> Cancel
              </button>
              <button
                className="btn primary"
                disabled={changingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
              >
                {changingPassword ? (
                  <span className="setup-btn-loading">
                    <span className="setup-btn-spinner" /> Updating...
                  </span>
                ) : (
                  <><Lock size={16} /> Update Password</>
                )}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
