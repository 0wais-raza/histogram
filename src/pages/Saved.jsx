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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      try {
        const savesSnap = await getDocs(
          query(collection(db, "postSaves"), where("userId", "==", user.uid), orderBy("createdAt", "desc"))
        );
        const postIds = savesSnap.docs.map((d) => d.data().postId);
        if (postIds.length === 0) { setLoading(false); return; }

        // Fetch posts in batches of 10 (Firestore limit)
        const allPosts = [];
        for (let i = 0; i < postIds.length; i += 10) {
          const batch = postIds.slice(i, i + 10);
          const postsSnap = await getDocs(
            query(collection(db, "posts"), where("__name__", "in", batch))
          );
          allPosts.push(...postsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
        setSavedPosts(allPosts);
      } catch {}
      finally { setLoading(false); }
    }
    load();
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
          {savedPosts.map((post) => (
            <div key={post.id} className="feed-post">
              {post.imageUrl && <img src={post.imageUrl} alt="" className="feed-post-image" />}
              {post.caption && <p className="feed-post-caption">{post.caption}</p>}
              <div className="feed-post-caption" style={{ borderTop: "1px solid var(--border)", paddingTop: 8, fontSize: 12, color: "var(--muted)" }}>
                Posted by {post.authorName}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
