import { createContext, useContext, useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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
} from "firebase/firestore";
import { auth, db } from "../firebase/config";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
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

  /**
   * Signup — just email + password. No username yet.
   * Creates a minimal user doc that signals "profile needs setup".
   */
  async function signup(email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // Create a minimal profile doc — username is empty so the app
    // knows to show the SetupProfile modal on first visit.
    await setDoc(doc(db, "users", cred.user.uid), {
      username: "",
      usernameLower: "",
      email,
      bio: "",
      profilePic: "",
      followersCount: 0,
      followingCount: 0,
      createdAt: serverTimestamp(),
    });

    return cred.user;
  }

  /**
   * Claim a unique username for the current user.
   * Called from SetupProfile after signup.
   */
  async function claimUsername(username) {
    const clean = username.trim().toLowerCase();
    const usernameRef = doc(db, "usernames", clean);

    // 1. Atomically reserve the name
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
      // 2. Update the user's auth displayName
      await updateProfile(auth.currentUser, { displayName: username.trim() });

      // 3. Finalize user doc + username claim
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

  /**
   * Resolve a username or email to an email address.
   * @param {string} input — email or username
   * @returns {Promise<string>} the email
   */
  async function resolveLoginInput(input) {
    const trimmed = input.trim();
    if (trimmed.includes("@")) return trimmed;

    // Look up by document ID — fast & exact
    const clean = trimmed.toLowerCase();
    const usernameSnap = await getDoc(doc(db, "usernames", clean));

    if (!usernameSnap.exists()) {
      throw new Error(
        "No account found for that username. Check your spelling or try your email."
      );
    }

    const { uid } = usernameSnap.data();

    // Get the email from users/{uid}
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) {
      throw new Error("Account data is incomplete. Please contact support.");
    }

    return userSnap.data().email;
  }

  /** Login with either an email or a username. */
  async function login(identifier, password) {
    const email = await resolveLoginInput(identifier);
    return signInWithEmailAndPassword(auth, email, password);
  }

  /** Send a password-reset email. Accepts email or username. */
  async function resetPassword(identifier) {
    const email = await resolveLoginInput(identifier);
    return sendPasswordResetEmail(auth, email);
  }

  async function logout() {
    return signOut(auth);
  }

  const value = {
    user,
    signup,
    login,
    claimUsername,
    resetPassword,
    logout,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
