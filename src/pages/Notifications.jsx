import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, getDoc, getDocs, where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import { Heart, UserPlus, MessageCircle, Bell, Bookmark } from "lucide-react";
import { NotifSkeleton } from "../components/LoadingSkeleton";

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

    // Realtime follower notifications
    const followsQ = query(
      collection(db, "follows"),
      where("followingId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubFollowers = onSnapshot(followsQ, async (followersSnap) => {
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

      // ── Likes on YOUR posts ──
      try {
        const myPostsQ = query(
          collection(db, "posts"),
          where("authorId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(10)
        );
        const myPostsSnap = await getDocs(myPostsQ);
        for (const pDoc of myPostsSnap.docs) {
          const postData = pDoc.data();
          // Get likes on this post
          const likesQ = query(
            collection(db, "postLikes"),
            where("postId", "==", pDoc.id),
            orderBy("createdAt", "desc"),
            limit(5)
          );
          const likesSnap = await getDocs(likesQ);
          for (const likeDoc of likesSnap.docs) {
            const likeData = likeDoc.data();
            if (likeData.userId === user.uid) continue;
            try {
              const likerSnap = await getDoc(doc(db, "users", likeData.userId));
              if (likerSnap.exists()) {
                const u = likerSnap.data();
                notifs.push({
                  id: likeDoc.id,
                  type: "like",
                  userId: likeData.userId,
                  username: u.username,
                  profilePic: u.profilePic,
                  createdAt: likeData.createdAt,
                  text: "liked your post",
                  postId: pDoc.id,
                });
              }
            } catch {}
          }
        }
      } catch {}

      // ── Comments on YOUR posts ──
      try {
        const myPostsQ2 = query(
          collection(db, "posts"),
          where("authorId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(10)
        );
        const myPostsSnap2 = await getDocs(myPostsQ2);
        for (const pDoc of myPostsSnap2.docs) {
          const commentsQ = query(
            collection(db, "posts", pDoc.id, "comments"),
            orderBy("createdAt", "desc"),
            limit(5)
          );
          const commentsSnap = await getDocs(commentsQ);
          for (const cDoc of commentsSnap.docs) {
            const cData = cDoc.data();
            if (cData.authorId === user.uid) continue;
            try {
              const commenterSnap = await getDoc(doc(db, "users", cData.authorId));
              if (commenterSnap.exists()) {
                const u = commenterSnap.data();
                notifs.push({
                  id: "comment_" + cDoc.id,
                  type: "comment",
                  userId: cData.authorId,
                  username: u.username,
                  profilePic: u.profilePic,
                  createdAt: cData.createdAt,
                  text: "commented on your post",
                  postId: pDoc.id,
                });
              }
            } catch {}
          }
        }
      } catch {}

      // Also check posts from people we follow (for general activity)
      const followingQ = query(
        collection(db, "follows"),
        where("followerId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const followingSnap = await getDocs(followingQ);
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
            try {
              const authorSnap = await getDoc(doc(db, "users", pData.authorId));
              if (authorSnap.exists()) {
                const a = authorSnap.data();
                notifs.push({
                  id: "newpost_" + p.id,
                  type: "new_post",
                  userId: pData.authorId,
                  username: a.username,
                  profilePic: a.profilePic,
                  createdAt: pData.createdAt,
                  text: "shared a new post",
                  postId: p.id,
                });
              }
            } catch {}
          }
        }
      }

      notifs.sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });

      setNotifications(notifs);
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return unsubFollowers;
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
        <NotifSkeleton />
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
              to={(n.type === "like" || n.type === "comment" || n.type === "new_post") ? "/post/" + n.postId : "/profile/" + n.userId}
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
                {n.type === "like" && <Heart size={16} fill="var(--accent-bright)" color="var(--accent-bright)" />}
                {n.type === "new_post" && <Bookmark size={16} color="var(--accent-bright)" />}
                {n.type === "comment" && <MessageCircle size={16} />}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
