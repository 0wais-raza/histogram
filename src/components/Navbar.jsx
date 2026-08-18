import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { alertConfirm, alertSuccess } from "../utils/alerts";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname === "/") return null; // no navbar on landing

  async function handleLogout() {
    const confirmed = await alertConfirm(
      "Log out?",
      "Are you sure you want to log out?"
    );
    if (!confirmed) return;
    await logout();
    await alertSuccess("Logged out", "See you next time!");
    navigate("/");
  }

  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        Histogram
      </Link>
      <div className="nav-links">
        {user ? (
          <>
            <Link to="/home">Feed</Link>
            <Link to={`/profile/${user.uid}`}>
              {user.displayName || "Profile"}
            </Link>
            <button onClick={toggle}>
              {dark ? "☀️ Light" : "🌙 Dark"}
            </button>
            <button onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
