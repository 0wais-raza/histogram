import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { alertConfirm, alertSuccess } from "../utils/alerts";
import {
  Sun,
  Moon,
  LogOut,
  Home,
  User,
  LogIn,
  UserPlus,
} from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname === "/") return null;

  const isActive = (path) => location.pathname === path;

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
            <Link to="/home" className={isActive("/home") ? "active" : ""}>
              <Home size={16} />
              Feed
            </Link>
            <Link
              to={`/profile/${user.uid}`}
              className={location.pathname.includes("/profile") ? "active" : ""}
            >
              <User size={16} />
              Profile
            </Link>
            <button onClick={toggle}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
              {dark ? "Light" : "Dark"}
            </button>
            <button onClick={handleLogout} className="nav-btn-primary">
              <LogOut size={16} />
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className={isActive("/login") ? "active" : ""}>
              <LogIn size={16} />
              Log in
            </Link>
            <Link
              to="/signup"
              className={isActive("/signup") ? "active" : ""}
            >
              <UserPlus size={16} />
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
