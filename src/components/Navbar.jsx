import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { alertConfirm, alertSuccess } from "../utils/alerts";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import {
  LogOut,
  User,
  LogIn,
  UserPlus,
  ChevronDown,
  Camera,
  Pencil,
} from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profilePic, setProfilePic] = useState("");
  const menuRef = useRef(null);

  const isLanding = location.pathname === "/";

  // Fetch profile pic from Firestore
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists() && snap.data().profilePic) {
        setProfilePic(snap.data().profilePic);
      }
    });
  }, [user]);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    setMenuOpen(false);
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
    <nav className={`navbar ${isLanding ? "navbar-landing" : ""}`}>
      <Link to="/home" className="logo">
        <Camera size={22} />
        <span className="logo-text">Histogram</span>
      </Link>

      <div className="nav-right">
        {user ? (
          <div className="nav-avatar-wrapper" ref={menuRef}>
            <button
              className="nav-avatar-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
            >
              {profilePic ? (
                <img src={profilePic} alt="" className="nav-avatar-img" />
              ) : (
                <span className="nav-avatar-fallback">
                  {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?"}
                </span>
              )}
              <ChevronDown size={14} className={`nav-avatar-chevron ${menuOpen ? "open" : ""}`} />
            </button>

            {menuOpen && (
              <div className="nav-dropdown">
                <div className="nav-dropdown-header">
                  {profilePic ? (
                    <img src={profilePic} alt="" className="nav-dropdown-avatar" />
                  ) : (
                    <span className="nav-dropdown-avatar-fallback">
                      {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?"}
                    </span>
                  )}
                  <div className="nav-dropdown-info">
                    <span className="nav-dropdown-name">
                      {user.displayName || user.email?.split("@")[0]}
                    </span>
                    <span className="nav-dropdown-email">{user.email}</span>
                  </div>
                </div>

                <div className="nav-dropdown-divider" />

                <Link to={`/profile/${user.uid}`} className="nav-dropdown-item">
                  <User size={16} />
                  Profile
                </Link>
                <Link to={`/profile/${user.uid}`} className="nav-dropdown-item">
                  <Pencil size={16} />
                  Edit profile
                </Link>

                <div className="nav-dropdown-divider" />

                <button onClick={handleLogout} className="nav-dropdown-item nav-dropdown-logout">
                  <LogOut size={16} />
                  Log out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="nav-auth-links">
            <Link to="/login" className="btn ghost nav-btn">
              <LogIn size={16} />
              Log in
            </Link>
            <Link to="/signup" className="btn primary nav-btn">
              <UserPlus size={16} />
              Sign up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
