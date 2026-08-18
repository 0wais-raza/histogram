import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import SetupProfile from "../components/SetupProfile";
import { Sparkles } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checking, setChecking] = useState(true);

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

  function handleSetupComplete() {
    setNeedsSetup(false);
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) setProfile(snap.data());
    });
  }

  usePageAnimations("home");

  if (checking) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="page page-enter">
      {needsSetup && (
        <SetupProfile profile={profile} onComplete={handleSetupComplete} />
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
        <p>Your personalized feed is coming soon.</p>
      </div>

      <div className="feed-placeholder">
        <div className="feed-icon">
          <Sparkles size={32} />
        </div>
        <h2>Feed Coming Soon</h2>
        <p>
          We're working on something amazing. The photo feed is launching in
          Phase 2.
        </p>
      </div>
    </div>
  );
}
