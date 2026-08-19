import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  query,
  limit,
  getDocs,
  doc,
  getDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import { MessageCircle, Send, Edit } from "lucide-react";
import { FeedSkeleton } from "../components/LoadingSkeleton";

export default function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // Get people the user follows and who follow them (potential conversations)
        const followingSnap = await getDocs(
          query(collection(db, "follows"), where("followerId", "==", user.uid), limit(30)
        ));
        const followersSnap = await getDocs(
          query(collection(db, "follows"), where("followingId", "==", user.uid), limit(30)
        ));

        const followingUids = new Set(followingSnap.docs.map((d) => d.data().followingId));
        const followerUids = new Set(followersSnap.docs.map((d) => d.data().followerId));

        // Mutual follows are "conversation" candidates
        const mutualUids = [...followingUids].filter((uid) => followerUids.has(uid));

        const convos = [];
        for (const uid of mutualUids.slice(0, 20)) {
          try {
            const s = await getDoc(doc(db, "users", uid));
            if (s.exists()) {
              const d = s.data();
              convos.push({
                uid,
                username: d.username,
                profilePic: d.profilePic,
                bio: d.bio,
              });
            }
          } catch {}
        }

        if (!cancelled) setConversations(convos);
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
        <h1 className="home-title">
          <MessageCircle size={24} /> <span className="neon-text">Messages</span>
        </h1>
        <button className="btn icon-only" title="New message">
          <Edit size={20} />
        </button>
      </div>

      {loading ? (
        <FeedSkeleton />
      ) : conversations.length === 0 ? (
        <div className="home-empty">
          <Send size={40} strokeWidth={1.5} />
          <p>No messages yet. Follow people to start chatting!</p>
        </div>
      ) : (
        <div className="messages-list">
          {conversations.map((c) => (
            <Link key={c.uid} to={`/profile/${c.uid}`} className="message-item">
              {c.profilePic ? (
                <img src={c.profilePic} alt="" className="message-avatar" />
              ) : (
                <div className="message-avatar message-avatar-fallback">
                  {c.username?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              <div className="message-info">
                <span className="message-username">@{c.username}</span>
                <span className="message-preview">{c.bio || "Tap to view profile"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
