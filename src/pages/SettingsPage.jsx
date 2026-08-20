import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import { alertConfirm, alertError, alertSuccess } from "../utils/alerts";
import {
  doc, deleteDoc, collection, query, where, getDocs, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  deleteUser,
} from "firebase/auth";
import {
  Shield, Trash2, Key, User, LogOut, ChevronRight, Lock,
  Check, X, Info, Eye, EyeOff, AlertTriangle,
} from "lucide-react";

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

export default function SettingsPage() {
  const { user, logout, claimUsername } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Account state
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (!currentPassword) return alertError("Current password required", "Enter your current password.");
    if (newPassword !== confirmPassword) return alertError("Passwords don't match", "Re-enter your new password.");
    if (!PASSWORD_RULES.every((r) => r.test(newPassword))) {
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
      setActiveSection(null);
      await alertSuccess("Password updated!", "Your password has been changed.");
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

  async function handleDeleteAccount() {
    if (deleteConfirm !== "DELETE") return;
    setDeleting(true);
    try {
      // Delete user's posts
      const postsSnap = await getDocs(query(collection(db, "posts"), where("authorId", "==", user.uid)));
      const batch = writeBatch(db);
      postsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();

      // Delete follows
      const followSnap1 = await getDocs(query(collection(db, "follows"), where("followerId", "==", user.uid)));
      followSnap1.docs.forEach((d) => deleteDoc(d.ref).catch(() => {}));
      const followSnap2 = await getDocs(query(collection(db, "follows"), where("followingId", "==", user.uid)));
      followSnap2.docs.forEach((d) => deleteDoc(d.ref).catch(() => {}));

      // Delete user doc
      await deleteDoc(doc(db, "users", user.uid));

      // Delete auth
      await deleteUser(user);
      await alertSuccess("Account deleted", "Your account has been permanently deleted.");
      navigate("/");
    } catch (err) {
      const msg = err.message.replace("Firebase: ", "");
      if (msg.includes("recent-login")) {
        alertError("Re-authentication required", "Please log out and log back in, then try deleting your account again.");
      } else {
        alertError("Delete failed", msg || "Something went wrong.");
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleLogout() {
    const confirmed = await alertConfirm("Log out?", "Are you sure you want to log out?");
    if (!confirmed) return;
    await logout();
    navigate("/");
  }

  usePageAnimations("home");

  const sections = [
    {
      id: "password",
      icon: Key,
      title: "Change password",
      subtitle: "Update your password regularly",
    },
    {
      id: "account",
      icon: Shield,
      title: "Account",
      subtitle: "Manage your account information",
    },
    {
      id: "delete",
      icon: Trash2,
      title: "Delete account",
      subtitle: "Permanently delete your account and data",
      danger: true,
    },
    {
      id: "about",
      icon: Info,
      title: "About",
      subtitle: "Histogram — Instagram-inspired social app",
    },
  ];

  return (
    <div className="page page-enter">
      <div className="home-header">
        <h1 className="home-title">
          <span className="neon-text">Settings</span>
        </h1>
      </div>

      {!activeSection && (
        <div className="settings-list">
          {/* Profile shortcut */}
          <button className="settings-item" onClick={() => navigate(`/profile/${user.uid}`)}>
            <div className="settings-item-icon-wrap">
              <User size={20} />
            </div>
            <div className="settings-item-text">
              <span className="settings-item-title">Edit profile</span>
              <span className="settings-item-subtitle">Change your profile picture, bio, username</span>
            </div>
            <ChevronRight size={18} className="settings-item-arrow" />
          </button>

          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                className={`settings-item ${s.danger ? "settings-item-danger" : ""}`}
                onClick={() => setActiveSection(s.id)}
              >
                <div className={`settings-item-icon-wrap ${s.danger ? "settings-item-icon-danger" : ""}`}>
                  <Icon size={20} />
                </div>
                <div className="settings-item-text">
                  <span className="settings-item-title">{s.title}</span>
                  <span className="settings-item-subtitle">{s.subtitle}</span>
                </div>
                <ChevronRight size={18} className="settings-item-arrow" />
              </button>
            );
          })}

          <button className="settings-item settings-item-danger" onClick={handleLogout}>
            <div className="settings-item-icon-wrap settings-item-icon-danger">
              <LogOut size={20} />
            </div>
            <div className="settings-item-text">
              <span className="settings-item-title">Log out</span>
              <span className="settings-item-subtitle">Sign out of your account</span>
            </div>
          </button>
        </div>
      )}

      {/* ── Change Password ── */}
      {activeSection === "password" && (
        <div className="settings-section">
          <button className="settings-back" onClick={() => setActiveSection(null)}>
            ← Back
          </button>
          <h2 className="settings-section-title">Change Password</h2>
          <form className="settings-form" onSubmit={handlePasswordChange}>
            <label className="muted">Current Password</label>
            <div className="password-field">
              <input
                type={showCurrentPw ? "text" : "password"}
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowCurrentPw((v) => !v)}>
                {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <label className="muted">New Password</label>
            <div className="password-field">
              <input
                type={showNewPw ? "text" : "password"}
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowNewPw((v) => !v)}>
                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
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
              />
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p style={{ fontSize: 12, color: "var(--error)" }}>Passwords don't match</p>
            )}

            <button
              type="submit"
              className="btn primary"
              disabled={changingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
            >
              {changingPassword ? (
                <span className="setup-btn-loading"><span className="setup-btn-spinner" /> Updating...</span>
              ) : (
                <><Lock size={16} /> Update Password</>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ── Account Info ── */}
      {activeSection === "account" && (
        <div className="settings-section">
          <button className="settings-back" onClick={() => setActiveSection(null)}>
            ← Back
          </button>
          <h2 className="settings-section-title">Account</h2>
          <div className="settings-info-card">
            <div className="settings-info-row">
              <span className="settings-info-label">Email</span>
              <span className="settings-info-value">{user?.email}</span>
            </div>
            <div className="settings-info-row">
              <span className="settings-info-label">User ID</span>
              <span className="settings-info-value settings-info-mono">{user?.uid?.slice(0, 16)}...</span>
            </div>
            <div className="settings-info-row">
              <span className="settings-info-label">Provider</span>
              <span className="settings-info-value">{user?.providerData?.[0]?.providerId || "Email"}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Account ── */}
      {activeSection === "delete" && (
        <div className="settings-section">
          <button className="settings-back" onClick={() => { setActiveSection(null); setDeleteConfirm(""); }}>
            ← Back
          </button>
          <h2 className="settings-section-title" style={{ color: "var(--error)" }}>
            <AlertTriangle size={22} /> Delete Account
          </h2>
          <div className="settings-warning-box">
            <p><strong>This action is permanent and cannot be undone.</strong></p>
            <ul>
              <li>All your posts will be deleted</li>
              <li>Your followers and following connections will be removed</li>
              <li>Your profile data will be permanently erased</li>
              <li>You will be logged out immediately</li>
            </ul>
          </div>
          <label className="muted">Type <strong>DELETE</strong> to confirm</label>
          <input
            type="text"
            placeholder="Type DELETE"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            style={{
              padding: "12px 16px",
              border: "1px solid rgba(248,113,113,0.3)",
              borderRadius: "var(--radius-md)",
              background: "rgba(10, 10, 20, 0.6)",
              color: "var(--text)",
              fontSize: 14,
              fontFamily: "inherit",
              width: "100%",
            }}
          />
          <button
            className="btn danger"
            disabled={deleteConfirm !== "DELETE" || deleting}
            onClick={handleDeleteAccount}
            style={{ width: "100%" }}
          >
            {deleting ? (
              <span className="setup-btn-loading"><span className="setup-btn-spinner" /> Deleting...</span>
            ) : (
              <><Trash2 size={16} /> Delete Account</>
            )}
          </button>
        </div>
      )}

      {/* ── About ── */}
      {activeSection === "about" && (
        <div className="settings-section">
          <button className="settings-back" onClick={() => setActiveSection(null)}>
            ← Back
          </button>
          <h2 className="settings-section-title">About Histogram</h2>
          <div className="settings-info-card">
            <div className="settings-info-row">
              <span className="settings-info-label">Version</span>
              <span className="settings-info-value">1.0.0</span>
            </div>
            <div className="settings-info-row">
              <span className="settings-info-label">Built with</span>
              <span className="settings-info-value">React + Firebase</span>
            </div>
            <div className="settings-info-row">
              <span className="settings-info-label">Theme</span>
              <span className="settings-info-value">Liquid Glass Dark</span>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 16, textAlign: "center" }}>
            Instagram-inspired social media app with real-time features.
          </p>
        </div>
      )}
    </div>
  );
}
