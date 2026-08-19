import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  doc, getDoc, collection, query, orderBy, limit,
  deleteDoc, updateDoc, increment, setDoc, serverTimestamp,
  onSnapshot, where, getDocs,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import SetupProfile from "../components/SetupProfile";
import InlineComments from "../components/InlineComments";
import { FeedSkeleton } from "../components/LoadingSkeleton";
import { staticPosts } from "../config/posts";
import {
  ExternalLink, Trash2, Pencil, MoreHorizontal,
  Heart, Bookmark, MessageCircle, Share2,
  ChevronLeft, ChevronRight, UserPlus, UserMinus, Music, Volume2, VolumeX,
} from "lucide-react";
import { alertConfirm, alertError, alertPrompt } from "../utils/alerts";

// Music file lookup from manifest
let musicMap = {};
fetch("/music/manifest.json")
  .then((r) => r.json())
  .then((data) => { data.forEach((m) => { musicMap[m.id] = `/music/${m.file}`; }); })
  .catch(() => {});

export default function Home() {
  const { user, followUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [activeMenu, setActiveMenu] = useState(null);
  const [likedPosts, setLikedPosts] = useState({});
  const [likeCounts, setLikeCounts] = useState({});
  const [savedPosts, setSavedPosts] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [authorData, setAuthorData] = useState({});
  const [followingState, setFollowingState] = useState({});
  const [sliderIndices, setSliderIndices] = useState({});
  const [doubleTapHeart, setDoubleTapHeart] = useState(null);
  const lastTap = useRef({});
  const audioRefs = useRef({});
  const likeUnsubsRef = useRef(new Map());

  // ── GLOBAL SOUND STATE ──
  const [globalMuted, setGlobalMuted] = useState(true);

  // ── Author data fetcher ──
  async function loadAuthorData(postList) {
    const uids = [...new Set(postList.map((p) => p.authorId).filter(Boolean))];
    const data = {};
    for (const uid of uids) {
      try {
        const cacheKey = `pic_${uid}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          data[uid] = { profilePic: cached, username: "" };
        }
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const d = snap.data();
          data[uid] = { profilePic: d.profilePic || "", username: d.username || "" };
          if (d.profilePic) localStorage.setItem(cacheKey, d.profilePic);
        }
      } catch {}
    }
    if (Object.keys(data).length) setAuthorData((prev) => ({ ...prev, ...data }));
  }

  // ── Profile check ──
  useEffect(() => {
    async function checkProfile() {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data);
          if (data.profilePic) localStorage.setItem(`pic_${user.uid}`, data.profilePic);
          if (!data.username) setNeedsSetup(true);
        }
      } catch { setNeedsSetup(true); }
      finally { setChecking(false); }
    }
    checkProfile();
  }, [user]);

  // ── Realtime posts feed ──
  useEffect(() => {
    if (checking || !user) return;
    setLoadingPosts(true);
    const followUnsubs = new Map();

    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(30));
    const unsub = onSnapshot(q, async (snap) => {
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPosts(fetched);
      setLoadingPosts(false);
      loadAuthorData(fetched);

      const counts = {};
      fetched.forEach((p) => { counts[p.id] = p.likesCount || 0; });
      setLikeCounts((prev) => ({ ...prev, ...counts }));

      const authorUids = [...new Set(fetched.map((p) => p.authorId).filter((id) => id !== user.uid))];
      for (const [uid, unsubFn] of followUnsubs) {
        if (!authorUids.includes(uid)) { unsubFn(); followUnsubs.delete(uid); }
      }
      for (const uid of authorUids) {
        if (!followUnsubs.has(uid)) {
          const fUnsub = onSnapshot(doc(db, "follows", `${user.uid}_${uid}`), (fsnap) => {
            setFollowingState((prev) => ({ ...prev, [uid]: fsnap.exists() }));
          }, () => {});
          followUnsubs.set(uid, fUnsub);
        }
      }

      for (const post of fetched) {
        const likeId = `${user.uid}_${post.id}`;
        if (!likeUnsubsRef.current.has(likeId)) {
          const likeUnsub = onSnapshot(doc(db, "postLikes", likeId), (lsnap) => {
            setLikedPosts((prev) => ({ ...prev, [post.id]: lsnap.exists() }));
          }, () => {});
          likeUnsubsRef.current.set(likeId, likeUnsub);
        }
      }

      if (fetched.length > 0) {
        const postIds = fetched.map((p) => p.id);
        const savedSnap = await getDocs(query(collection(db, "postSaves"), where("postId", "in", postIds), where("userId", "==", user.uid)));
        const saved = {};
        savedSnap.docs.forEach((d) => { saved[d.data().postId] = true; });
        setSavedPosts(saved);
      }
    }, () => { setLoadingPosts(false); });

    return () => {
      unsub();
      for (const unsubFn of followUnsubs.values()) unsubFn();
      for (const unsubFn of likeUnsubsRef.current.values()) unsubFn();
      likeUnsubsRef.current.clear();
    };
  }, [checking, user]);

  function handleSetupComplete() {
    setNeedsSetup(false);
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) setProfile(snap.data());
    });
  }

  async function handleFollow(targetUid) {
    const wasFollowing = followingState[targetUid];
    setFollowingState((prev) => ({ ...prev, [targetUid]: !wasFollowing }));
    try { await followUser(targetUid); }
    catch { setFollowingState((prev) => ({ ...prev, [targetUid]: wasFollowing })); }
  }

  function handleLike(post) {
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

  function handleDoubleTap(post) {
    const now = Date.now();
    const last = lastTap.current[post.id] || 0;
    if (now - last < 300) {
      if (!likedPosts[post.id]) handleLike(post);
      setDoubleTapHeart(post.id);
      setTimeout(() => setDoubleTapHeart(null), 800);
    }
    lastTap.current[post.id] = now;
  }

  function handleShare(post) {
    const url = `${window.location.origin}/home`;
    if (navigator.share) {
      navigator.share({ title: `${post.authorName}'s post`, text: post.caption || "", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alertError("Link copied!", "Post link copied to clipboard.");
    }
  }

  async function handleSave(post) {
    const isSaved = savedPosts[post.id];
    try {
      if (isSaved) {
        await deleteDoc(doc(db, "postSaves", `${user.uid}_${post.id}`));
        setSavedPosts((prev) => ({ ...prev, [post.id]: false }));
      } else {
        await setDoc(doc(db, "postSaves", `${user.uid}_${post.id}`), { postId: post.id, userId: user.uid, createdAt: serverTimestamp() });
        setSavedPosts((prev) => ({ ...prev, [post.id]: true }));
      }
    } catch {}
  }

  async function handleDeletePost(post) {
    if (!(await alertConfirm("Delete post?", "This action cannot be undone."))) return;
    try { await deleteDoc(doc(db, "posts", post.id)); }
    catch (err) { alertError("Delete failed", err.message); }
  }

  async function handleEditCaption(post) {
    const newCaption = await alertPrompt("Edit caption", "Update your post", {
      input: "textarea", inputValue: post.caption || "", inputPlaceholder: "Write a caption...",
    });
    if (newCaption === null) return;
    try { await updateDoc(doc(db, "posts", post.id), { caption: newCaption.trim() }); }
    catch (err) { alertError("Update failed", err.message); }
  }

  function timeAgo(timestamp) {
    if (!timestamp?.seconds) return "";
    const diff = Date.now() - timestamp.seconds * 1000;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  }

  // ── GLOBAL SOUND TOGGLE — like Instagram ──
  // Click any sound icon → ALL posts unmute. Click again → ALL mute.
  const toggleGlobalSound = useCallback(() => {
    const newMuted = !globalMuted;
    setGlobalMuted(newMuted);
    // Apply to all audio elements
    Object.values(audioRefs.current).forEach((audio) => {
      audio.muted = newMuted;
      if (!newMuted) audio.play().catch(() => {});
      else audio.pause();
    });
  }, [globalMuted]);

  // Initialize audio + IntersectionObserver
  useEffect(() => {
    posts.forEach((post) => {
      if (post.musicId && musicMap[post.musicId] && !audioRefs.current[post.id]) {
        const audio = new Audio(musicMap[post.musicId]);
        audio.loop = true;
        audio.muted = true; // All start silent
        audio.preload = "metadata";
        audioRefs.current[post.id] = audio;
      }
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const postId = entry.target.dataset.postId;
          const audio = audioRefs.current[postId];
          if (!audio) return;
          if (entry.isIntersecting) {
            audio.currentTime = 0;
            if (!globalMuted) audio.play().catch(() => {});
          } else {
            audio.pause();
          }
        });
      },
      { threshold: 0.5 }
    );

    const postEls = document.querySelectorAll("[data-post-id]");
    postEls.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      Object.values(audioRefs.current).forEach((a) => a.pause());
    };
  }, [posts, globalMuted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach((a) => { a.pause(); a.src = ""; });
      audioRefs.current = {};
    };
  }, []);

  usePageAnimations("home");

  if (checking) return <div className="page"><FeedSkeleton /></div>;

  return (
    <div className="page page-enter">
      {needsSetup && <SetupProfile profile={profile} onComplete={handleSetupComplete} />}

      <div className="home-header">
        <h1 className="home-title">
          Welcome{profile?.username ? ", " : " "}
          {profile?.username ? <span className="neon-text">@{profile.username}</span> : ""}
          {" "}<span role="img" aria-label="wave">👋</span>
        </h1>
        {/* Global sound toggle — top right like Instagram */}
        {posts.some((p) => p.musicId && musicMap[p.musicId]) && (
          <button className="global-sound-toggle" onClick={toggleGlobalSound} title={globalMuted ? "Unmute all" : "Mute all"}>
            {globalMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        )}
      </div>

      {loadingPosts ? <FeedSkeleton /> : (
        <div className="feed">
          {staticPosts.map((sp) => (
            <div key={sp.id} className="feed-post feed-post-ad">
              <div className="feed-post-header">
                <div className="feed-post-avatar feed-post-avatar-ad">{sp.authorName?.[0]?.toUpperCase()}</div>
                <div className="feed-post-meta"><span className="feed-post-author">{sp.authorName}</span><span className="feed-post-ad-badge">AD</span></div>
              </div>
              {sp.image && <img src={sp.image} alt="" className="feed-post-image" />}
              {sp.caption && <p className="feed-post-caption">{sp.caption}</p>}
              {sp.link && <div className="feed-post-ad-actions"><a href={sp.link} target="_blank" rel="noopener noreferrer" className="btn primary btn-sm">{sp.linkLabel || "Learn more"} <ExternalLink size={14} /></a></div>}
            </div>
          ))}

          {posts.length === 0 ? (
            <div className="home-empty"><p>No posts yet — be the first to share!</p></div>
          ) : posts.map((post) => {
            const ad = authorData[post.authorId] || {};
            const isOwn = post.authorId === user?.uid;
            const images = post.imageUrls?.length ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : []);
            const sIdx = sliderIndices[post.id] || 0;
            const likeCount = likeCounts[post.id] ?? post.likesCount ?? 0;
            const hasMusic = post.musicId && musicMap[post.musicId];

            return (
              <div key={post.id} className="feed-post" data-post-id={post.id}>
                <div className="feed-post-header">
                  <Link to={`/profile/${post.authorId}`} className="feed-post-avatar-link">
                    {ad.profilePic ? <img src={ad.profilePic} alt="" className="feed-post-avatar-img" onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} /> : null}
                    <div className="feed-post-avatar" style={ad.profilePic ? { display: "none" } : {}}>{post.authorName?.[0]?.toUpperCase() || "?"}</div>
                  </Link>
                  <div className="feed-post-meta-col">
                    <Link to={`/profile/${post.authorId}`} className="feed-post-author feed-post-author-link">
                      {ad.username ? `@${ad.username}` : post.authorName}
                    </Link>
                    {post.createdAt && <span className="feed-post-time">{timeAgo(post.createdAt)}</span>}
                  </div>
                  {!isOwn && user && (
                    <button className={`btn btn-xs ${followingState[post.authorId] ? "ghost" : "primary"}`} onClick={() => handleFollow(post.authorId)}>
                      {followingState[post.authorId] ? <><UserMinus size={14} /> Unfollow</> : <><UserPlus size={14} /> Follow</>}
                    </button>
                  )}
                  {isOwn && (
                    <div className="feed-post-menu">
                      <button className="btn icon-only feed-post-menu-btn" onClick={() => setActiveMenu(activeMenu === post.id ? null : post.id)}><MoreHorizontal size={18} /></button>
                      {activeMenu === post.id && (
                        <div className="feed-post-dropdown">
                          <button className="feed-post-dropdown-item" onClick={() => { setActiveMenu(null); handleEditCaption(post); }}><Pencil size={14} /> Edit</button>
                          <button className="feed-post-dropdown-item feed-post-dropdown-danger" onClick={() => { setActiveMenu(null); handleDeletePost(post); }}><Trash2 size={14} /> Delete</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {images.length > 0 && (
                  <div className="feed-post-slider" onClick={() => handleDoubleTap(post)}>
                    {doubleTapHeart === post.id && <div className="double-tap-heart"><Heart size={64} fill="#fff" /></div>}
                    <div className="feed-post-slider-track" style={{ transform: `translateX(-${sIdx * 100}%)` }}>
                      {images.map((url, i) => (
                        <div key={i} className="feed-post-slide"><img src={url} alt="" className="feed-post-image" /></div>
                      ))}
                    </div>
                    {images.length > 1 && (
                      <>
                        <button className="slider-btn slider-prev" onClick={(e) => { e.stopPropagation(); setSliderIndices((p) => ({ ...p, [post.id]: Math.max(0, (p[post.id] || 0) - 1) })); }} disabled={sIdx === 0}><ChevronLeft size={18} /></button>
                        <button className="slider-btn slider-next" onClick={(e) => { e.stopPropagation(); setSliderIndices((p) => ({ ...p, [post.id]: Math.min(images.length - 1, (p[post.id] || 0) + 1) })); }} disabled={sIdx === images.length - 1}><ChevronRight size={18} /></button>
                        <div className="slider-dots">{images.map((_, i) => <span key={i} className={`slider-dot ${i === sIdx ? "active" : ""}`} onClick={(e) => { e.stopPropagation(); setSliderIndices((p) => ({ ...p, [post.id]: i })); }} />)}</div>
                      </>
                    )}
                  </div>
                )}

                {post.caption && <p className="feed-post-caption">{post.caption}</p>}

                {post.musicName && (
                  <div className="feed-post-music">
                    <div className="feed-post-music-icon"><Music size={14} /></div>
                    <div className="feed-post-music-info">
                      <span className="feed-post-music-name">{post.musicName}</span>
                      {post.musicArtist && <span className="feed-post-music-artist">{post.musicArtist}</span>}
                    </div>
                    {hasMusic && (
                      <button
                        className={`feed-post-music-toggle ${!globalMuted ? "active" : ""}`}
                        onClick={(e) => { e.stopPropagation(); toggleGlobalSound(); }}
                        title={globalMuted ? "Unmute" : "Mute"}
                      >
                        {globalMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      </button>
                    )}
                  </div>
                )}

                <div className="feed-post-actions">
                  <button className={`feed-post-action-btn ${likedPosts[post.id] ? "liked" : ""}`} onClick={() => handleLike(post)}>
                    <Heart size={20} fill={likedPosts[post.id] ? "var(--error)" : "none"} />
                    {likeCount > 0 && <span>{likeCount}</span>}
                  </button>
                  <button className={`feed-post-action-btn ${openComments[post.id] ? "active" : ""}`} onClick={() => setOpenComments((p) => ({ ...p, [post.id]: !p[post.id] }))}>
                    <MessageCircle size={20} />
                    {post.commentsCount > 0 && <span>{post.commentsCount}</span>}
                  </button>
                  <button className="feed-post-action-btn" onClick={() => handleShare(post)}>
                    <Share2 size={20} />
                  </button>
                  <button className={`feed-post-action-btn ${savedPosts[post.id] ? "saved" : ""}`} onClick={() => handleSave(post)}>
                    <Bookmark size={20} fill={savedPosts[post.id] ? "var(--cyan)" : "none"} />
                  </button>
                </div>

                {openComments[post.id] && <InlineComments post={post} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
