import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  doc, getDoc, collection, query, orderBy, limit,
  deleteDoc, updateDoc, increment, setDoc, serverTimestamp,
  onSnapshot, where, getDocs, addDoc, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import SetupProfile from "../components/SetupProfile";
import InlineComments from "../components/InlineComments";
import FormattedText from "../components/FormattedText";
import { FeedSkeleton } from "../components/LoadingSkeleton";
import { staticPosts } from "../config/posts";
import {
  ExternalLink, Trash2, Pencil, MoreHorizontal,
  Heart, Bookmark, MessageCircle, Send, X, Check,
  ChevronLeft, ChevronRight, UserPlus, UserMinus, Music, Volume2, VolumeX,
  Link2, Copy,
} from "lucide-react";
import { alertConfirm, alertError, alertPrompt, alertSuccess } from "../utils/alerts";

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
  const [sharePost, setSharePost] = useState(null); // post being shared
  const [shareContacts, setShareContacts] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [tick, setTick] = useState(0); // forces timeAgo to re-render
  const lastTap = useRef({});
  const audioRefs = useRef({});
  const likeUnsubsRef = useRef(new Map());

  // ── GLOBAL SOUND STATE ──
  const [globalMuted, setGlobalMuted] = useState(true);
  const currentPlayingRef = useRef(null); // tracks which post audio is currently playing

  // ── Refresh relative times every 60s ──
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // ── Lock body scroll when share sheet is open ──
  useEffect(() => {
    if (sharePost) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [sharePost]);

  // ── Author data fetcher (batch parallel) ──
  async function loadAuthorData(postList) {
    const uids = [...new Set(postList.map((p) => p.authorId).filter(Boolean))];
    const data = {};
    const uncachedUids = uids.filter((uid) => !localStorage.getItem(`pic_${uid}`));

    // Set cached data immediately
    uids.forEach((uid) => {
      const cached = localStorage.getItem(`pic_${uid}`);
      if (cached) data[uid] = { profilePic: cached, username: "" };
    });

    // Batch-fetch uncached user data in parallel
    if (uncachedUids.length > 0) {
      const userPromises = uncachedUids.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, "users", uid));
          if (snap.exists()) {
            const d = snap.data();
            if (d.profilePic) localStorage.setItem(`pic_${uid}`, d.profilePic);
            return [uid, { profilePic: d.profilePic || "", username: d.username || "" }];
          }
        } catch {}
        return null;
      });

      const results = await Promise.all(userPromises);
      results.forEach((r) => { if (r) data[r[0]] = r[1]; });
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
        const saved = {};
        const postIds = fetched.map((p) => p.id);
        // Firestore `in` query limit is 10 items
        for (let i = 0; i < postIds.length; i += 10) {
          const batch = postIds.slice(i, i + 10);
          const savedSnap = await getDocs(query(collection(db, "postSaves"), where("postId", "in", batch), where("userId", "==", user.uid)));
          savedSnap.docs.forEach((d) => { saved[d.data().postId] = true; });
        }
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
    // Optimistic UI update
    setLikeCounts((prev) => ({
      ...prev,
      [post.id]: isLiked ? Math.max(0, (prev[post.id] || post.likesCount || 1) - 1) : (prev[post.id] || post.likesCount || 0) + 1,
    }));
    try {
      if (isLiked) {
        deleteDoc(doc(db, "postLikes", `${user.uid}_${post.id}`));
        updateDoc(doc(db, "posts", post.id), { likesCount: increment(-1) }).catch(() => {
          setLikeCounts((prev) => ({ ...prev, [post.id]: (prev[post.id] || 0) + 1 }));
        });
      } else {
        setDoc(doc(db, "postLikes", `${user.uid}_${post.id}`), { postId: post.id, userId: user.uid, createdAt: serverTimestamp() });
        updateDoc(doc(db, "posts", post.id), { likesCount: increment(1) }).catch(() => {
          setLikeCounts((prev) => ({ ...prev, [post.id]: Math.max(0, (prev[post.id] || 1) - 1) }));
        });
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

  // ── Instagram-style Share Sheet ──
  async function handleShare(post) {
    setSharePost(post);
    setShareLoading(true);
    try {
      // Load user's conversations + followed users
      const followingSnap = await getDocs(
        query(collection(db, "follows"), where("followerId", "==", user.uid), limit(50))
      );
      const followingUids = followingSnap.docs.map((d) => d.data().followingId);

      // Get conversations from chatThreads
      const threadsSnap = await getDocs(
        query(collection(db, "users", user.uid, "chatThreads"), orderBy("lastMessageAt", "desc"))
      );

      const contacts = [];
      const seen = new Set();

      // Add threaded contacts first (sorted by recent)
      for (const t of threadsSnap.docs) {
        const td = t.data();
        const otherUid = td.otherUser;
        if (seen.has(otherUid)) continue;
        seen.add(otherUid);
        try {
          const s = await getDoc(doc(db, "users", otherUid));
          if (s.exists() && s.data().username) {
            const d = s.data();
            contacts.push({ uid: otherUid, username: d.username, profilePic: d.profilePic, chatId: t.id, lastMessage: td.lastMessage || "" });
          }
        } catch {}
      }

      // Add remaining followed users
      for (const uid of followingUids) {
        if (seen.has(uid)) continue;
        seen.add(uid);
        try {
          const s = await getDoc(doc(db, "users", uid));
          if (s.exists() && s.data().username) {
            const d = s.data();
            contacts.push({ uid, username: d.username, profilePic: d.profilePic, chatId: null, lastMessage: "" });
          }
        } catch {}
      }

      setShareContacts(contacts);
    } catch (err) {
      alertError("Error", "Could not load contacts.");
      setSharePost(null);
    } finally {
      setShareLoading(false);
    }
  }

  const [sentTo, setSentTo] = useState(null);

  async function sendPostToChat(contact) {
    if (!sharePost || !contact) return;
    const postUrl = `${window.location.origin}/post/${sharePost.id}`;
    const shareText = `📷 ${sharePost.authorName} shared a post`;
    const sharePreview = {
      type: "post_share",
      postId: sharePost.id,
      postUrl,
      authorName: sharePost.authorName || "",
      caption: (sharePost.caption || "").slice(0, 150),
      imageUrl: sharePost.imageUrl || (sharePost.imageUrls && sharePost.imageUrls[0]) || "",
    };

    setSentTo(contact.uid);
    try {
      const chatId = [user.uid, contact.uid].sort().join("_");
      const batch = writeBatch(db);
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        batch.set(chatRef, { participants: [user.uid, contact.uid], lastMessage: shareText, lastMessageAt: serverTimestamp(), typing: {} });
        batch.set(doc(db, "users", user.uid, "chatThreads", chatId), { chatId, otherUser: contact.uid, lastMessageAt: serverTimestamp(), lastMessage: shareText, unreadCount: 0 });
        batch.set(doc(db, "users", contact.uid, "chatThreads", chatId), { chatId, otherUser: user.uid, lastMessageAt: serverTimestamp(), lastMessage: shareText, unreadCount: 1 });
      } else {
        batch.update(chatRef, { lastMessage: shareText, lastMessageAt: serverTimestamp() });
        batch.set(doc(db, "users", user.uid, "chatThreads", chatId), { lastMessage: shareText, lastMessageAt: serverTimestamp(), unreadCount: 0 }, { merge: true });
        batch.set(doc(db, "users", contact.uid, "chatThreads", chatId), { lastMessage: shareText, lastMessageAt: serverTimestamp(), unreadCount: increment(1) }, { merge: true });
      }
      await batch.commit();
      await addDoc(collection(db, "chats", chatId, "messages"), { senderId: user.uid, text: shareText, isGif: false, gifUrl: "", sharePreview, createdAt: serverTimestamp(), read: false });

      // Show success toast then close
      alertSuccess("Sent!", `Shared with @${contact.username}`);
      setTimeout(() => {
        setSentTo(null);
        setSharePost(null);
        setShareContacts([]);
      }, 400);
    } catch (err) {
      setSentTo(null);
      alertError("Failed", "Could not send. Please try again.");
    }
  }

  function handleSave(post) {
    const isSaved = savedPosts[post.id];
    // Instant optimistic UI update
    setSavedPosts((prev) => ({ ...prev, [post.id]: !isSaved }));
    // Fire-and-forget DB write
    try {
      if (isSaved) {
        deleteDoc(doc(db, "postSaves", `${user.uid}_${post.id}`)).catch(() => {
          setSavedPosts((prev) => ({ ...prev, [post.id]: true })); // revert on failure
        });
      } else {
        setDoc(doc(db, "postSaves", `${user.uid}_${post.id}`), { postId: post.id, userId: user.uid, createdAt: serverTimestamp() }).catch(() => {
          setSavedPosts((prev) => ({ ...prev, [post.id]: false })); // revert on failure
        });
      }
    } catch {
      setSavedPosts((prev) => ({ ...prev, [post.id]: isSaved })); // revert
    }
  }

  async function handleDeletePost(post) {
    if (!(await alertConfirm("Delete post?", "This action cannot be undone."))) return;
    try {
      await deleteDoc(doc(db, "posts", post.id));
      alertSuccess("Deleted", "Your post has been removed.");
    } catch (err) { alertError("Delete failed", err.message); }
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
  // Only ONE post plays at a time — the most visible one.
  const toggleGlobalSound = useCallback(() => {
    const newMuted = !globalMuted;
    setGlobalMuted(newMuted);
    if (newMuted) {
      // Mute ALL
      Object.values(audioRefs.current).forEach((audio) => {
        audio.muted = true;
        audio.pause();
      });
      currentPlayingRef.current = null;
    }
    // When unmuted, the IntersectionObserver will pick the most visible post
  }, [globalMuted]);

  // Initialize audio + IntersectionObserver — only ONE post plays at a time
  useEffect(() => {
    posts.forEach((post) => {
      if (post.musicId && musicMap[post.musicId] && !audioRefs.current[post.id]) {
        const audio = new Audio(musicMap[post.musicId]);
        audio.loop = true;
        audio.muted = true;
        audio.preload = "metadata";
        audioRefs.current[post.id] = audio;
      }
    });

    // Track all visible posts, play only the MOST visible one
    const visibilityMap = new Map(); // postId → intersectionRatio

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const postId = entry.target.dataset.postId;
          if (!postId) return;
          if (entry.isIntersecting) {
            visibilityMap.set(postId, entry.intersectionRatio);
          } else {
            visibilityMap.delete(postId);
          }
        });

        // Find the MOST visible post
        let bestPostId = null;
        let bestRatio = 0;
        visibilityMap.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestPostId = id;
          }
        });

        // Pause ALL, then play ONLY the best one
        Object.entries(audioRefs.current).forEach(([id, audio]) => {
          if (id === bestPostId && !globalMuted) {
            if (currentPlayingRef.current !== id) {
              audio.currentTime = 0;
              audio.muted = false;
              audio.play().catch(() => {});
              currentPlayingRef.current = id;
            }
          } else {
            audio.pause();
            audio.muted = true;
          }
        });
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    );

    const postEls = document.querySelectorAll("[data-post-id]");
    postEls.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      Object.values(audioRefs.current).forEach((a) => { a.pause(); a.muted = true; });
      currentPlayingRef.current = null;
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

                {post.caption && <div className="feed-post-caption"><FormattedText text={post.caption} /></div>}

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
                  <button className="feed-post-action-btn" onClick={() => handleShare(post)} title="Share">
                    <Send size={20} />
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

      {/* ── Instagram-style Share Sheet ── */}
      {sharePost && (
        <div className="modal-backdrop" onClick={() => { setSharePost(null); setShareContacts([]); }}>
          <div className="modal share-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="share-sheet-header">
              <span className="share-sheet-title">Share to...</span>
              <button className="btn icon-only" onClick={() => { setSharePost(null); setShareContacts([]); }}>
                <X size={20} />
              </button>
            </div>
            {shareLoading ? (
              <div className="share-sheet-loading">
                <span className="setup-btn-spinner" />
              </div>
            ) : (
              <>
              {/* Copy Link option */}
              <div className="share-sheet-actions">
                <button className="share-sheet-action-item" onClick={() => {
                  const url = `${window.location.origin}/post/${sharePost.id}`;
                  navigator.clipboard.writeText(url).then(() => {
                    alertSuccess("Copied!", "Link copied to clipboard.");
                    setSharePost(null);
                    setShareContacts([]);
                  }).catch(() => {});
                }}>
                  <div className="share-sheet-action-icon"><Copy size={20} /></div>
                  <span>Copy link</span>
                </button>
                <button className="share-sheet-action-item" onClick={() => {
                  const url = `${window.location.origin}/post/${sharePost.id}`;
                  if (navigator.share) {
                    navigator.share({ title: "Check out this post", url }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(url).then(() => {
                      alertSuccess("Copied!", "Link copied to clipboard.");
                    }).catch(() => {});
                  }
                  setSharePost(null);
                  setShareContacts([]);
                }}>
                  <div className="share-sheet-action-icon"><Link2 size={20} /></div>
                  <span>Share link</span>
                </button>
              </div>
              <div className="share-sheet-divider" />
              <div className="share-sheet-list">
                {shareContacts.length === 0 ? (
                  <p className="share-sheet-empty">No contacts. Follow people to share posts!</p>
                ) : shareContacts.map((c) => (
                  <button key={c.uid} className="share-sheet-item" onClick={() => sendPostToChat(c)} disabled={sentTo !== null}>
                    {c.profilePic ? (
                      <img src={c.profilePic} alt="" className="share-sheet-avatar" />
                    ) : (
                      <div className="share-sheet-avatar share-sheet-avatar-fallback">
                        {c.username?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                    <span className="share-sheet-name">@{c.username}</span>
                    <div className={`share-sheet-send ${sentTo === c.uid ? "share-sheet-sent" : ""}`}>
                      {sentTo === c.uid ? <Check size={16} /> : <Send size={16} />}
                    </div>
                  </button>
                ))}
              </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
