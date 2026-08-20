import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import { TrendingUp, Hash, Music, Bookmark, Heart, MessageCircle } from "lucide-react";
import { DiscoverSkeleton } from "../components/LoadingSkeleton";

export default function Discover() {
  const { user } = useAuth();
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [categories] = useState([
    { label: "For You", icon: TrendingUp },
    { label: "Music", icon: Music },
    { label: "Tags", icon: Hash },
    { label: "Saved", icon: Bookmark },
  ]);
  const [activeCategory, setActiveCategory] = useState("For You");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        if (activeCategory === "Saved") {
          const savesSnap = await getDocs(
            query(collection(db, "postSaves"), where("userId", "==", user.uid), orderBy("createdAt", "desc"), limit(20))
          );
          const postIds = savesSnap.docs.map((d) => d.data().postId);
          if (postIds.length === 0) {
            if (!cancelled) setTrendingPosts([]);
            setLoading(false);
            return;
          }
          const allPosts = [];
          for (let i = 0; i < postIds.length; i += 10) {
            const batch = postIds.slice(i, i + 10);
            const postsSnap = await getDocs(query(collection(db, "posts"), where("__name__", "in", batch)));
            allPosts.push(...postsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
          }
          if (!cancelled) setTrendingPosts(allPosts);
        } else {
          const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(30));
          const snap = await getDocs(q);
          const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

          let filtered = posts;
          if (activeCategory === "Music") {
            filtered = posts.filter((p) => p.musicUrl || p.musicName);
          }

          const uids = [...new Set(filtered.map((p) => p.authorId).filter(Boolean))];
          const authorData = {};
          for (const uid of uids) {
            try {
              const s = await getDoc(doc(db, "users", uid));
              if (s.exists()) {
                authorData[uid] = { profilePic: s.data().profilePic || "", username: s.data().username || "" };
              }
            } catch {}
          }

          if (!cancelled) {
            setTrendingPosts(filtered.map((p) => ({ ...p, _author: authorData[p.authorId] || {} })));
          }
        }
      } catch {}
      finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [activeCategory, user]);

  usePageAnimations("discover");

  return (
    <div className="page page-enter">
      <div className="home-header">
        <h1 className="home-title">
          <span className="neon-text">Discover</span>
        </h1>
      </div>

      <div className="discover-categories">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.label}
              className={`discover-category-btn ${activeCategory === cat.label ? "active" : ""}`}
              onClick={() => setActiveCategory(cat.label)}
            >
              <Icon size={16} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <DiscoverSkeleton />
      ) : trendingPosts.length === 0 ? (
        <div className="home-empty">
          <TrendingUp size={40} strokeWidth={1.5} />
          <p>{activeCategory === "Saved" ? "No saved posts yet." : "No posts to discover yet."}</p>
        </div>
      ) : (
        <div className="discover-grid">
          {trendingPosts.map((post) => {
            const images = post.imageUrls?.length ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : []);
            return (
              <Link key={post.id} to={`/profile/${post.authorId}`} className="discover-grid-item">
                {images.length > 0 ? (
                  <img src={images[0]} alt="" className="discover-grid-img" />
                ) : (
                  <div className="discover-grid-text">
                    <p>{post.caption?.slice(0, 60) || "Text post"}</p>
                  </div>
                )}
                <div className="discover-grid-overlay">
                  <span><Heart size={14} /> {post.likesCount || 0}</span>
                  <span><MessageCircle size={14} /> {post.commentsCount || 0}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
