import { useEffect, useState, useCallback } from "react";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
  updateDoc,
  increment,
  setDoc,
  where,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import SetupProfile from "../components/SetupProfile";
import CreatePost from "../components/CreatePost";
import CommentsModal from "../components/CommentsModal";
import { FeedSkeleton } from "../components/LoadingSkeleton";
import { staticPosts } from "../config/posts";
import {
  ExternalLink,
  Trash2,
  Pencil,
  MoreHorizontal,
  Heart,
  Bookmark,
  MessageCircle,
} from "lucide-react";
import { alertConfirm, alertError, alertSuccess, alertPrompt } from "../utils/alerts";

export default function Home() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [likedPosts, setLikedPosts] = useState({});
  const [savedPosts, setSavedPosts] = useState({});
  const [commentsPost, setCommentsPost] = useState(null);
  const [authorPics, setAuthorPics] = useState({});

  // Fetch author profile pics for posts (with localStorage cache)
  const loadAuthorPics = useCallback(async (postList) => {
    const uids = [...new Set(postList.map((p) => p.authorId).filter(Boolean))];
    const pics = {};

    for (const uid of uids) {
      const cacheKey = `pic_${uid}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          pics[uid] = cached;
          continue;
        }
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists() && snap.data().profilePic) {
          pics[uid] = snap.data().profilePic;
          localStorage.setItem(cacheKey, snap.data().profilePic);
        }
      } catch {
        // silent
      }
    }
    setAuthorPics((prev) => ({ ...prev, ...pics }));
  }, []);

  useEffect(() => {
    async function checkProfile() {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data);
          if (!data.username) {
            setNeedsSetup(true);
          }
        }
      } catch {
        setNeedsSetup(true);
      } finally {
        setChecking(false);
      }
    }
    checkProfile();
  }, [user]);

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const q = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const snap = await getDocs(q);
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPosts(fetched);
      loadAuthorPics(fetched);

      // Check which posts user has liked/saved
      if (user && fetched.length > 0) {
        const postIds = fetched.map((p) => p.id);

        const likedSnap = await getDocs(
          query(
            collection(db, "postLikes"),
            where("postId", "in", postIds),
            where("userId", "==", user.uid)
          )
        );
        const liked = {};
        likedSnap.docs.forEach((d) => {
          liked[d.data().postId] = true;
        });
        setLikedPosts(liked);

        const savedSnap = await getDocs(
          query(
            collection(db, "postSaves"),
            where("postId", "in", postIds),
            where("userId", "==", user.uid)
          )
        );
        const saved = {};
        savedSnap.docs.forEach((d) => {
          saved[d.data().postId] = true;
        });
        setSavedPosts(saved);
      }
    } catch {
      // Handle silently
    } finally {
      setLoadingPosts(false);
    }
  }, [user, loadAuthorPics]);

  useEffect(() => {
    if (!checking && user) loadPosts();
  }, [checking, user, loadPosts]);

  // Expose functions globally so Navbar can trigger them
  useEffect(() => {
    window.__histogramLoadPosts = loadPosts;
    window.__histogramShowCreate = () => setShowCreate(true);
    return () => {
      delete window.__histogramLoadPosts;
      delete window.__histogramShowCreate;
    };
  }, [loadPosts]);

  function handleSetupComplete() {
    setNeedsSetup(false);
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) setProfile(snap.data());
    });
  }

  // ── Like / Unlike ──
  async function handleLike(post) {
    const likeRef = doc(db, "postLikes", `${user.uid}_${post.id}`);
    const isLiked = likedPosts[post.id];

    try {
      if (isLiked) {
        await deleteDoc(likeRef);
        await updateDoc(doc(db, "posts", post.id), {
          likesCount: increment(-1),
        });
        setLikedPosts((prev) => ({ ...prev, [post.id]: false }));
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, likesCount: Math.max(0, (p.likesCount || 1) - 1) }
              : p
          )
        );
      } else {
        await setDoc(likeRef, {
          postId: post.id,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "posts", post.id), {
          likesCount: increment(1),
        });
        setLikedPosts((prev) => ({ ...prev, [post.id]: true }));
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, likesCount: (p.likesCount || 0) + 1 }
              : p
          )
        );
      }
    } catch {
      // silent
    }
  }

  // ── Save / Unsave ──
  async function handleSave(post) {
    const saveRef = doc(db, "postSaves", `${user.uid}_${post.id}`);
    const isSaved = savedPosts[post.id];

    try {
      if (isSaved) {
        await deleteDoc(saveRef);
        setSavedPosts((prev) => ({ ...prev, [post.id]: false }));
        await alertSuccess("Removed", "Post removed from saved.");
      } else {
        await setDoc(saveRef, {
          postId: post.id,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
        setSavedPosts((prev) => ({ ...prev, [post.id]: true }));
        await alertSuccess("Saved!", "Post saved to your collection.");
      }
    } catch {
      // silent
    }
  }

  // ── Delete ──
  async function handleDeletePost(post) {
    const confirmed = await alertConfirm(
      "Delete post?",
      "This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "posts", post.id));
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      await alertSuccess("Deleted", "Your post has been removed.");
    } catch (err) {
      alertError(
        "Delete failed",
        err.message.replace("Firebase: ", "") || "Something went wrong."
      );
    }
  }

  // ── Edit Caption ──
  async function handleEditCaption(post) {
    const newCaption = await alertPrompt(
      "Edit caption",
      "Update your post caption",
      {
        input: "textarea",
        inputValue: post.caption || "",
        inputPlaceholder: "Write a caption...",
      }
    );
    if (newCaption === null) return;

    try {
      await updateDoc(doc(db, "posts", post.id), {
        caption: newCaption.trim(),
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, caption: newCaption.trim() } : p
        )
      );
      await alertSuccess("Updated", "Your caption has been updated.");
    } catch (err) {
      alertError(
        "Update failed",
        err.message.replace("Firebase: ", "") || "Something went wrong."
      );
    }
  }

  usePageAnimations("home");

  if (checking) {
    return (
      <div className="page">
        <FeedSkeleton />
      </div>
    );
  }

  return (
    <div className="page page-enter">
      {needsSetup && (
        <SetupProfile profile={profile} onComplete={handleSetupComplete} />
      )}

      {showCreate && (
        <CreatePost
          onClose={() => setShowCreate(false)}
          onCreated={loadPosts}
        />
      )}

      {commentsPost && (
        <CommentsModal
          post={commentsPost}
          onClose={() => setCommentsPost(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="home-header">
        <h1 className="home-title">
          Welcome{profile?.username ? ", " : " "}
          {profile?.username ? (
            <span className="neon-text">@{profile.username}</span>
          ) : (
            ""
          )}{" "}
          <span role="img" aria-label="wave">
            👋
          </span>
        </h1>
      </div>

      {/* ── Feed ── */}
      {loadingPosts ? (
        <FeedSkeleton />
      ) : (
        <div className="feed">
          {/* ── Static / ad posts — always visible ── */}
          {staticPosts.map((sp) => (
            <div key={sp.id} className={`feed-post feed-post-ad`}>
              <div className="feed-post-header">
                <div className="feed-post-avatar feed-post-avatar-ad">
                  {sp.authorName?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="feed-post-meta">
                  <span className="feed-post-author">{sp.authorName}</span>
                  <span className="feed-post-ad-badge">AD</span>
                </div>
              </div>
              {sp.image && (
                <img
                  src={sp.image}
                  alt={sp.caption || ""}
                  className="feed-post-image"
                />
              )}
              {sp.caption && (
                <p className="feed-post-caption">{sp.caption}</p>
              )}
              {sp.link && (
                <div className="feed-post-ad-actions">
                  <a
                    href={sp.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn primary btn-sm"
                  >
                    {sp.linkLabel || "Learn more"}
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>
          ))}

          {/* ── Real Firebase posts ── */}
          {posts.length === 0 ? (
            <div className="home-empty">
              <p>No posts from the community yet — be the first to share something!</p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="feed-post">
                <div className="feed-post-header">
                  {authorPics[post.authorId] ? (
                    <img
                      src={authorPics[post.authorId]}
                      alt=""
                      className="feed-post-avatar-img"
                    />
                  ) : (
                    <div className="feed-post-avatar">
                      {post.authorName?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="feed-post-meta">
                    <span className="feed-post-author">{post.authorName}</span>
                  </div>
                  {post.authorId === user?.uid && (
                    <div className="feed-post-menu">
                      <button
                        className="btn icon-only feed-post-menu-btn"
                        onClick={() => setActiveMenu(activeMenu === post.id ? null : post.id)}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {activeMenu === post.id && (
                        <div className="feed-post-dropdown">
                          <button
                            className="feed-post-dropdown-item"
                            onClick={() => {
                              setActiveMenu(null);
                              handleEditCaption(post);
                            }}
                          >
                            <Pencil size={14} />
                            Edit caption
                          </button>
                          <button
                            className="feed-post-dropdown-item feed-post-dropdown-danger"
                            onClick={() => {
                              setActiveMenu(null);
                              handleDeletePost(post);
                            }}
                          >
                            <Trash2 size={14} />
                            Delete post
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {post.imageUrl && (
                  <img
                    src={post.imageUrl}
                    alt={post.caption || "Post"}
                    className="feed-post-image"
                  />
                )}
                {post.caption && (
                  <p className="feed-post-caption">{post.caption}</p>
                )}

                {/* ── Post Actions ── */}
                <div className="feed-post-actions">
                  <button
                    className={`feed-post-action-btn ${likedPosts[post.id] ? "liked" : ""}`}
                    onClick={() => handleLike(post)}
                  >
                    <Heart
                      size={20}
                      fill={likedPosts[post.id] ? "var(--error)" : "none"}
                    />
                    {post.likesCount > 0 && (
                      <span>{post.likesCount}</span>
                    )}
                  </button>
                  <button
                    className="feed-post-action-btn"
                    onClick={() => setCommentsPost(post)}
                  >
                    <MessageCircle size={20} />
                    {post.commentsCount > 0 && (
                      <span>{post.commentsCount}</span>
                    )}
                  </button>
                  <button
                    className={`feed-post-action-btn ${savedPosts[post.id] ? "saved" : ""}`}
                    onClick={() => handleSave(post)}
                  >
                    <Bookmark
                      size={20}
                      fill={savedPosts[post.id] ? "var(--cyan)" : "none"}
                    />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
