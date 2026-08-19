import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import SetupProfile from "../components/SetupProfile";
import CreatePost from "../components/CreatePost";
import { FeedSkeleton } from "../components/LoadingSkeleton";
import { Plus } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

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

  async function loadPosts() {
    setLoadingPosts(true);
    try {
      const q = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const snap = await getDocs(q);
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      // Handle silently
    } finally {
      setLoadingPosts(false);
    }
  }

  useEffect(() => {
    if (!checking && user) loadPosts();
  }, [checking, user]);

  function handleSetupComplete() {
    setNeedsSetup(false);
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) setProfile(snap.data());
    });
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

      <div className="home-welcome">
        <h1>
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

      {loadingPosts ? (
        <FeedSkeleton />
      ) : posts.length === 0 ? (
        <div className="home-empty">
          <p>No posts yet — be the first to share something!</p>
        </div>
      ) : (
        <div className="feed">
          {posts.map((post) => (
            <div key={post.id} className="feed-post">
              <div className="feed-post-header">
                <div className="feed-post-avatar">
                  {post.authorName?.[0]?.toUpperCase() || "?"}
                </div>
                <span className="feed-post-author">{post.authorName}</span>
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
            </div>
          ))}
        </div>
      )}

      <button
        className="fab"
        onClick={() => setShowCreate(true)}
        aria-label="Create post"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
