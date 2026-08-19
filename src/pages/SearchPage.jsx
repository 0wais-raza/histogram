import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import { Search, Users, X } from "lucide-react";

export default function SearchPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("recentSearches");
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setUsers([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "users"),
          where("username", "!=", ""),
          orderBy("username"),
          limit(30)
        );
        const snap = await getDocs(q);
        const filtered = snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((u) =>
            u.uid !== user?.uid &&
            (u.username?.toLowerCase().includes(search.toLowerCase()) ||
             u.email?.toLowerCase().includes(search.toLowerCase()))
          );
        setUsers(filtered);
      } catch {}
      finally { setLoading(false); }
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, user]);

  function handleSelectUser(u) {
    // Save to recent searches
    const updated = [u, ...recentSearches.filter((r) => r.uid !== u.uid)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem("recentSearches", JSON.stringify(updated));
  }

  function clearRecent() {
    setRecentSearches([]);
    localStorage.removeItem("recentSearches");
  }

  usePageAnimations("home");

  return (
    <div className="page page-enter">
      <div className="search-bar">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch("")}>
            <X size={16} />
          </button>
        )}
      </div>

      {!search.trim() && recentSearches.length > 0 && (
        <div className="search-recent">
          <div className="search-recent-header">
            <span>Recent</span>
            <button onClick={clearRecent}>Clear all</button>
          </div>
          {recentSearches.map((u) => (
            <Link
              key={u.uid}
              to={`/profile/${u.uid}`}
              className="search-result-item"
              onClick={() => handleSelectUser(u)}
            >
              {u.profilePic ? (
                <img src={u.profilePic} alt="" className="search-result-avatar" />
              ) : (
                <div className="search-result-avatar search-result-avatar-fallback">
                  {u.username?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              <div className="search-result-info">
                <span className="search-result-name">@{u.username}</span>
                {u.bio && <span className="search-result-bio">{u.bio}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {search.trim() && (
        <div className="search-results">
          {loading ? (
            <div className="home-empty"><p>Searching...</p></div>
          ) : users.length === 0 ? (
            <div className="home-empty">
              <Users size={40} strokeWidth={1.5} />
              <p>No users found.</p>
            </div>
          ) : (
            users.map((u) => (
              <Link
                key={u.uid}
                to={`/profile/${u.uid}`}
                className="search-result-item"
                onClick={() => handleSelectUser(u)}
              >
                {u.profilePic ? (
                  <img src={u.profilePic} alt="" className="search-result-avatar" />
                ) : (
                  <div className="search-result-avatar search-result-avatar-fallback">
                    {u.username?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <div className="search-result-info">
                  <span className="search-result-name">@{u.username}</span>
                  {u.bio && <span className="search-result-bio">{u.bio}</span>}
                </div>
                <span className="search-result-followers">{u.followersCount ?? 0}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
