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
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import { Film, Heart, MessageCircle, Music } from "lucide-react";
import { FeedSkeleton } from "../components/LoadingSkeleton";

export default function Reels() {
  const { user } = useAuth();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeReel, setActiveReel] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(20));
        const snap = await getDocs(q);
        const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Fetch author data
        const uids = [...new Set(posts.map((p) => p.authorId).filter(Boolean))];
        const authorData = {};
        for (const uid of uids) {
          try {
            const s = await getDoc(doc(db, "users", uid));
            if (s.exists()) {
              authorData[uid] = { profilePic: s.data().profilePic || "", username: s.data().username || "" };
            }
          } catch {}
        }

        setReels(posts.map((p) => ({ ...p, _author: authorData[p.authorId] || {} })));
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  usePageAnimations("home");

  if (loading) return <div className="page"><FeedSkeleton /></div>;

  return (
    <div className="page page-enter">
      <div className="home-header">
        <h1 className="home-title">
          <Film size={24} /> <span className="neon-text">Reels</span>
        </h1>
      </div>

      {reels.length === 0 ? (
        <div className="home-empty">
          <Film size={40} strokeWidth={1.5} />
          <p>No reels yet. Be the first to share!</p>
        </div>
      ) : (
        <div className="reels-container">
          {reels.map((reel, idx) => {
            const images = reel.imageUrls?.length ? reel.imageUrls : (reel.imageUrl ? [reel.imageUrl] : []);
            const a = reel._author;
            return (
              <div key={reel.id} className="reel-card">
                {images.length > 0 ? (
                  <img src={images[0]} alt="" className="reel-image" />
                ) : (
                  <div className="reel-image reel-placeholder">
                    <Film size={48} />
                  </div>
                )}
                <div className="reel-overlay">
                  <div className="reel-actions">
                    <div className="reel-action">
                      <Heart size={24} />
                      <span>{reel.likesCount || 0}</span>
                    </div>
                    <div className="reel-action">
                      <MessageCircle size={24} />
                      <span>{reel.commentsCount || 0}</span>
                    </div>
                  </div>
                  <div className="reel-info">
                    <Link to={`/profile/${reel.authorId}`} className="reel-author">
                      {a.profilePic ? (
                        <img src={a.profilePic} alt="" className="reel-author-pic" />
                      ) : (
                        <div className="reel-author-pic reel-author-fallback">
                          {a.username?.[0]?.toUpperCase() || "?"}
                        </div>
                      )}
                      <span>{a.username ? `@${a.username}` : reel.authorName}</span>
                    </Link>
                    {reel.caption && <p className="reel-caption">{reel.caption}</p>}
                    {reel.musicName && (
                      <div className="reel-music">
                        <Music size={12} />
                        <span>{reel.musicName}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
