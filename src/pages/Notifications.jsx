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
import { Heart, UserPlus, MessageCircle, Bell } from "lucide-react";
import { FeedSkeleton } from "../components/LoadingSkeleton";

function timeAgo(ts) {
  if (!ts?.seconds) return "";
  const diff = Date.now() - ts.seconds * 1000;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  return days + "d ago";
}

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const followersQ = query(
          collection(db, "follows"),
          where("followingId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        const followersSnap = await getDocs(followersQ);

        const followingQ = query(
          collection(db, "follows"),
          where("followerId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        const followingSnap = await getDocs(followingQ);

        const notifs = [];

        for (const d of followersSnap.docs) {
          const data = d.data();
          try {
            const userSnap = await getDoc(doc(db, "users", data.followerId));
            if (userSnap.exists()) {
              const u = userSnap.data();
              notifs.push({
                id: d.id,
                type: "follow",
                userId: data.followerId,
                username: u.username,
                profilePic: u.profilePic,
                createdAt: data.createdAt,
                text: "started following you",
              });
            }
          } catch {}
        }

        const followingUids = followingSnap.docs.map((d) => d.data().followingId);
        if (followingUids.length > 0) {
          const postsQ = query(
            collection(db, "posts"),
            where("authorId", "in", followingUids.slice(0, 10)),
            orderBy("createdAt", "desc"),
            limit(10)
          );
          const postsSnap = await getDocs(postsQ);
          for (const p of postsSnap.docs) {
            const pData = p.data();
            if (pData.likesCount > 0) {
              const authorSnap = await getDoc(doc(db, "users", pData.authorId));
              if (authorSnap.exists()) {
                const a = authorSnap.data();
                notifs.push({
                  id: "like_" + p.id,
                  type: "like",
                  userId: pData.authorId,
                  username: a.username,
                  profilePic: a.profilePic,
                  createdAt: pData.createdAt,
                  text: "liked a post",
                  postId: p.id,
                });
              }
            }
          }
        }

        notifs.sort((a, b) => {
          const ta = a.createdAt?.seconds || 0;
          const tb = b.createdAt?.seconds || 0;
          return tb - ta;
        });

        if (!cancelled) setNotifications(notifs);
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
          <Bell size={24} /> <span className="neon-text">Notifications</span>
        </h1>
      </div>

      {loading ? (
        <FeedSkeleton />
      ) : notifications.length === 0 ? (
        <div className="home-empty">
          <Bell size={40} strokeWidth={1.5} />
          <p>No notifications yet. Follow people to see their activity!</p>
        </div>
      ) : (
        <div className="feed">
          {notifications.map((n) => (
            <Link
              key={n.id}
              to={n.type === "like" ? "/home" : "/profile/" + n.userId}
              className="notification-item"
            >
              {n.profilePic ? (
                <img src={n.profilePic} alt="" className="notification-avatar" />
              ) : (
                <div className="notification-avatar notification-avatar-fallback">
                  {(n.username && n.username[0]) ? n.username[0].toUpperCase() : "?"}
                </div>
              )}
              <div className="notification-content">
                <span className="notification-text">
                  <strong>@{n.username}</strong> {n.text}
                </span>
                <span className="notification-time">{timeAgo(n.createdAt)}</span>
              </div>
              <div className="notification-icon">
                {n.type === "follow" && <UserPlus size={16} />}
                {n.type === "like" && <Heart size={16} fill="var(--error)" color="var(--error)" />}
                {n.type === "comment" && <MessageCircle size={16} />}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
