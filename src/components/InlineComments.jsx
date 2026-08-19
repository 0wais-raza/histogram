import { useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  increment,
  deleteDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { alertError } from "../utils/alerts";
import { Send, Trash2 } from "lucide-react";

export default function InlineComments({ post }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [authorPics, setAuthorPics] = useState({});
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    const q = query(
      collection(db, "posts", post.id, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setComments(list);

      // Batch-fetch author pics
      const uids = [...new Set(list.map((c) => c.authorId).filter(Boolean))];
      uids.forEach(async (uid) => {
        if (authorPics[uid]) return;
        const cacheKey = `pic_${uid}`;
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            setAuthorPics((prev) => ({ ...prev, [uid]: cached }));
            return;
          }
          const s = await getDoc(doc(db, "users", uid));
          if (s.exists() && s.data().profilePic) {
            localStorage.setItem(cacheKey, s.data().profilePic);
            setAuthorPics((prev) => ({ ...prev, [uid]: s.data().profilePic }));
          }
        } catch {}
      });
    });
    return unsub;
  }, [post.id]);

  useEffect(() => {
    if (comments.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments.length]);

  async function handleSend(e) {
    e.preventDefault();
    const trimmed = textRef.current.trim();
    if (!trimmed || sending) return;

    // Clear input immediately for instant feedback
    setText("");
    setSending(true);

    try {
      await addDoc(collection(db, "posts", post.id, "comments"), {
        authorId: user.uid,
        authorName: user.displayName || user.email,
        text: trimmed,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "posts", post.id), {
        commentsCount: increment(1),
      });
    } catch (err) {
      // Restore text on error
      setText(trimmed);
      alertError(
        "Failed to comment",
        err.message.replace("Firebase: ", "") || "Something went wrong."
      );
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function handleDeleteComment(comment) {
    try {
      await deleteDoc(doc(db, "posts", post.id, "comments", comment.id));
      await updateDoc(doc(db, "posts", post.id), {
        commentsCount: increment(-1),
      });
    } catch {}
  }

  return (
    <div className="inline-comments">
      {comments.length > 0 && (
        <div className="inline-comments-list">
          {comments.slice(-5).map((c) => (
            <div key={c.id} className="comment-item">
              {authorPics[c.authorId] ? (
                <img src={authorPics[c.authorId]} alt="" className="comment-avatar-img" />
              ) : (
                <div className="comment-avatar">
                  {c.authorName?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              <div className="comment-body">
                <span className="comment-author">{c.authorName}</span>
                <p className="comment-text">{c.text}</p>
              </div>
              {c.authorId === user?.uid && (
                <button className="comment-delete" onClick={() => handleDeleteComment(c)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <form className="inline-comments-form" onSubmit={handleSend}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Write a comment..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          className="btn icon-only comments-send"
          disabled={!text.trim() || sending}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
