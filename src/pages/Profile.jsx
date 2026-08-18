import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  query,
  collection,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import EditProfile from "../components/EditProfile";

export default function Profile() {
  const { uid } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const isOwner = user?.uid === uid;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const userSnap = await getDoc(doc(db, "users", uid));
        if (userSnap.exists()) setProfile(userSnap.data());

        const postsSnap = await getDocs(
          query(
            collection(db, "posts"),
            where("authorId", "==", uid),
            orderBy("createdAt", "desc")
          )
        );
        setPosts(postsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        // Handle silently
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [uid]);

  usePageAnimations("profile");

  if (loading) return <div className="loading">Loading…</div>;

  if (!profile) return <div className="page">Profile not found.</div>;

  if (!profile.username && isOwner) {
    return (
      <div className="page">
        <h1>Your profile isn't set up yet</h1>
        <p>
          Go to the <a href="/home">home page</a> to complete your profile.
        </p>
      </div>
    );
  }

  return (
    <div className="page page-enter">
      <div className="profile-header">
        <img
          className="avatar"
          src={profile.profilePic || "/histogram.png"}
          alt={profile.username || "user"}
        />
        <div>
          <h2>{profile.username ? `@${profile.username}` : "New user"}</h2>
          <p className="bio">{profile.bio || "No bio yet."}</p>
          <div className="stats">
            <span>{posts.length} posts</span>
            <span>{profile.followersCount ?? 0} followers</span>
            <span>{profile.followingCount ?? 0} following</span>
          </div>
          {isOwner && (
            <button className="btn" onClick={() => setEditing(true)}>
              Edit profile
            </button>
          )}
        </div>
      </div>

      {editing && (
        <EditProfile profile={profile} onClose={() => setEditing(false)} />
      )}

      <div className="profile-posts">
        {posts.length === 0 ? (
          <p className="muted">
            {isOwner ? "No posts yet — create your first!" : "No posts yet."}
          </p>
        ) : (
          posts.map((p) => (
            <img
              key={p.id}
              src={p.imageUrl}
              alt={p.title}
              className="grid-item"
            />
          ))
        )}
      </div>
    </div>
  );
}
