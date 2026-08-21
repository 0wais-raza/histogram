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
import { Search, Users } from "lucide-react";
import { UserListSkeleton } from "../components/LoadingSkeleton";

export default function Explore() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [followerCounts, setFollowerCounts] = useState({});

  useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      try {
        const q = query(
          collection(db, "users"),
          orderBy("createdAt", "desc"),
          limit(100)
        );
        const snap = await getDocs(q);

        const validUsers = [];
        for (const d of snap.docs) {
          const data = d.data();
          if (!data.username || !data.usernameLower) continue;
          validUsers.push({ uid: d.id, ...data });
        }

        const filteredUsers = validUsers.filter((u) => u.uid !== user?.uid);
        setUsers(filteredUsers);

        // Batch-fetch follower counts (parallel)
        const countPromises = filteredUsers.map((u) =>
          getDocs(query(collection(db, "follows"), where("followingId", "==", u.uid), limit(1000)))
            .then((snap) => [u.uid, snap.size])
            .catch(() => [u.uid, u.followersCount || 0])
        );
        const countResults = await Promise.all(countPromises);
        const counts = Object.fromEntries(countResults);
        setFollowerCounts(counts);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, [user]);

  const filtered = users.filter(
    (u) =>
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.bio?.toLowerCase().includes(search.toLowerCase())
  );

  usePageAnimations("explore");

  return (
    <div className="page page-enter">
      <div className="home-header">
        <h1 className="home-title">
          <span className="neon-text">Explore</span> People
        </h1>
      </div>

      <div className="search-bar">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="feed-skeleton-wrap">
          <UserListSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <div className="home-empty">
          <Users size={40} strokeWidth={1.5} />
          <p>{search ? "No users found." : "No users yet."}</p>
        </div>
      ) : (
        <div className="feed">
          {filtered.map((u) => (
            <Link
              key={u.uid}
              to={`/profile/${u.uid}`}
              className="feed-post explore-user-card"
            >
              <div className="feed-post-header">
                {u.profilePic ? (
                  <img
                    src={u.profilePic}
                    alt=""
                    className="feed-post-avatar-img"
                  />
                ) : (
                  <div className="feed-post-avatar">
                    {u.username?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <div className="feed-post-meta-col" style={{ minWidth: 0 }}>
                  <span className="feed-post-author">
                    @{u.username}
                  </span>
                  {u.bio && (
                    <span className="explore-user-bio">{u.bio}</span>
                  )}
                </div>
                <div className="explore-user-stats">
                  <span>{followerCounts[u.uid] ?? u.followersCount ?? 0} followers</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
