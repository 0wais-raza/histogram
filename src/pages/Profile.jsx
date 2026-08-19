import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  doc, getDoc, query, collection, where, orderBy,
  deleteDoc, onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import EditProfile from "../components/EditProfile";
import { ImageIcon, Trash2, UserPlus, UserMinus } from "lucide-react";
import { ProfileSkeleton } from "../components/LoadingSkeleton";
import { alertConfirm, alertError } from "../utils/alerts";

export default function Profile() {
  const { uid } = useParams();
  const { user, followUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const isOwner = user?.uid === uid;

  // ── Realtime profile ──
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) setProfile(snap.data());
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [uid]);

  // ── Realtime posts ──
  useEffect(() => {
    const q = query(collection(db, "posts"), where("authorId", "==", uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [uid]);

  // ── Realtime follow check ──
  useEffect(() => {
    if (isOwner || !user) return;
    const unsub = onSnapshot(doc(db, "follows", `${user.uid}_${uid}`), (snap) => {
      setFollowing(snap.exists());
    });
    return unsub;
  }, [uid, user, isOwner]);

  async function handleFollow() {
    setFollowLoading(true);
    try { await followUser(uid); }
    catch {} finally { setFollowLoading(false); }
  }

  async function handleDeletePost(post) {
    if (!(await alertConfirm("Delete post?", "This action cannot be undone."))) return;
    try { await deleteDoc(doc(db, "posts", post.id)); }
    catch (err) { alertError("Delete failed", err.message); }
  }

  usePageAnimations("profile");

  if (loading) return <div className="page"><ProfileSkeleton /></div>;
  if (!profile) return <div className="page">Profile not found.</div>;
  if (!profile.username && isOwner) {
    return <div className="page"><h1>Your profile isn't set up yet</h1><p>Go to the <Link to="/home">home page</Link> to complete your profile.</p></div>;
  }

  return (
    <div className="page page-enter">
      <div className="profile-header">
        <img className="avatar" src={profile.profilePic || "/histogram.png"} alt={profile.username || "user"} />
        <div className="profile-info">
          <h2>@{profile.username || "New user"}</h2>
          <p className="bio">{profile.bio || "No bio yet."}</p>
          <div className="stats">
            <div className="stat-item"><span className="stat-value">{posts.length}</span><span className="stat-label">Posts</span></div>
            <Link to={`/profile/${uid}/followers`} className="stat-item stat-link"><span className="stat-value">{profile.followersCount ?? 0}</span><span className="stat-label">Followers</span></Link>
            <Link to={`/profile/${uid}/followers`} className="stat-item stat-link"><span className="stat-value">{profile.followingCount ?? 0}</span><span className="stat-label">Following</span></Link>
          </div>
          <div className="profile-actions">
            {isOwner ? (
              <button className="btn" onClick={() => setEditing(true)}>Edit profile</button>
            ) : user && (
              <button className={`btn ${following ? "ghost" : "primary"}`} onClick={handleFollow} disabled={followLoading}>
                {following ? <><UserMinus size={16} /> Unfollow</> : <><UserPlus size={16} /> Follow</>}
              </button>
            )}
          </div>
        </div>
      </div>

      {editing && <EditProfile profile={profile} onClose={() => setEditing(false)} />}

      <div className="profile-posts">
        {posts.length === 0 ? (
          <div className="profile-empty"><ImageIcon size={48} strokeWidth={1.5} /><p>{isOwner ? "No posts yet — create your first!" : "No posts yet."}</p></div>
        ) : posts.map((p) => (
          <div key={p.id} className="grid-item-wrapper">
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.caption || "Post"} className="grid-item" />
            ) : (
              <div className="grid-item grid-item-text">{p.caption || "Text post"}</div>
            )}
            {isOwner && (
              <button className="grid-item-delete" onClick={() => handleDeletePost(p)} title="Delete post"><Trash2 size={14} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
