import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { alertConfirm, alertSuccess } from "../utils/alerts";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import {
  Home,
  Search,
  Compass,
  Film,
  MessageCircle,
  Heart,
  PlusSquare,
  Bookmark,
  User,
  LogOut,
  Menu,
  X,
  Camera,
  MoreHorizontal,
  Music,
} from "lucide-react";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profilePic, setProfilePic] = useState("");
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef(null);

  const isLanding = location.pathname === "/";

  // Fetch profile pic
  useEffect(() => {
    if (!user) return;
    const cacheKey = `pic_${user.uid}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setProfilePic(cached);
      return;
    }
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists() && snap.data().profilePic) {
        localStorage.setItem(cacheKey, snap.data().profilePic);
        setProfilePic(snap.data().profilePic);
      }
    });
  }, [user]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setShowMore(false);
  }, [location.pathname]);

  // Close more menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setShowMore(false);
      }
    }
    if (showMore) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMore]);

  async function handleLogout() {
    setShowMore(false);
    const confirmed = await alertConfirm("Log out?", "Are you sure you want to log out?");
    if (!confirmed) return;
    await logout();
    await alertSuccess("Logged out", "See you next time!");
    navigate("/");
  }

  function handleNewPost() {
    if (window.__histogramShowCreate) {
      window.__histogramShowCreate();
    } else {
      navigate("/home");
      setTimeout(() => window.__histogramShowCreate?.(), 300);
    }
  }

  // Landing page - no sidebar
  if (isLanding || !user) return null;

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

  const navItems = [
    { icon: Home, label: "Home", path: "/home" },
    { icon: Search, label: "Search", path: "/search" },
    { icon: Compass, label: "Explore", path: "/explore" },
    { icon: Film, label: "Reels", path: "/reels" },
    { icon: MessageCircle, label: "Messages", path: "/messages" },
    { icon: Heart, label: "Notifications", path: "/notifications" },
    { icon: PlusSquare, label: "Create", action: handleNewPost },
    { icon: Bookmark, label: "Saved", path: "/saved" },
    { icon: Music, label: "Music", path: "/music" },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
        <div className="sidebar-inner">
          {/* Logo */}
          <Link to="/home" className="sidebar-logo">
            <Camera size={28} className="sidebar-logo-icon" />
            {!collapsed && <span className="sidebar-logo-text">Histogram</span>}
          </Link>

          {/* Nav Items */}
          <nav className="sidebar-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              if (item.action) {
                return (
                  <button
                    key={item.label}
                    className="sidebar-nav-item"
                    onClick={item.action}
                    title={item.label}
                  >
                    <Icon size={24} />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                );
              }
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`sidebar-nav-item ${isActive(item.path) ? "active" : ""}`}
                  title={item.label}
                >
                  <Icon size={24} fill={isActive(item.path) ? "currentColor" : "none"} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Profile + More */}
          <div className="sidebar-bottom">
            <Link
              to={`/profile/${user.uid}`}
              className={`sidebar-nav-item ${isActive("/profile") ? "active" : ""}`}
              title="Profile"
            >
              {profilePic ? (
                <img src={profilePic} alt="" className="sidebar-avatar" />
              ) : (
                <div className="sidebar-avatar sidebar-avatar-fallback">
                  {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              {!collapsed && <span>Profile</span>}
            </Link>

            <div className="sidebar-more-wrapper" ref={moreRef}>
              <button
                className="sidebar-nav-item"
                onClick={() => setShowMore((o) => !o)}
                title="More"
              >
                <MoreHorizontal size={24} />
                {!collapsed && <span>More</span>}
              </button>

              {showMore && (
                <div className="sidebar-more-menu">
                  <button className="sidebar-more-item" onClick={handleLogout}>
                    <LogOut size={16} />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Collapse toggle */}
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Bar */}
      <nav className="mobile-bar">
        <Link to="/home" className={`mobile-bar-item ${isActive("/home") ? "active" : ""}`}>
          <Home size={24} fill={isActive("/home") ? "currentColor" : "none"} />
        </Link>
        <Link to="/explore" className={`mobile-bar-item ${isActive("/explore") ? "active" : ""}`}>
          <Compass size={24} fill={isActive("/explore") ? "currentColor" : "none"} />
        </Link>
        <button className="mobile-bar-item mobile-bar-create" onClick={handleNewPost}>
          <PlusSquare size={24} />
        </button>
        <Link to="/reels" className={`mobile-bar-item ${isActive("/reels") ? "active" : ""}`}>
          <Film size={24} />
        </Link>
        <Link
          to={`/profile/${user.uid}`}
          className={`mobile-bar-item ${isActive("/profile") ? "active" : ""}`}
        >
          {profilePic ? (
            <img src={profilePic} alt="" className="mobile-bar-avatar" />
          ) : (
            <div className="mobile-bar-avatar mobile-bar-avatar-fallback">
              {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?"}
            </div>
          )}
        </Link>
      </nav>

      {/* Mobile overlay for open menus */}
      {mobileOpen && (
        <div className="sidebar-mobile-overlay" onClick={() => setMobileOpen(false)} />
      )}
    </>
  );
}
