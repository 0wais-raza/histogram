import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import {
  alertError,
  alertSuccess,
  alertPrompt,
} from "../utils/alerts";
import { Mail, Lock, Eye, EyeOff, LogIn, Globe } from "lucide-react";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, resetPassword, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(identifier, password);
      navigate("/home");
    } catch (err) {
      const msg = err.message.replace("Firebase: ", "");
      alertError("Login failed", friendlyAuthError(msg));
      // Don't redirect on error — let user fix their input
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      navigate("/home");
    } catch (err) {
      const msg = err.message.replace("Firebase: ", "");
      if (!msg.includes("popup-closed-by-user")) {
        alertError("Google sign-in failed", friendlyAuthError(msg));
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleForgotPassword() {
    const value = await alertPrompt(
      "Reset your password",
      "Enter your email or username"
    );
    if (!value) return;

    try {
      await resetPassword(value);
      alertSuccess(
        "Check your inbox",
        "We sent a password reset link. Check spam if you don't see it."
      );
    } catch (err) {
      alertError(
        "Could not send reset link",
        friendlyAuthError(err.message.replace("Firebase: ", ""))
      );
    }
  }

  usePageAnimations("auth");

  return (
    <div className="auth-page page-enter">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Histogram</h1>
        <h2>Log in to your account</h2>

        <button
          type="button"
          className="btn google-btn"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
        >
          <Globe size={18} />
          {googleLoading ? "Signing in..." : "Continue with Google"}
        </button>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <div className="input-group">
          <input
            type="text"
            placeholder="Email or username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
          />
          <Mail className="input-icon" size={18} />
        </div>

        <div className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Lock className="input-icon" size={18} />
          <button
            type="button"
            className="pw-toggle"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <button type="submit" disabled={loading} className="auth-submit-btn">
          {loading ? (
            <span className="setup-btn-loading">
              <span className="setup-btn-spinner" /> Logging in...
            </span>
          ) : (
            <>
              <LogIn size={18} />
              Log in
            </>
          )}
        </button>

        <button
          type="button"
          className="text-link forgot-link"
          onClick={handleForgotPassword}
        >
          Forgot password?
        </button>

        <p className="auth-switch-text">
          Don't have an account?{" "}
          <Link to="/signup">Sign up</Link>
        </p>
      </form>
    </div>
  );
}

function friendlyAuthError(msg) {
  if (msg.includes("invalid-credential") || msg.includes("wrong-password"))
    return "Wrong email/username or password. Please try again.";
  if (msg.includes("user-not-found"))
    return "No account found with those credentials.";
  if (msg.includes("too-many-requests"))
    return "Too many attempts. Please wait a few minutes and try again.";
  if (msg.includes("network-request-failed"))
    return "Network error. Check your connection and try again.";
  return msg || "Something went wrong. Please try again.";
}
