import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  collection, query, limit, getDocs, doc, getDoc, getDocs as getDocs2,
  addDoc, orderBy, onSnapshot, serverTimestamp, writeBatch, updateDoc,
  where, increment, arrayUnion, arrayRemove, Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import {
  MessageCircle, Send, Search, ArrowLeft, Image, Smile,
  CheckCheck, Check, Wifi, WifiOff,
} from "lucide-react";
import { MessagesSkeleton } from "../components/LoadingSkeleton";
import { alertError } from "../utils/alerts";

// Working GIF URLs (static Tenor CDN links)
const WORKING_GIFS = [
  { url: "https://media.tenor.com/iMlPK0MXgqYAAAAM/wave-hello.gif", label: "Wave" },
  { url: "https://media.tenor.com/1NixIQ8tzCsAAAAM/thumbs-up-thumbsup.gif", label: "Thumbs Up" },
  { url: "https://media.tenor.com/JJmHyMpMFJsAAAAM/love-you-heart.gif", label: "Love" },
  { url: "https://media.tenor.com/Z1JgEOBMkjEAAAAM/fire-fire-emoji.gif", label: "Fire" },
  { url: "https://media.tenor.com/TKktnMmkz5YAAAAM/laughing-lol.gif", label: "LOL" },
  { url: "https://media.tenor.com/FfI0cMNYXr4AAAAM/clapping-clap.gif", label: "Clap" },
  { url: "https://media.tenor.com/l4HHZah5B68AAAAM/sad-crying.gif", label: "Cry" },
  { url: "https://media.tenor.com/VtIL5kMHEHcAAAAM/party-popper.gif", label: "Party" },
  { url: "https://media.tenor.com/Ck4NjbMRo24AAAAM/hi-hello.gif", label: "Hi" },
  { url: "https://media.tenor.com/nRlFnIvqPDAAAAAM/ok-spongebob.gif", label: "OK" },
  { url: "https://media.tenor.com/WWJbMKuaK-sAAAAM/emoji-flower.gif", label: "Flower" },
  { url: "https://media.tenor.com/yFpSbBaWqLUAAAAM/kiss-heart.gif", label: "Kiss" },
];

function timeAgo(ts) {
  if (!ts?.seconds) return "";
  const diff = Date.now() - ts.seconds * 1000;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + "m";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h";
  return Math.floor(hrs / 24) + "d";
}

// Friendlier error messages
function friendlyError(err) {
  const msg = err?.message || String(err);
  if (msg.includes("network") || msg.includes("offline") || msg.includes("Failed to fetch"))
    return "No internet connection. Check your network and try again.";
  if (msg.includes("permission-denied"))
    return "You don't have permission to do that.";
  if (msg.includes("unavailable"))
    return "Service temporarily unavailable. Please try again.";
  return "Something went wrong. Please try again.";
}

export default function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeChat, setActiveChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showGifs, setShowGifs] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [networkOnline, setNetworkOnline] = useState(navigator.onLine);
  const [isTyping, setIsTyping] = useState({});
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Network status
  useEffect(() => {
    const onOnline = () => setNetworkOnline(true);
    const onOffline = () => setNetworkOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Load conversations in REALTIME via chatThreads subcollection
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    // First, also get mutual follows so we can show them
    async function loadMutualsAndSubscribe() {
      setLoading(true);
      try {
        // Get mutual follows
        const followingSnap = await getDocs(
          query(collection(db, "follows"), where("followerId", "==", user.uid), limit(50))
        );
        const followersSnap = await getDocs(
          query(collection(db, "follows"), where("followingId", "==", user.uid), limit(50))
        );

        const followingUids = new Set(followingSnap.docs.map((d) => d.data().followingId));
        const followerUids = new Set(followersSnap.docs.map((d) => d.data().followerId));
        const mutualUids = [...followingUids].filter((uid) => followerUids.has(uid));

        // Fetch user data for mutuals
        const userDataMap = {};
        for (const uid of mutualUids.slice(0, 30)) {
          try {
            const s = await getDoc(doc(db, "users", uid));
            if (s.exists()) {
              const d = s.data();
              userDataMap[uid] = { uid, username: d.username, profilePic: d.profilePic, bio: d.bio };
            }
          } catch {}
        }

        if (cancelled) return;

        // Now subscribe to user's chat threads in realtime
        const threadsRef = collection(db, "users", user.uid, "chatThreads");
        const threadsQ = query(threadsRef, orderBy("lastMessageAt", "desc"));

        const unsub = onSnapshot(threadsQ, async (threadsSnap) => {
          if (cancelled) return;

          const threadConvo = [];
          const unread = {};

          for (const threadDoc of threadsSnap.docs) {
            const threadData = threadDoc.data();
            const chatId = threadDoc.id;
            const otherUid = threadData.otherUser;
            const lastMsg = threadData.lastMessage || "";
            const lastMsgAt = threadData.lastMessageAt;
            const unreadCount = threadData.unreadCount || 0;

            // Get user data from cache or our loaded mutuals
            let userData = userDataMap[otherUid];
            if (!userData) {
              try {
                const s = await getDoc(doc(db, "users", otherUid));
                if (s.exists()) {
                  const d = s.data();
                  userData = { uid: otherUid, username: d.username, profilePic: d.profilePic, bio: d.bio };
                }
              } catch {}
            }

            if (userData) {
              threadConvo.push({
                ...userData,
                chatId,
                lastMessage: lastMsg,
                lastMessageAt: lastMsgAt,
                unreadCount,
              });
              if (unreadCount > 0) {
                unread[chatId] = unreadCount;
              }
            }
          }

          // Also add mutuals who don't have threads yet
          for (const [uid, data] of Object.entries(userDataMap)) {
            if (!threadConvo.find((c) => c.uid === uid)) {
              threadConvo.push({
                ...data,
                chatId: null,
                lastMessage: "",
                lastMessageAt: null,
                unreadCount: 0,
              });
            }
          }

          setConversations(threadConvo);
          setUnreadCounts(unread);
          setLoading(false);
        }, (err) => {
          console.error("Chat threads listener error:", err);
          if (!cancelled) setLoading(false);
        });

        return unsub;
      } catch (err) {
        console.error("Failed to load conversations:", err);
        if (!cancelled) setLoading(false);
      }
    }

    let unsubPromise = loadMutualsAndSubscribe();
    return () => {
      cancelled = true;
      unsubPromise.then((unsub) => unsub?.());
    };
  }, [user]);

  // Load all users for search/new message
  useEffect(() => {
    if (!user) return;
    async function loadUsers() {
      try {
        const snap = await getDocs(query(collection(db, "users"), limit(100)));
        const users = snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((u) => u.uid !== user.uid && u.username);
        setAllUsers(users);
      } catch {}
    }
    loadUsers();
  }, [user]);

  // Real-time messages when chat is active
  useEffect(() => {
    if (!activeChat || !user) return;
    const chatId = [user.uid, activeChat.uid].sort().join("_");
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc"),
      limit(200)
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setChatMessages(msgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }, (err) => {
      console.error("Messages listener error:", err);
    });

    return unsub;
  }, [activeChat?.uid, user]);

  // Mark messages as read when opening chat
  useEffect(() => {
    if (!activeChat || !user) return;
    const chatId = [user.uid, activeChat.uid].sort().join("_");
    const threadRef = doc(db, "users", user.uid, "chatThreads", chatId);

    // Reset unread count
    getDoc(threadRef).then((snap) => {
      if (snap.exists() && (snap.data().unreadCount || 0) > 0) {
        updateDoc(threadRef, { unreadCount: 0 }).catch(() => {});
      }
    }).catch(() => {});

    setUnreadCounts((prev) => ({ ...prev, [chatId]: 0 }));
  }, [activeChat?.uid, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  // Lock scroll when chat open
  useEffect(() => {
    if (activeChat) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [activeChat]);

  // Typing indicator handler
  const handleTyping = useCallback(() => {
    if (!activeChat || !user) return;
    const chatId = [user.uid, activeChat.uid].sort().join("_");
    const typingRef = doc(db, "chats", chatId);

    updateDoc(typingRef, {
      [`typing.${user.uid}`]: serverTimestamp(),
    }).catch(() => {});

    // Clear after 3 seconds of no typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      updateDoc(typingRef, {
        [`typing.${user.uid}`]: null,
      }).catch(() => {});
    }, 3000);
  }, [activeChat?.uid, user]);

  // Listen for other user typing
  useEffect(() => {
    if (!activeChat || !user) return;
    const chatId = [user.uid, activeChat.uid].sort().join("_");
    const chatRef = doc(db, "chats", chatId);

    const unsub = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const typing = data.typing || {};
      const otherTyping = typing[activeChat.uid];
      if (otherTyping?.seconds) {
        const diff = Date.now() - otherTyping.seconds * 1000;
        setIsTyping((prev) => ({ ...prev, [activeChat.uid]: diff < 5000 }));
      } else {
        setIsTyping((prev) => ({ ...prev, [activeChat.uid]: false }));
      }
    }, () => {});

    return unsub;
  }, [activeChat?.uid, user]);

  async function sendMessage(text, isGif = false) {
    if ((!text.trim() && !isGif) || !activeChat || sending) return;
    if (!networkOnline) {
      alertError("No internet", "You appear to be offline. Please check your connection and try again.");
      return;
    }

    setSending(true);
    setChatInput("");
    setShowGifs(false);

    try {
      const chatId = [user.uid, activeChat.uid].sort().join("_");
      const batch = writeBatch(db);

      // Ensure chat doc exists
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        batch.set(chatRef, {
          participants: [user.uid, activeChat.uid],
          lastMessage: text || "GIF",
          lastMessageAt: serverTimestamp(),
          typing: {},
        });
        batch.set(doc(db, "users", user.uid, "chatThreads", chatId), {
          chatId, otherUser: activeChat.uid, lastMessageAt: serverTimestamp(),
          lastMessage: text || "GIF", unreadCount: 0,
        });
        batch.set(doc(db, "users", activeChat.uid, "chatThreads", chatId), {
          chatId, otherUser: user.uid, lastMessageAt: serverTimestamp(),
          lastMessage: text || "GIF", unreadCount: 1,
        });
      } else {
        // Update last message on chat doc
        batch.update(chatRef, { lastMessage: text || "GIF", lastMessageAt: serverTimestamp() });
        // Update sender's thread
        batch.set(doc(db, "users", user.uid, "chatThreads", chatId), {
          lastMessage: text || "GIF", lastMessageAt: serverTimestamp(), unreadCount: 0,
        }, { merge: true });
        // Update receiver's thread (increment unread)
        batch.set(doc(db, "users", activeChat.uid, "chatThreads", chatId), {
          lastMessage: text || "GIF", lastMessageAt: serverTimestamp(),
          unreadCount: increment(1),
        }, { merge: true });
      }

      await batch.commit();

      // Add message doc
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: user.uid,
        text: text || "",
        isGif,
        gifUrl: isGif ? text : "",
        createdAt: serverTimestamp(),
        read: false,
      });
    } catch (err) {
      console.error("Send failed:", err);
      alertError("Message not sent", friendlyError(err));
    } finally {
      setSending(false);
      chatInputRef.current?.focus();
    }
  }

  function handleSend(e) {
    e.preventDefault();
    sendMessage(chatInput);
  }

  const filteredConversations = conversations.filter(
    (c) => c.username?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = allUsers.filter(
    (u) => u.username?.toLowerCase().includes(search.toLowerCase()) || u.bio?.toLowerCase().includes(search.toLowerCase())
  );

  // Total unread count for sidebar badge
  const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);

  usePageAnimations("home");

  // ── Chat View ──
  if (activeChat) {
    return (
      <div className="chat-view">
        <div className="chat-header">
          <button className="btn icon-only" onClick={() => setActiveChat(null)}>
            <ArrowLeft size={20} />
          </button>
          <Link to={`/profile/${activeChat.uid}`} className="chat-header-user">
            {activeChat.profilePic ? (
              <img src={activeChat.profilePic} alt="" className="chat-header-avatar" />
            ) : (
              <div className="chat-header-avatar chat-avatar-fallback">
                {activeChat.username?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div>
              <span className="chat-header-name">@{activeChat.username}</span>
              {isTyping[activeChat.uid] && (
                <span className="chat-typing-indicator">typing...</span>
              )}
            </div>
          </Link>
        </div>

        <div className="chat-messages">
          {chatMessages.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-content">
                <p>Say hello to @{activeChat.username}! 👋</p>
                <p className="chat-empty-hint">Messages are end-to-end encrypted</p>
              </div>
            </div>
          )}
          {chatMessages.map((msg) => {
            const isMine = msg.senderId === user.uid;
            return (
              <div key={msg.id} className={`chat-bubble ${isMine ? "chat-bubble-mine" : "chat-bubble-theirs"}`}>
                {msg.isGif ? (
                  <img src={msg.gifUrl} alt="GIF" className="chat-gif" />
                ) : (
                  <p>{msg.text}</p>
                )}
                <span className="chat-bubble-time">
                  {msg.createdAt?.seconds ? timeAgo(msg.createdAt) : ""}
                  {isMine && (
                    <span className="chat-read-indicator">
                      {msg.read ? <CheckCheck size={14} /> : <Check size={14} />}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* GIF Picker */}
        {showGifs && (
          <div className="chat-gif-picker">
            <div className="chat-gif-grid">
              {WORKING_GIFS.map((gif, i) => (
                <button key={i} className="chat-gif-item" onClick={() => sendMessage(gif.url, true)}>
                  <img src={gif.url} alt={gif.label} loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Network warning */}
        {!networkOnline && (
          <div className="chat-offline-bar">
            <WifiOff size={14} /> You're offline. Messages will send when you reconnect.
          </div>
        )}

        <form className="chat-input-bar" onSubmit={handleSend}>
          <button type="button" className="chat-gif-btn" onClick={() => setShowGifs(!showGifs)}>
            <Image size={20} />
          </button>
          <input
            ref={chatInputRef}
            type="text"
            placeholder={networkOnline ? "Message..." : "Offline..."}
            value={chatInput}
            onChange={(e) => { setChatInput(e.target.value); handleTyping(); }}
            className="chat-text-input"
            disabled={!networkOnline}
          />
          <button type="submit" className="chat-send-btn" disabled={!chatInput.trim() || sending || !networkOnline}>
            <Send size={18} />
          </button>
        </form>
      </div>
    );
  }

  // ── Conversations List ──
  return (
    <div className="page page-enter">
      <div className="home-header">
        <h1 className="home-title">
          <MessageCircle size={24} /> <span className="neon-text">Messages</span>
          {totalUnread > 0 && <span className="messages-total-badge">{totalUnread > 99 ? "99+" : totalUnread}</span>}
        </h1>
        {!networkOnline && (
          <span className="messages-offline-indicator"><WifiOff size={16} /> Offline</span>
        )}
      </div>

      <div className="search-bar">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <MessagesSkeleton />
      ) : filteredConversations.length === 0 && !search ? (
        <div className="home-empty">
          <Send size={40} strokeWidth={1.5} />
          <p>No messages yet. Follow people to start chatting!</p>
        </div>
      ) : (
        <div className="messages-list">
          {search ? (
            // Show search results for new messages
            filteredUsers.map((u) => (
              <button
                key={u.uid}
                className="message-item"
                onClick={() => {
                  setActiveChat({ uid: u.uid, username: u.username, profilePic: u.profilePic });
                  setSearch("");
                }}
              >
                {u.profilePic ? (
                  <img src={u.profilePic} alt="" className="message-avatar" />
                ) : (
                  <div className="message-avatar message-avatar-fallback">
                    {u.username?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <div className="message-info">
                  <span className="message-username">@{u.username}</span>
                  <span className="message-preview">{u.bio || "Start a conversation"}</span>
                </div>
              </button>
            ))
          ) : (
            // Existing conversations with last message + unread badge
            filteredConversations.map((c) => (
              <button
                key={c.uid}
                className={`message-item ${unreadCounts[c.chatId] > 0 ? "message-item-unread" : ""}`}
                onClick={() => setActiveChat(c)}
              >
                {c.profilePic ? (
                  <img src={c.profilePic} alt="" className="message-avatar" />
                ) : (
                  <div className="message-avatar message-avatar-fallback">
                    {c.username?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <div className="message-info">
                  <span className="message-username">@{c.username}</span>
                  <span className={`message-preview ${unreadCounts[c.chatId] > 0 ? "message-preview-unread" : ""}`}>
                    {c.lastMessage || "Tap to start chatting"}
                  </span>
                </div>
                <div className="message-meta">
                  {c.lastMessageAt && (
                    <span className="message-time">{timeAgo(c.lastMessageAt)}</span>
                  )}
                  {unreadCounts[c.chatId] > 0 && (
                    <span className="message-unread-badge">{unreadCounts[c.chatId]}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
