import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  doc, getDoc, collection, query, orderBy, limit,
  onSnapshot, where, getDocs, addDoc, updateDoc, increment,
  setDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import InlineComments from "../components/InlineComments";
import FormattedText from "../components/FormattedText";
import { FeedSkeleton } from "../components/LoadingSkeleton";
import {
  ArrowLeft, Heart, Bookmark, MessageCircle, Send, Music, Volume2, VolumeX,
  ChevronLeft, ChevronRight, ExternalLink,
} from "lucide-react";

export default function PostDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [authorData, setAuthorData] = useState({});
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [sliderIdx, setSliderIdx] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [globalMuted, setGlobalMuted] = useState(true);
  const audioRef = useRef(null);
  const musicMap = useRef({});

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Load music manifest
  useEffect(() => {
    fetch("/music/manifest.json")
      .then((r) => r.json())
      .then((data) => {
        const map = {};
        data.forEach((t) => { map[t.id] = `/music/${t.file}`; });
        musicMap.current = map;
      })
      .catch(() => {});
  }, []);

  // Fetch post
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getDoc(doc(db, "posts", id))
      .then((snap) => {
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        setPost(data);
        setLikeCount(data.likesCount || 0);

        // Fetch author
        getDoc(doc(db, "users", data.authorId)).then((s) => {
          if (s.exists()) setAuthorData({ [data.authorId]: s.data() });
        }).catch(() => {});

        // Check if liked
        if (user) {
          getDoc(doc(db, "postLikes", `${user.uid}_${snap.id}`)).then((ls) => {
            setLiked(ls.exists());
          }).catch(() => {});
          getDoc(doc(db, "postSaves", `${user.uid}_${snap.id}`)).then((ss) => {
            setSaved(ss.exists());
          }).catch(() => {});
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, user]);

  // Audio for music
  useEffect(() => {
    if (!post?.musicId || !musicMap.current[post.musicId]) return;
    const audio = new Audio(musicMap.current[post.musicId]);
    audio.loop = true;
    audio.muted = true;
    audio.preload = "metadata";
    audioRef.current = audio;
    return () => { audio.pause(); audio.src = ""; audioRef.current = null; };
  }, [post]);

  function toggleSound() {
    const audio = audioRef.current;
    if (!audio) return;
    const newMuted = !globalMuted;
    setGlobalMuted(newMuted);
    audio.muted = newMuted;
    if (!newMuted) audio.play().catch(() => {});
    else audio.pause();
  }

  async function handleLike() {
    if (!user || !post) return;
    const likedId = `${user.uid}_${post.id}`;
    setLiked((p) => !p);
    setLikeCount((c) => liked ? c - 1 : c + 1);
    try {
      if (liked) {
        await deleteDoc(doc(db, "postLikes", likedId));
        await updateDoc(doc(db, "posts", post.id), { likesCount: increment(-1) });
      } else {
        await setDoc(doc(db, "postLikes", likedId), { userId: user.uid, postId: post.id, createdAt: serverTimestamp() });
        await updateDoc(doc(db, "posts", post.id), { likesCount: increment(1) });
      }
    } catch {}
  }

  async function handleSave() {
    if (!user || !post) return;
    setSaved((p) => !p);
    try {
      if (saved) {
        await deleteDoc(doc(db, "postSaves", `${user.uid}_${post.id}`));
      } else {
        await setDoc(doc(db, "postSaves", `${user.uid}_${post.id}`), { postId: post.id, userId: user.uid, createdAt: serverTimestamp() });
      }
    } catch {}
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

  usePageAnimations("post-detail");

  if (loading) return <div className="page"><FeedSkeleton /></div>;

  if (notFound || !post) {
    return (
      <div className="page page-enter" style={{ textAlign: "center", paddingTop: 80 }}>
        <h2 style={{ color: "var(--text)", marginBottom: 12 }}>Post not found</h2>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>This post may have been deleted.</p>
        <button className="btn primary" onClick={() => navigate("/home")}>Go Home</button>
      </div>
    );
  }

  const ad = authorData[post.authorId] || {};
  const images = post.imageUrls?.length ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : []);
  const hasMusic = post.musicId && musicMap.current[post.musicId];

  return (
    <div className="page page-enter" style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn icon-only" onClick={() => {
          if (window.history.length > 1) navigate(-1);
          else navigate("/home");
        }}>
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Post</h2>
      </div>

      <div className="feed-post">
        {/* Author header */}
        <div className="feed-post-header">
          <Link to={`/profile/${post.authorId}`} className="feed-post-avatar-link">
            {ad.profilePic ? (
              <img src={ad.profilePic} alt="" className="feed-post-avatar-img" />
            ) : (
              <div className="feed-post-avatar">{post.authorName?.[0]?.toUpperCase() || "?"}</div>
            )}
          </Link>
          <div className="feed-post-meta-col">
            <Link to={`/profile/${post.authorId}`} className="feed-post-author feed-post-author-link">
              {ad.username ? `@${ad.username}` : post.authorName}
            </Link>
            {post.createdAt && <span className="feed-post-time">{timeAgo(post.createdAt)}</span>}
          </div>
        </div>

        {/* Image slider */}
        {images.length > 0 && (
          <div className="feed-post-slider">
            <div className="feed-post-slider-track" style={{ transform: `translateX(-${sliderIdx * 100}%)` }}>
              {images.map((url, i) => (
                <div key={i} className="feed-post-slide">
                  <img src={url} alt="" className="feed-post-image" />
                </div>
              ))}
            </div>
            {images.length > 1 && (
              <>
                <button className="slider-btn slider-prev" onClick={() => setSliderIdx((i) => Math.max(0, i - 1))} disabled={sliderIdx === 0}>
                  <ChevronLeft size={18} />
                </button>
                <button className="slider-btn slider-next" onClick={() => setSliderIdx((i) => Math.min(images.length - 1, i + 1))} disabled={sliderIdx === images.length - 1}>
                  <ChevronRight size={18} />
                </button>
                <div className="slider-dots">
                  {images.map((_, i) => (
                    <span key={i} className={`slider-dot ${i === sliderIdx ? "active" : ""}`} onClick={() => setSliderIdx(i)} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Caption */}
        {post.caption && <div className="feed-post-caption"><FormattedText text={post.caption} /></div>}

        {/* Music */}
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
                onClick={toggleSound}
                title={globalMuted ? "Unmute" : "Mute"}
              >
                {globalMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="feed-post-actions">
          <button className={`feed-post-action-btn ${liked ? "liked" : ""}`} onClick={handleLike}>
            <Heart size={20} fill={liked ? "var(--error)" : "none"} />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
          <button className={`feed-post-action-btn ${showComments ? "active" : ""}`} onClick={() => setShowComments((p) => !p)}>
            <MessageCircle size={20} />
            {post.commentsCount > 0 && <span>{post.commentsCount}</span>}
          </button>
          <button className={`feed-post-action-btn ${saved ? "saved" : ""}`} onClick={handleSave}>
            <Bookmark size={20} fill={saved ? "var(--cyan)" : "none"} />
          </button>
        </div>

        {showComments && <InlineComments post={post} />}
      </div>
    </div>
  );
}
