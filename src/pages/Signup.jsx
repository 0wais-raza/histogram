import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import { alertError, alertSuccess } from "../utils/alerts";

// ──────────────────────────────────────
// 🔒  PASSWORD RULES  — edit these
// ──────────────────────────────────────
const PASSWORD_RULES = [
  { test: (p) => p.length >= 8, label: "At least 8 characters" },
  { test: (p) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p) => /[0-9]/.test(p), label: "One number" },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: "One special character" },
];

function getStrength(password) {
  let score = 0;
  for (const rule of PASSWORD_RULES) {
    if (rule.test(password)) score++;
  }
  return score;
}

const STRENGTH_COLORS = ["#ef4444", "#f97316", "#eab308", "#a3e635", "#22c55e", "#10b981"];
const STRENGTH_LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong", "Very strong"];

function PasswordStrength({ password }) {
  const score = getStrength(password);
  const color = STRENGTH_COLORS[score];
  const label = STRENGTH_LABELS[score];

  if (!password) return null;

  return (
    <div className="pw-strength">
      <div className="pw-strength-bar-bg">
        {PASSWORD_RULES.map((_, i) => (
          <div
            key={i}
            className="pw-strength-bar-fill"
            style={{
              width: `${100 / PASSWORD_RULES.length}%`,
              background: i < score ? color : "var(--border)",
            }}
          />
        ))}
      </div>
      <span className="pw-strength-label" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

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

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const allRulesPass = useMemo(
    () => PASSWORD_RULES.every((r) => r.test(password)),
    [password]
  );

  async function handleSubmit(e) {
    e.preventDefault();

    if (!allRulesPass) {
      return alertError(
        "Password too weak",
        "Please meet all the password requirements below."
      );
    }

    if (password !== confirm) {
      return alertError("Passwords don't match", "Re-enter your password.");
    }

    setLoading(true);
    try {
      await signup(email, password);
      alertSuccess(
        "Account created! 🎉",
        "Now let's set up your profile — pick a username and photo."
      );
      navigate("/home");
    } catch (err) {
      const msg = err.message.replace("Firebase: ", "");
      alertError("Signup failed", friendlyAuthError(msg));
    } finally {
      setLoading(false);
    }
  }

  usePageAnimations("auth");

  return (
    <div className="auth-page page-enter">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Histogram</h1>
        <h2>Sign up</h2>

        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <div className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password (min 8)"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <button
            type="button"
            className="pw-toggle"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>

        <PasswordStrength password={password} />
        {password && <RuleChecklist rules={PASSWORD_RULES} value={password} />}

        <div className="password-field">
          <input
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          <button
            type="button"
            className="pw-toggle"
            onClick={() => setShowConfirm((v) => !v)}
            tabIndex={-1}
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? "🙈" : "👁️"}
          </button>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Sign up"}
        </button>

        <p>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}

function friendlyAuthError(msg) {
  if (msg.includes("email-already-in-use"))
    return "An account with this email already exists.";
  if (msg.includes("invalid-email")) return "That email address is invalid.";
  if (msg.includes("weak-password")) return "Choose a stronger password.";
  return msg || "Something went wrong. Please try again.";
}
