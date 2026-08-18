import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import SetupProfile from "../components/SetupProfile";

export default function Home() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if the user has completed their profile
  useEffect(() => {
    async function checkProfile() {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data);
          // No username = needs setup
          if (!data.username) {
            setNeedsSetup(true);
          }
        }
      } catch {
        // If doc doesn't exist, they need setup
        setNeedsSetup(true);
      } finally {
        setChecking(false);
      }
    }
    checkProfile();
  }, [user]);

  function handleSetupComplete() {
    setNeedsSetup(false);
    // Refresh profile data
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) setProfile(snap.data());
    });
  }

  usePageAnimations("home");

  if (checking) {
    return <div className="loading">Loading…</div>;
  }

  return (
    <div className="page page-enter">
      {needsSetup && (
        <SetupProfile profile={profile} onComplete={handleSetupComplete} />
      )}

      <h1>Welcome{profile?.username ? `, @${profile.username}` : ""} 👋</h1>
      <p>Feed coming in Phase 2.</p>
    </div>
  );
}
