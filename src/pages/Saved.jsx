import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import { Bookmark } from "lucide-react";
import { FeedSkeleton } from "../components/LoadingSkeleton";
import FormattedText from "../components/FormattedText";

export default function Saved() {
  const { user } = useAuth();
  const [savedPosts, setSavedPosts] = useState([]);
  const [authorData, setAuthorData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    // Subscribe to saves in realtime
    const savesQ = query(
      collection(db, "postSaves"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(savesQ, async (savesSnap) => {
      if (cancelled) return;
      const postIds = savesSnap.docs.map((d) => d.data().postId);

      if (postIds.length === 0) {
        setSavedPosts([]);
        setLoading(false);
        return;
      }

      // Fetch posts in batches of 10 (Firestore limit)
      const allPosts = [];
      for (let i = 0; i < postIds.length; i += 10) {
        const batch = postIds.slice(i, i + 10);
        try {
          const postsSnap = await getDocs(
            query(collection(db, "posts"), where("__name__", "in", batch))
          );
          allPosts.push(...postsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch {}
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
      setLoading(false);
    }, () => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; unsub(); };
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
                {post.caption && <div className="feed-post-caption"><FormattedText text={post.caption} /></div>}
                <Link
                  to={`/profile/${post.authorId}`}
                  className="saved-post-author-link"
                >
                  {ad.profilePic ? (
                    <img src={ad.profilePic} alt="" className="saved-post-author-pic" />
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
