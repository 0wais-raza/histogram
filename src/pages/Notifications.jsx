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
      const userCache = new Map(); // Cache user data to avoid duplicate fetches

      // Helper to fetch user data with caching
      async function getCachedUser(uid) {
        if (userCache.has(uid)) return userCache.get(uid);
        try {
          const snap = await getDoc(doc(db, "users", uid));
          if (snap.exists()) {
            const data = snap.data();
            userCache.set(uid, data);
            return data;
          }
        } catch {}
        return null;
      }

      // ── Follow notifications (real-time via onSnapshot) ──
      for (const d of followersSnap.docs) {
        const data = d.data();
        const userData = await getCachedUser(data.followerId);
        if (userData) {
          notifs.push({
            id: d.id,
            type: "follow",
            userId: data.followerId,
            username: userData.username,
            profilePic: userData.profilePic,
            createdAt: data.createdAt,
            text: "started following you",
          });
        }
      }

      // ── Likes & Comments on YOUR posts ──
      try {
        // Fetch user's posts once
        const myPostsQ = query(
          collection(db, "posts"),
          where("authorId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(10)
        );
        const myPostsSnap = await getDocs(myPostsQ);
        const myPosts = myPostsSnap.docs;

        // Batch: get likes for all posts in parallel
        const likePromises = myPosts.map((pDoc) =>
          getDocs(query(collection(db, "postLikes"), where("postId", "==", pDoc.id), orderBy("createdAt", "desc"), limit(5)))
            .then((snap) => ({ postId: pDoc.id, likes: snap.docs }))
            .catch(() => ({ postId: pDoc.id, likes: [] }))
        );

        // Batch: get comments for all posts in parallel
        const commentPromises = myPosts.map((pDoc) =>
          getDocs(query(collection(db, "posts", pDoc.id, "comments"), orderBy("createdAt", "desc"), limit(5)))
            .then((snap) => ({ postId: pDoc.id, comments: snap.docs }))
            .catch(() => ({ postId: pDoc.id, comments: [] }))
        );

        const [likeResults, commentResults] = await Promise.all([
          Promise.all(likePromises),
          Promise.all(commentPromises),
        ]);

        // Process likes
        for (const { postId, likes } of likeResults) {
          for (const likeDoc of likes) {
            const likeData = likeDoc.data();
            if (likeData.userId === user.uid) continue;
            const userData = await getCachedUser(likeData.userId);
            if (userData) {
              notifs.push({
                id: likeDoc.id,
                type: "like",
                userId: likeData.userId,
                username: userData.username,
                profilePic: userData.profilePic,
                createdAt: likeData.createdAt,
                text: "liked your post",
                postId,
              });
            }
          }
        }

        // Process comments
        for (const { postId, comments } of commentResults) {
          for (const cDoc of comments) {
            const cData = cDoc.data();
            if (cData.authorId === user.uid) continue;
            const userData = await getCachedUser(cData.authorId);
            if (userData) {
              notifs.push({
                id: "comment_" + cDoc.id,
                type: "comment",
                userId: cData.authorId,
                username: userData.username,
                profilePic: userData.profilePic,
                createdAt: cData.createdAt,
                text: "commented on your post",
                postId,
              });
            }
          }
        }
      } catch {}

      // ── New posts from people we follow ──
      try {
        const followingQ = query(
          collection(db, "follows"),
          where("followerId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        const followingSnap = await getDocs(followingQ);
        const followingUids = followingSnap.docs.map((d) => d.data().followingId);

        if (followingUids.length > 0) {
          // Firestore `in` query limit is 10
          const allPosts = [];
          for (let i = 0; i < Math.min(followingUids.length, 10); i += 10) {
            const batch = followingUids.slice(i, i + 10);
            const postsSnap = await getDocs(
              query(collection(db, "posts"), where("authorId", "in", batch), orderBy("createdAt", "desc"), limit(10))
            );
            allPosts.push(...postsSnap.docs);
          }

          for (const p of allPosts) {
            const pData = p.data();
            if (pData.likesCount > 0) {
              const authorData = await getCachedUser(pData.authorId);
              if (authorData) {
                notifs.push({
                  id: "newpost_" + p.id,
                  type: "new_post",
                  userId: pData.authorId,
                  username: authorData.username,
                  profilePic: authorData.profilePic,
                  createdAt: pData.createdAt,
                  text: "shared a new post",
                  postId: p.id,
                });
              }
            }
          }
        }
      } catch {}

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
