import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import { Users, UserMinus } from "lucide-react";

export default function Followers() {
  const { uid } = useParams();
  const { user, followUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("followers");
  const [followingState, setFollowingState] = useState({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const field = tab === "followers" ? "followingId" : "followerId";
        const resultField = tab === "followers" ? "followerId" : "followingId";

        const snap = await getDocs(
          query(collection(db, "follows"), where(field, "==", uid))
        );

        const uids = snap.docs.map((d) => d.data()[resultField]);
        const userData = [];

        for (const id of uids) {
          const cacheKey = `author_${id}`;
          let data;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            data = JSON.parse(cached);
          } else {
            const userSnap = await getDoc(doc(db, "users", id));
            if (userSnap.exists()) {
              data = { uid: id, ...userSnap.data() };
              localStorage.setItem(cacheKey, JSON.stringify(data));
            }
          }
          if (data) userData.push(data);

          if (user && id !== user.uid) {
            const followSnap = await getDoc(doc(db, "follows", `${user.uid}_${id}`));
            setFollowingState((prev) => ({ ...prev, [id]: followSnap.exists() }));
          }
        }
        setUsers(userData);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, [uid, tab, user]);

  async function handleFollow(targetUid) {
    const result = await followUser(targetUid);
    setFollowingState((prev) => ({ ...prev, [targetUid]: result }));
  }

  usePageAnimations("home");

  return (
    <div className="page page-enter">
      <div className="home-header">
        <h1 className="home-title">
          <span className="neon-text">{tab === "followers" ? "Followers" : "Following"}</span>
        </h1>
      </div>

      <div className="tab-bar">
        <button className={`tab-btn ${tab === "followers" ? "active" : ""}`} onClick={() => setTab("followers")}>
          <Users size={16} /> Followers
        </button>
        <button className={`tab-btn ${tab === "following" ? "active" : ""}`} onClick={() => setTab("following")}>
          <Users size={16} /> Following
        </button>
      </div>

      {loading ? (
        <div className="feed-skeleton-wrap">
          <div className="skeleton-feed">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-header"><div className="skeleton-avatar" /><div className="skeleton-lines"><div className="skeleton-line medium" /></div></div>
            ))}
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="home-empty">
          <Users size={40} strokeWidth={1.5} />
          <p>No {tab} yet.</p>
        </div>
      ) : (
        <div className="feed">
          {users.map((u) => (
            <div key={u.uid || u.id} className="feed-post">
              <div className="feed-post-header">
                <Link to={`/profile/${u.uid || u.id}`} className="feed-post-avatar-link">
                  {u.profilePic ? (
                    <img src={u.profilePic} alt="" className="feed-post-avatar-img" />
                  ) : (
                    <div className="feed-post-avatar">{u.username?.[0]?.toUpperCase() || "?"}</div>
                  )}
                </Link>
                <div className="feed-post-meta" style={{ flex: 1 }}>
                  <Link to={`/profile/${u.uid || u.id}`} className="feed-post-author feed-post-author-link">
                    @{u.username}
                  </Link>
                </div>
                {(u.uid || u.id) !== user?.uid && user && (
                  <button
                    className={`btn btn-xs ${followingState[u.uid || u.id] ? "ghost" : "primary"}`}
                    onClick={() => handleFollow(u.uid || u.id)}
                  >
                    {followingState[u.uid || u.id] ? <><UserMinus size={14} /> Unfollow</> : "Follow"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
