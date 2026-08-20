import { createContext, useContext, useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  doc,
  setDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  getDoc,
  increment,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";

const AuthContext = createContext();
const googleProvider = new GoogleAuthProvider();

export function useAuth() {
  return useContext(AuthContext);
}

// ── localStorage helpers ──
function cacheGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, expires } = JSON.parse(raw);
    if (expires && Date.now() > expires) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function cacheSet(key, data, ttlMs = 5 * 60 * 1000) {
  localStorage.setItem(
    key,
    JSON.stringify({ data, expires: Date.now() + ttlMs })
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  /** Signup — email + password */
  async function signup(email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      username: "",
      usernameLower: "",
      email,
      bio: "",
      profilePic: "",
      followersCount: 0,
      followingCount: 0,
      provider: "email",
      createdAt: serverTimestamp(),
    });
    return cred.user;
  }

  /** Ensure user doc exists after any sign-in (popup or redirect) */
  async function ensureUserDoc(u) {
    const userDoc = await getDoc(doc(db, "users", u.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(db, "users", u.uid), {
        username: "",
        usernameLower: "",
        email: u.email,
        bio: "",
        profilePic: u.photoURL || "",
        followersCount: 0,
        followingCount: 0,
        provider: "google",
        createdAt: serverTimestamp(),
      });
    } else if (!userDoc.data().profilePic && u.photoURL) {
      await setDoc(doc(db, "users", u.uid), { profilePic: u.photoURL }, { merge: true });
    }
  }

  // Handle redirect result on mount
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          ensureUserDoc(result.user);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Google Sign-in — tries popup first, falls back to redirect if blocked */
  async function signInWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserDoc(result.user);
      return result.user;
    } catch (err) {
      // If popup was blocked or closed, fall back to redirect
      const code = err.code || "";
      if (
        code === "auth/popup-blocked" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/popup-closed-by-user"
      ) {
        await signInWithRedirect(auth, googleProvider);
        return null; // redirect will navigate away
      }
      throw err; // re-throw real errors
    }
  }

  /** Claim a unique username */
  async function claimUsername(username) {
    const clean = username.trim().toLowerCase();
    const usernameRef = doc(db, "usernames", clean);

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(usernameRef);
        if (snap.exists()) throw new Error("taken");
        tx.set(usernameRef, { uid: "pending", status: "pending" });
      });
    } catch (err) {
      if (err.message === "taken") {
        throw new Error("That username is already taken. Try another.");
      }
      throw new Error("Something went wrong. Try again.");
    }

    try {
      await updateProfile(auth.currentUser, { displayName: username.trim() });
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        { username: username.trim(), usernameLower: clean },
        { merge: true }
      );
      await setDoc(usernameRef, {
        uid: auth.currentUser.uid,
        username: username.trim(),
        status: "active",
      });
    } catch (err) {
      await deleteDoc(usernameRef).catch(() => {});
      throw err;
    }
  }

  /** Resolve username or email */
  async function resolveLoginInput(input) {
    const trimmed = input.trim();
    if (trimmed.includes("@")) return trimmed;

    const clean = trimmed.toLowerCase();
    const cacheKey = `user_lookup_${clean}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const usernameSnap = await getDoc(doc(db, "usernames", clean));
    if (!usernameSnap.exists()) {
      throw new Error("No account found for that username.");
    }
    const { uid } = usernameSnap.data();
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) {
      throw new Error("Account data is incomplete.");
    }
    const email = userSnap.data().email;
    cacheSet(cacheKey, email, 10 * 60 * 1000);
    return email;
  }

  async function login(identifier, password) {
    const email = await resolveLoginInput(identifier);
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function resetPassword(identifier) {
    const email = await resolveLoginInput(identifier);
    return sendPasswordResetEmail(auth, email);
  }

  async function logout() {
    return signOut(auth);
  }

  // ── Follow / Unfollow ──
  async function followUser(targetUid) {
    if (!user || user.uid === targetUid) return;
    const followId = `${user.uid}_${targetUid}`;
    const followRef = doc(db, "follows", followId);
    const snap = await getDoc(followRef);

    if (snap.exists()) {
      // Unfollow
      await deleteDoc(followRef);
      await setDoc(doc(db, "users", targetUid), { followersCount: increment(-1) }, { merge: true });
      await setDoc(doc(db, "users", user.uid), { followingCount: increment(-1) }, { merge: true });
      return false;
    } else {
      // Follow
      await setDoc(followRef, {
        followerId: user.uid,
        followingId: targetUid,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "users", targetUid), { followersCount: increment(1) }, { merge: true });
      await setDoc(doc(db, "users", user.uid), { followingCount: increment(1) }, { merge: true });
      return true;
    }
  }

  async function isFollowing(targetUid) {
    if (!user) return false;
    const followRef = doc(db, "follows", `${user.uid}_${targetUid}`);
    const snap = await getDoc(followRef);
    return snap.exists();
  }

  const value = {
    user,
    signup,
    signInWithGoogle,
    login,
    claimUsername,
    resetPassword,
    logout,
    followUser,
    isFollowing,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
