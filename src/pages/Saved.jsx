import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection, query, where, orderBy, getDocs, doc, getDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import { Bookmark } from "lucide-react";
import { FeedSkeleton } from "../components/LoadingSkeleton";

export default function Saved() {
  const { user } = useAuth();
  const [savedPosts, setSavedPosts] = useState([]);
  const [authorData, setAuthorData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const savesSnap = await getDocs(
          query(collection(db, "postSaves"), where("userId", "==", user.uid), orderBy("createdAt", "desc"))
        );
        const postIds = savesSnap.docs.map((d) => d.data().postId);
        if (postIds.length === 0) { if (!cancelled) { setSavedPosts([]); setLoading(false); } return; }

        // Fetch posts in batches of 10 (Firestore limit)
        const allPosts = [];
        for (let i = 0; i < postIds.length; i += 10) {
          const batch = postIds.slice(i, i + 10);
          const postsSnap = await getDocs(
            query(collection(db, "posts"), where("__name__", "in", batch))
          );
          allPosts.push(...postsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
        if (cancelled) return;
        setSavedPosts(allPosts);

        // Fetch author data
        const uids = [...new Set(allPosts.map((p) => p.authorId).filter(Boolean))];
        const data = {};
        for (const uid of uids) {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            if (snap.exists()) {
              const d = snap.data();
              data[uid] = { profilePic: d.profilePic || "", username: d.username || "" };
            }
          } catch {}
        }
        if (!cancelled && Object.keys(data).length) setAuthorData(data);
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  usePageAnimations("home");

  return (
    <div className="page page-enter">
      <div className="home-header">
        <h1 className="home-title"><span className="neon-text">Saved</span> Posts</h1>
      </div>

      {loading ? <FeedSkeleton /> : savedPosts.length === 0 ? (
        <div className="home-empty">
          <Bookmark size={40} strokeWidth={1.5} />
          <p>No saved posts yet. Bookmark posts to see them here!</p>
        </div>
      ) : (
        <div className="feed">
          {savedPosts.map((post) => {
            const ad = authorData[post.authorId] || {};
            const images = post.imageUrls?.length ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : []);
            return (
              <div key={post.id} className="feed-post">
                {images.length > 0 && <img src={images[0]} alt="" className="feed-post-image" />}
                {post.caption && <p className="feed-post-caption">{post.caption}</p>}
                <Link
                  to={`/profile/${post.authorId}`}
                  className="feed-post-caption"
                  style={{ borderTop: "1px solid var(--border)", paddingTop: 8, fontSize: 12, color: "var(--muted)", textDecoration: "none", display: "block" }}
                >
                  {ad.profilePic ? (
                    <img src={ad.profilePic} alt="" style={{ width: 16, height: 16, borderRadius: "50%", verticalAlign: "middle", marginRight: 6 }} />
                  ) : null}
                  Posted by {ad.username ? `@${ad.username}` : post.authorName}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
