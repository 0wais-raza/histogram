import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, Link } from "react-router-dom";
import {
  doc, query, collection, where, orderBy,
  deleteDoc, onSnapshot, getDoc, setDoc, serverTimestamp, increment, updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import EditProfile from "../components/EditProfile";
import InlineComments from "../components/InlineComments";
import FormattedText from "../components/FormattedText";
import {
  ImageIcon, Trash2, UserPlus, UserMinus, Heart,
  MessageCircle, Bookmark, X, Music, Volume2, VolumeX,
  Send,
} from "lucide-react";
import { ProfileSkeleton } from "../components/LoadingSkeleton";
import { alertConfirm, alertError } from "../utils/alerts";

// Music file lookup from manifest
let musicMap = {};
fetch("/music/manifest.json")
  .then((r) => r.json())
  .then((data) => { data.forEach((m) => { musicMap[m.id] = `/music/${m.file}`; }); })
  .catch(() => {});

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
  const [realFollowerCount, setRealFollowerCount] = useState(null);
  const [realFollowingCount, setRealFollowingCount] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [authorPic, setAuthorPic] = useState("");
  const [likedPosts, setLikedPosts] = useState({});
  const [likeCounts, setLikeCounts] = useState({});
  const [savedPosts, setSavedPosts] = useState({});
  const [mutedPosts, setMutedPosts] = useState({});
  const audioRef = useRef(null);

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
      const postList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPosts(postList);
      const counts = {};
      postList.forEach((p) => { counts[p.id] = p.likesCount || 0; });
      setLikeCounts((prev) => ({ ...prev, ...counts }));
    });
    return unsub;
  }, [uid]);

  // ── Realtime follower/following count ──
  useEffect(() => {
    const followersQ = query(collection(db, "follows"), where("followingId", "==", uid));
    const unsubF = onSnapshot(followersQ, (snap) => {
      setRealFollowerCount(snap.size);
    }, () => {});
    const followingQ = query(collection(db, "follows"), where("followerId", "==", uid));
    const unsubG = onSnapshot(followingQ, (snap) => {
      setRealFollowingCount(snap.size);
    }, () => {});
    return () => { unsubF(); unsubG(); };
  }, [uid]);

  // ── Realtime follow check ──
  useEffect(() => {
    if (isOwner || !user) return;
    const unsub = onSnapshot(doc(db, "follows", `${user.uid}_${uid}`), (snap) => {
      setFollowing(snap.exists());
    });
    return unsub;
  }, [uid, user, isOwner]);

  // ── Fetch author pic for modal ──
  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists() && snap.data().profilePic) setAuthorPic(snap.data().profilePic);
    });
  }, [uid]);

  // ── Check liked/saved for selected post ──
  useEffect(() => {
    if (!selectedPost || !user) return;
    const likeId = `${user.uid}_${selectedPost.id}`;
    const unsubLike = onSnapshot(doc(db, "postLikes", likeId), (snap) => {
      setLikedPosts((prev) => ({ ...prev, [selectedPost.id]: snap.exists() }));
    });
    const unsubSave = onSnapshot(doc(db, "postSaves", `${user.uid}_${selectedPost.id}`), (snap) => {
      setSavedPosts((prev) => ({ ...prev, [selectedPost.id]: snap.exists() }));
    });
    return () => { unsubLike(); unsubSave(); };
  }, [selectedPost?.id, user]);

  // ── Audio for selected post ──
  useEffect(() => {
    if (!selectedPost?.musicId || !musicMap[selectedPost.musicId]) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      return;
    }

    const audio = new Audio(musicMap[selectedPost.musicId]);
    audio.loop = true;
    audio.muted = !!mutedPosts[selectedPost.id];
    audio.preload = "metadata";
    audioRef.current = audio;

    if (!mutedPosts[selectedPost.id]) {
      audio.play().catch(() => {});
    }

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [selectedPost?.id, selectedPost?.musicId, mutedPosts[selectedPost?.id]]);

  // ── Lock body scroll when modal open ──
  useEffect(() => {
    if (selectedPost) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [selectedPost]);

  async function handleFollow() {
    setFollowLoading(true);
    try { await followUser(uid); }
    catch {} finally { setFollowLoading(false); }
  }

  async function handleDeletePost(post) {
    if (!(await alertConfirm("Delete post?", "This action cannot be undone."))) return;
    try {
      await deleteDoc(doc(db, "posts", post.id));
      // Close modal if the deleted post is currently shown
      if (selectedPost?.id === post.id) setSelectedPost(null);
    } catch (err) { alertError("Delete failed", err.message); }
  }

  function handleLikePost(post) {
    const isLiked = likedPosts[post.id];
    setLikeCounts((prev) => ({
      ...prev,
      [post.id]: isLiked ? Math.max(0, (prev[post.id] || post.likesCount || 1) - 1) : (prev[post.id] || post.likesCount || 0) + 1,
    }));
    try {
      if (isLiked) {
        deleteDoc(doc(db, "postLikes", `${user.uid}_${post.id}`));
        updateDoc(doc(db, "posts", post.id), { likesCount: increment(-1) }).catch(() => {});
      } else {
        setDoc(doc(db, "postLikes", `${user.uid}_${post.id}`), { postId: post.id, userId: user.uid, createdAt: serverTimestamp() });
        updateDoc(doc(db, "posts", post.id), { likesCount: increment(1) }).catch(() => {});
      }
    } catch {}
  }

  async function handleSavePost(post) {
    const isSaved = savedPosts[post.id];
    // Optimistic UI
    setSavedPosts((prev) => ({ ...prev, [post.id]: !isSaved }));
    try {
      if (isSaved) {
        await deleteDoc(doc(db, "postSaves", `${user.uid}_${post.id}`));
      } else {
        await setDoc(doc(db, "postSaves", `${user.uid}_${post.id}`), { postId: post.id, userId: user.uid, createdAt: serverTimestamp() });
      }
    } catch {
      setSavedPosts((prev) => ({ ...prev, [post.id]: isSaved })); // revert on failure
    }
  }

  function toggleMute(postId) {
    setMutedPosts((prev) => {
      const newMuted = !prev[postId];
      if (audioRef.current && selectedPost?.id === postId) {
        audioRef.current.muted = newMuted;
        if (!newMuted) audioRef.current.play().catch(() => {});
      }
      return { ...prev, [postId]: newMuted };
    });
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
            <Link to={`/profile/${uid}/followers`} className="stat-item stat-link"><span className="stat-value">{realFollowerCount ?? profile.followersCount ?? 0}</span><span className="stat-label">Followers</span></Link>
            <Link to={`/profile/${uid}/followers`} className="stat-item stat-link"><span className="stat-value">{realFollowingCount ?? profile.followingCount ?? 0}</span><span className="stat-label">Following</span></Link>
          </div>
          <div className="profile-actions">
            {isOwner ? (
              <button className="btn" onClick={() => setEditing(true)}>Edit profile</button>
            ) : user && (
              <>
                <button className={`btn ${following ? "ghost" : "primary"}`} onClick={handleFollow} disabled={followLoading}>
                  {following ? <><UserMinus size={16} /> Unfollow</> : <><UserPlus size={16} /> Follow</>}
                </button>
                <Link to="/messages" state={{ startChat: { uid, username: profile.username, profilePic: profile.profilePic } }} className="btn ghost">
                  <Send size={16} /> Message
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {editing && <EditProfile profile={profile} onClose={() => setEditing(false)} />}

      <div className="profile-posts">
        {posts.length === 0 ? (
          <div className="profile-empty"><ImageIcon size={48} strokeWidth={1.5} /><p>{isOwner ? "No posts yet — create your first!" : "No posts yet."}</p></div>
        ) : posts.map((p) => (
          <div key={p.id} className="grid-item-wrapper" onClick={() => setSelectedPost(p)}>
            {(p.imageUrls?.[0] || p.imageUrl) ? (
              <img src={p.imageUrls?.[0] || p.imageUrl} alt={p.caption || "Post"} className="grid-item" />
            ) : (
              <div className="grid-item grid-item-text">{p.caption || "Text post"}</div>
            )}
            <div className="grid-item-overlay">
              <span><Heart size={14} /> {likeCounts[p.id] ?? p.likesCount ?? 0}</span>
              <span><MessageCircle size={14} /> {p.commentsCount ?? 0}</span>
            </div>
            {isOwner && (
              <button className="grid-item-delete" onClick={(e) => { e.stopPropagation(); handleDeletePost(p); }} title="Delete post"><Trash2 size={14} /></button>
            )}
          </div>
        ))}
      </div>

      {/* Post Detail Modal — Instagram-style */}
      {selectedPost && createPortal(
        <div className="modal-backdrop" onClick={() => setSelectedPost(null)}>
          <div className="modal post-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="create-post-header" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {authorPic ? (
                  <img src={authorPic} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div className="feed-post-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                    {profile.username?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <span style={{ fontWeight: 600, fontSize: 14 }}>@{profile.username}</span>
              </div>
              <button type="button" className="btn icon-only" onClick={() => setSelectedPost(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="post-detail-content">
              {selectedPost.imageUrls?.length > 0 ? (
                <img src={selectedPost.imageUrls[0]} alt="" className="post-detail-image" />
              ) : selectedPost.imageUrl ? (
                <img src={selectedPost.imageUrl} alt="" className="post-detail-image" />
              ) : null}

              {selectedPost.caption && (
                <div className="feed-post-caption" style={{ padding: "12px 16px" }}><FormattedText text={selectedPost.caption} /></div>
              )}

              {selectedPost.musicName && (
                <div className="feed-post-music" style={{ margin: "0 16px", padding: "10px 0" }}>
                  <div className="feed-post-music-icon"><Music size={14} /></div>
                  <div className="feed-post-music-info">
                    <span className="feed-post-music-name">{selectedPost.musicName}</span>
                    {selectedPost.musicArtist && <span className="feed-post-music-artist">{selectedPost.musicArtist}</span>}
                  </div>
                  <button
                    className={`feed-post-music-toggle ${!mutedPosts[selectedPost.id] ? "active" : ""}`}
                    onClick={() => toggleMute(selectedPost.id)}
                  >
                    {mutedPosts[selectedPost.id] ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                </div>
              )}

              <div className="feed-post-actions" style={{ borderTop: "1px solid var(--border)", padding: "8px 16px" }}>
                <button className={`feed-post-action-btn ${likedPosts[selectedPost.id] ? "liked" : ""}`} onClick={() => handleLikePost(selectedPost)}>
                  <Heart size={20} fill={likedPosts[selectedPost.id] ? "var(--error)" : "none"} />
                  {(likeCounts[selectedPost.id] ?? selectedPost.likesCount ?? 0) > 0 && <span>{likeCounts[selectedPost.id] ?? selectedPost.likesCount}</span>}
                </button>
                <button className="feed-post-action-btn active">
                  <MessageCircle size={20} />
                  {(selectedPost.commentsCount ?? 0) > 0 && <span>{selectedPost.commentsCount}</span>}
                </button>
                <button className={`feed-post-action-btn ${savedPosts[selectedPost.id] ? "saved" : ""}`} onClick={() => handleSavePost(selectedPost)}>
                  <Bookmark size={20} fill={savedPosts[selectedPost.id] ? "var(--cyan)" : "none"} />
                </button>
              </div>

              <div style={{ padding: "0 16px 16px" }}>
                <InlineComments post={selectedPost} />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
