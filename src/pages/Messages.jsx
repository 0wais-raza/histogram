import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  collection, query, limit, getDocs, doc, getDoc,
  addDoc, orderBy, onSnapshot, serverTimestamp, writeBatch, updateDoc,
  where, increment,
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
  const location = useLocation();
  const startChatData = location.state?.startChat;
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
  const [pendingIds, setPendingIds] = useState(new Set());
  const [failedIds, setFailedIds] = useState(new Set());
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

  // Auto-start chat when navigated from Profile's Message button
  useEffect(() => {
    if (startChatData?.uid && startChatData?.username) {
      setActiveChat({
        uid: startChatData.uid,
        username: startChatData.username,
        profilePic: startChatData.profilePic || "",
      });
      // Clear the state so it doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load conversations: show ALL followed users (not just mutuals)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadAndSubscribe() {
      setLoading(true);
      try {
        // Get all users this user follows
        const followingSnap = await getDocs(
          query(collection(db, "follows"), where("followerId", "==", user.uid), limit(100))
        );
        const followingUids = followingSnap.docs.map((d) => d.data().followingId);

        // Also get users who follow this user (for completeness)
        const followersSnap = await getDocs(
          query(collection(db, "follows"), where("followingId", "==", user.uid), limit(100))
        );
        const followerUids = followersSnap.docs.map((d) => d.data().followerId);

        // Combine: all followed users + followers (for messaging)
        const allUids = [...new Set([...followingUids, ...followerUids])];

        // Fetch user data for all contacts
        const userDataMap = {};
        for (const uid of allUids.slice(0, 50)) {
          if (uid === user.uid) continue;
          try {
            const s = await getDoc(doc(db, "users", uid));
            if (s.exists()) {
              const d = s.data();
              if (d.username) {
                userDataMap[uid] = { uid, username: d.username, profilePic: d.profilePic, bio: d.bio };
              }
            }
          } catch {}
        }

        if (cancelled) return;

        // Subscribe to user's chat threads in realtime
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

            // Get user data from cache or our loaded contacts
            let userData = userDataMap[otherUid];
            if (!userData) {
              try {
                const s = await getDoc(doc(db, "users", otherUid));
                if (s.exists()) {
                  const d = s.data();
                  if (d.username) {
                    userData = { uid: otherUid, username: d.username, profilePic: d.profilePic, bio: d.bio };
                  }
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

          // Also add followed users who don't have threads yet (so they can start chatting)
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

    let unsubPromise = loadAndSubscribe();
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
    setChatMessages([]);
    setPendingIds(new Set());
    setFailedIds(new Set());
    const chatId = [user.uid, activeChat.uid].sort().join("_");
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc"),
      limit(200)
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setChatMessages(msgs);
      // Clear pending states for messages that now exist in Firestore
      setPendingIds((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set();
        for (const pid of prev) {
          const stillPending = !msgs.some((m) => m.text === pid.split("||")[1] && m.senderId === user.uid);
          if (stillPending) next.add(pid);
        }
        return next;
      });
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

    // Generate a temporary ID for optimistic UI
    const tempId = "temp_" + Date.now() + "||" + (text || "gif");

    // Optimistic: add message to UI instantly
    const optimisticMsg = {
      id: tempId,
      senderId: user.uid,
      text: text || "",
      isGif,
      gifUrl: isGif ? text : "",
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
      read: false,
      pending: true,
    };
    setChatMessages((prev) => [...prev, optimisticMsg]);
    setPendingIds((prev) => new Set([...prev, tempId]));
    setChatInput("");
    setShowGifs(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const chatId = [user.uid, activeChat.uid].sort().join("_");
      const batch = writeBatch(db);

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
        batch.update(chatRef, { lastMessage: text || "GIF", lastMessageAt: serverTimestamp() });
        batch.set(doc(db, "users", user.uid, "chatThreads", chatId), {
          lastMessage: text || "GIF", lastMessageAt: serverTimestamp(), unreadCount: 0,
        }, { merge: true });
        batch.set(doc(db, "users", activeChat.uid, "chatThreads", chatId), {
          lastMessage: text || "GIF", lastMessageAt: serverTimestamp(), unreadCount: increment(1),
        }, { merge: true });
      }

      await batch.commit();

      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: user.uid,
        text: text || "",
        isGif,
        gifUrl: isGif ? text : "",
        createdAt: serverTimestamp(),
        read: false,
      });

      // Success — remove from pending (onSnapshot will add the real message)
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
    } catch (err) {
      console.error("Send failed:", err);
      // Mark as failed
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
      setFailedIds((prev) => new Set([...prev, tempId]));
      alertError("Message failed", friendlyError(err));
    } finally {
      chatInputRef.current?.focus();
    }
  }

  async function retryMessage(failedTempId, text, isGif) {
    setFailedIds((prev) => {
      const next = new Set(prev);
      next.delete(failedTempId);
      return next;
    });
    setPendingIds((prev) => new Set([...prev, failedTempId]));
    setChatMessages((prev) =>
      prev.map((m) => m.id === failedTempId ? { ...m, pending: true } : m)
    );
    try {
      const chatId = [user.uid, activeChat.uid].sort().join("_");
      const batch = writeBatch(db);
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        batch.set(chatRef, { participants: [user.uid, activeChat.uid], lastMessage: text || "GIF", lastMessageAt: serverTimestamp(), typing: {} });
        batch.set(doc(db, "users", user.uid, "chatThreads", chatId), { chatId, otherUser: activeChat.uid, lastMessageAt: serverTimestamp(), lastMessage: text || "GIF", unreadCount: 0 });
        batch.set(doc(db, "users", activeChat.uid, "chatThreads", chatId), { chatId, otherUser: user.uid, lastMessageAt: serverTimestamp(), lastMessage: text || "GIF", unreadCount: 1 });
      } else {
        batch.update(chatRef, { lastMessage: text || "GIF", lastMessageAt: serverTimestamp() });
        batch.set(doc(db, "users", user.uid, "chatThreads", chatId), { lastMessage: text || "GIF", lastMessageAt: serverTimestamp(), unreadCount: 0 }, { merge: true });
        batch.set(doc(db, "users", activeChat.uid, "chatThreads", chatId), { lastMessage: text || "GIF", lastMessageAt: serverTimestamp(), unreadCount: increment(1) }, { merge: true });
      }
      await batch.commit();
      await addDoc(collection(db, "chats", chatId, "messages"), { senderId: user.uid, text: text || "", isGif, gifUrl: isGif ? text : "", createdAt: serverTimestamp(), read: false });
      setPendingIds((prev) => { const next = new Set(prev); next.delete(failedTempId); return next; });
    } catch (err) {
      setPendingIds((prev) => { const next = new Set(prev); next.delete(failedTempId); return next; });
      setFailedIds((prev) => new Set([...prev, failedTempId]));
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

  const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);

  usePageAnimations("messages");

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
            const isPending = msg.pending || pendingIds.has(msg.id);
            const isFailed = failedIds.has(msg.id);
            return (
              <div key={msg.id} className={`chat-bubble ${isMine ? "chat-bubble-mine" : "chat-bubble-theirs"} ${isPending ? "chat-bubble-pending" : ""} ${isFailed ? "chat-bubble-failed" : ""}`}>
                {msg.isGif ? (
                  <img src={msg.gifUrl} alt="GIF" className="chat-gif" loading="lazy" />
                ) : msg.sharePreview ? (
                  <a href={msg.sharePreview.postUrl} target="_blank" rel="noopener noreferrer" className="chat-share-card">
                    {msg.sharePreview.imageUrl && (
                      <img src={msg.sharePreview.imageUrl} alt="" className="chat-share-card-img" />
                    )}
                    <div className="chat-share-card-body">
                      <span className="chat-share-card-label">📷 Post</span>
                      <span className="chat-share-card-author">{msg.sharePreview.authorName}</span>
                      {msg.sharePreview.caption && <span className="chat-share-card-caption">{msg.sharePreview.caption}</span>}
                    </div>
                  </a>
                ) : (
                  <p>{msg.text}</p>
                )}
                <span className="chat-bubble-time">
                  {isFailed ? (
                    <span className="chat-fail-indicator">
                      <span className="chat-fail-text">Failed</span>
                      <button className="chat-retry-btn" onClick={() => retryMessage(msg.id, msg.text, msg.isGif)} title="Retry">
                        ↻
                      </button>
                    </span>
                  ) : isPending ? (
                    <span className="chat-pending-dots">sending...</span>
                  ) : (
                    <>
                      {msg.createdAt?.seconds ? timeAgo(msg.createdAt) : ""}
                      {isMine && (
                        <span className="chat-read-indicator">
                          {msg.read ? <CheckCheck size={14} /> : <Check size={14} />}
                        </span>
                      )}
                    </>
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
          <p>No conversations yet. Follow people to start chatting!</p>
        </div>
      ) : (
        <div className="messages-list">
          {search ? (
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
