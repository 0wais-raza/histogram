import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  doc,
  getDoc,
  query,
  collection,
  where,
  orderBy,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import EditProfile from "../components/EditProfile";
import { ImageIcon, Trash2, UserPlus, UserMinus } from "lucide-react";
import { ProfileSkeleton } from "../components/LoadingSkeleton";
import { alertConfirm, alertError, alertSuccess } from "../utils/alerts";

export default function Profile() {
  const { uid } = useParams();
  const { user, followUser, isFollowing } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const isOwner = user?.uid === uid;

  const loadProfile = useCallback(async () => {
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) setProfile(userSnap.data());
    } catch {
      // silent
    }
  }, [uid]);

  const loadPosts = useCallback(async () => {
    try {
      const postsSnap = await getDocs(
        query(
          collection(db, "posts"),
          where("authorId", "==", uid),
          orderBy("createdAt", "desc")
        )
      );
      setPosts(postsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      // silent
    }
  }, [uid]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([loadProfile(), loadPosts()]);
      if (!isOwner && user) {
        const f = await isFollowing(uid);
        setFollowing(f);
      }
      setLoading(false);
    }
    load();
  }, [uid, loadProfile, loadPosts, isOwner, user, isFollowing]);

  async function handleFollow() {
    setFollowLoading(true);
    try {
      const result = await followUser(uid);
      setFollowing(result);
      await loadProfile();
    } catch {
      // silent
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleDeletePost(post) {
    const confirmed = await alertConfirm(
      "Delete post?",
      "This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "posts", post.id));
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      await alertSuccess("Deleted", "Your post has been removed.");
    } catch (err) {
      alertError(
        "Delete failed",
        err.message.replace("Firebase: ", "") || "Something went wrong."
      );
    }
  }

  usePageAnimations("profile");

  if (loading)
    return (
      <div className="page">
        <ProfileSkeleton />
      </div>
    );

  if (!profile) return <div className="page">Profile not found.</div>;

  if (!profile.username && isOwner) {
    return (
      <div className="page">
        <h1>Your profile isn't set up yet</h1>
        <p>
          Go to the <Link to="/home">home page</Link> to complete your profile.
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
        <div className="profile-info">
          <h2>
            @{profile.username || "New user"}
          </h2>
          <p className="bio">{profile.bio || "No bio yet."}</p>
          <div className="stats">
            <div className="stat-item">
              <span className="stat-value">{posts.length}</span>
              <span className="stat-label">Posts</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">
                {profile.followersCount ?? 0}
              </span>
              <span className="stat-label">Followers</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">
                {profile.followingCount ?? 0}
              </span>
              <span className="stat-label">Following</span>
            </div>
          </div>
          <div className="profile-actions">
            {isOwner ? (
              <button
                className="btn"
                onClick={() => setEditing(true)}
              >
                Edit profile
              </button>
            ) : (
              user && (
                <button
                  className={`btn ${following ? "ghost" : "primary"}`}
                  onClick={handleFollow}
                  disabled={followLoading}
                >
                  {following ? (
                    <>
                      <UserMinus size={16} />
                      Unfollow
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Follow
                    </>
                  )}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {editing && (
        <EditProfile
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={loadProfile}
        />
      )}

      <div className="profile-posts">
        {posts.length === 0 ? (
          <div className="profile-empty">
            <ImageIcon size={48} strokeWidth={1.5} />
            <p>
              {isOwner
                ? "No posts yet — create your first!"
                : "No posts yet."}
            </p>
          </div>
        ) : (
          posts.map((p) => (
            <div key={p.id} className="grid-item-wrapper">
              <img
                src={p.imageUrl}
                alt={p.caption || "Post"}
                className="grid-item"
              />
              {isOwner && (
                <button
                  className="grid-item-delete"
                  onClick={() => handleDeletePost(p)}
                  title="Delete post"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
