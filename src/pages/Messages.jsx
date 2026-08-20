import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  collection, query, limit, getDocs, doc, getDoc, where,
  addDoc, orderBy, onSnapshot, serverTimestamp, writeBatch, updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import { MessageCircle, Send, Edit, Search, ArrowLeft, Image, Smile } from "lucide-react";
import { FeedSkeleton } from "../components/LoadingSkeleton";

// GIF search powered by Tenor
const GIF_CATEGORIES = ["Trending", "Funny", "Love", "Yes", "No", "Thanks"];

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
  const [gifSearch, setGifSearch] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // Load conversations
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // Get mutual follows
        const followingSnap = await getDocs(
          query(collection(db, "follows"), where("followerId", "==", user.uid), limit(50)
        ));
        const followersSnap = await getDocs(
          query(collection(db, "follows"), where("followingId", "==", user.uid), limit(50)
        ));

        const followingUids = new Set(followingSnap.docs.map((d) => d.data().followingId));
        const followerUids = new Set(followersSnap.docs.map((d) => d.data().followerId));

        // Mutual follows are potential conversations
        const mutualUids = [...followingUids].filter((uid) => followerUids.has(uid));

        const convos = [];
        for (const uid of mutualUids.slice(0, 30)) {
          try {
            const s = await getDoc(doc(db, "users", uid));
            if (s.exists()) {
              const d = s.data();
              convos.push({ uid, username: d.username, profilePic: d.profilePic, bio: d.bio });
            }
          } catch {}
        }

        if (!cancelled) setConversations(convos);
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  // Load all users for "New Message"
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
      limit(100)
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setChatMessages(msgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }, () => {});

    return unsub;
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

  async function sendMessage(text, isGif = false) {
    if ((!text.trim() && !isGif) || !activeChat || sending) return;
    setSending(true);
    setChatInput("");
    setShowGifs(false);

    try {
      const chatId = [user.uid, activeChat.uid].sort().join("_");

      // Ensure chat doc exists
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        const batch = writeBatch(db);
        batch.set(chatRef, {
          participants: [user.uid, activeChat.uid],
          lastMessage: text || "GIF",
          lastMessageAt: serverTimestamp(),
        });
        batch.set(doc(db, "users", user.uid, "chatThreads", chatId), {
          chatId, otherUser: activeChat.uid, lastMessageAt: serverTimestamp(),
        });
        batch.set(doc(db, "users", activeChat.uid, "chatThreads", chatId), {
          chatId, otherUser: user.uid, lastMessageAt: serverTimestamp(),
        });
        await batch.commit();
      } else {
        // Update last message
        updateDoc(chatRef, { lastMessage: text || "GIF", lastMessageAt: serverTimestamp() }).catch(() => {});
      }

      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: user.uid,
        text: text || "",
        isGif,
        gifUrl: isGif ? text : "",
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      setSending(false);
      chatInputRef.current?.focus();
    }
  }

  function handleSend(e) {
    e.preventDefault();
    sendMessage(chatInput);
  }

  // Simple GIF picker (no API key needed — uses embedded URLs)
  const sampleGifs = [
    { url: "https://media.tenor.com/images/2d71f37899704c0c043b0e3f4c0e0d66/tenor.gif", label: "Wave" },
    { url: "https://media.tenor.com/images/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4/tenor.gif", label: "Hello" },
  ];

  const filteredConversations = conversations.filter(
    (c) => c.username?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = allUsers.filter(
    (u) => u.username?.toLowerCase().includes(search.toLowerCase()) || u.bio?.toLowerCase().includes(search.toLowerCase())
  );

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
            <span className="chat-header-name">@{activeChat.username}</span>
          </Link>
        </div>

        <div className="chat-messages">
          {chatMessages.length === 0 && (
            <div className="chat-empty">
              <p>Say hello to @{activeChat.username}! 👋</p>
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
                <span className="chat-bubble-time">{msg.createdAt?.seconds ? timeAgo(msg.createdAt) : ""}</span>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* GIF Picker */}
        {showGifs && (
          <div className="chat-gif-picker">
            <input
              type="text"
              placeholder="Search GIFs..."
              value={gifSearch}
              onChange={(e) => setGifSearch(e.target.value)}
              className="chat-gif-search"
              autoFocus
            />
            <div className="chat-gif-grid">
              <button className="chat-gif-item" onClick={() => sendMessage("https://media.tenor.com/iMlPK0MXgqYAAAAM/wave-hello.gif", true)}>
                <img src="https://media.tenor.com/iMlPK0MXgqYAAAAM/wave-hello.gif" alt="Wave" />
              </button>
              <button className="chat-gif-item" onClick={() => sendMessage("https://media.tenor.com/1NixIQ8tzCsAAAAM/thumbs-up-thumbsup.gif", true)}>
                <img src="https://media.tenor.com/1NixIQ8tzCsAAAAM/thumbs-up-thumbsup.gif" alt="Thumbs up" />
              </button>
              <button className="chat-gif-item" onClick={() => sendMessage("https://media.tenor.com/JJmHyMpMFJsAAAAM/love-you-heart.gif", true)}>
                <img src="https://media.tenor.com/JJmHyMpMFJsAAAAM/love-you-heart.gif" alt="Love" />
              </button>
              <button className="chat-gif-item" onClick={() => sendMessage("https://media.tenor.com/Z1JgEOBMkjEAAAAM/fire-fire-emoji.gif", true)}>
                <img src="https://media.tenor.com/Z1JgEOBMkjEAAAAM/fire-fire-emoji.gif" alt="Fire" />
              </button>
              <button className="chat-gif-item" onClick={() => sendMessage("https://media.tenor.com/TKktnMmkz5YAAAAM/laughing-lol.gif", true)}>
                <img src="https://media.tenor.com/TKktnMmkz5YAAAAM/laughing-lol.gif" alt="LOL" />
              </button>
              <button className="chat-gif-item" onClick={() => sendMessage("https://media.tenor.com/FfI0cMNYXr4AAAAM/clapping-clap.gif", true)}>
                <img src="https://media.tenor.com/FfI0cMNYXr4AAAAM/clapping-clap.gif" alt="Clap" />
              </button>
            </div>
          </div>
        )}

        <form className="chat-input-bar" onSubmit={handleSend}>
          <button type="button" className="chat-gif-btn" onClick={() => setShowGifs(!showGifs)}>
            <Image size={20} />
          </button>
          <input
            ref={chatInputRef}
            type="text"
            placeholder="Message..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="chat-text-input"
          />
          <button type="submit" className="chat-send-btn" disabled={!chatInput.trim() || sending}>
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
        </h1>
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
        <FeedSkeleton />
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
                onClick={() => setActiveChat({ uid: u.uid, username: u.username, profilePic: u.profilePic })}
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
            // Existing conversations
            filteredConversations.map((c) => (
              <button
                key={c.uid}
                className="message-item"
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
                  <span className="message-preview">Tap to start chatting</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
