import { useState, useEffect, useRef } from "react";
import {
  collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc,
  increment, deleteDoc, serverTimestamp, getDoc, setDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { alertError } from "../utils/alerts";
import { Send, Trash2, Heart } from "lucide-react";
import FormattedText from "./FormattedText";
import RichTextToolbar from "./RichTextToolbar";

export default function InlineComments({ post }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [authorPics, setAuthorPics] = useState({});
  const [likedComments, setLikedComments] = useState({});
  const [commentLikeCounts, setCommentLikeCounts] = useState({});
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const textRef = useRef(text);
  const fetchedPicsRef = useRef(new Set());
  textRef.current = text;

  useEffect(() => {
    fetchedPicsRef.current.clear();
    const q = query(
      collection(db, "posts", post.id, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setComments(list);

      // Track like counts from comments
      const counts = {};
      list.forEach((c) => { counts[c.id] = c.likesCount || 0; });
      setCommentLikeCounts((prev) => ({ ...prev, ...counts }));

      // Batch-fetch author pics
      const uids = [...new Set(list.map((c) => c.authorId).filter(Boolean))];
      uids.forEach(async (uid) => {
        if (fetchedPicsRef.current.has(uid)) return;
        fetchedPicsRef.current.add(uid);
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

  // Subscribe to comment likes
  useEffect(() => {
    if (!comments.length || !user) return;
    const unsubs = comments.map((c) => {
      const likeId = `${user.uid}_${c.id}`;
      return onSnapshot(doc(db, "commentLikes", likeId), (snap) => {
        setLikedComments((prev) => ({ ...prev, [c.id]: snap.exists() }));
      }, () => {});
    });
    return () => unsubs.forEach((u) => u());
  }, [comments.map((c) => c.id).join(","), user]);

  useEffect(() => {
    if (comments.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments.length]);

  async function handleSend(e) {
    e.preventDefault();
    const trimmed = textRef.current.trim();
    if (!trimmed || sending) return;

    setText("");
    setSending(true);

    try {
      await addDoc(collection(db, "posts", post.id, "comments"), {
        authorId: user.uid,
        authorName: user.displayName || user.email,
        text: trimmed,
        createdAt: serverTimestamp(),
        likesCount: 0,
      });
      updateDoc(doc(db, "posts", post.id), {
        commentsCount: increment(1),
      }).catch(() => {});
    } catch (err) {
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

  async function handleLikeComment(comment) {
    const isLiked = likedComments[comment.id];
    const likeId = `${user.uid}_${comment.id}`;

    setCommentLikeCounts((prev) => ({
      ...prev,
      [comment.id]: isLiked ? Math.max(0, (prev[comment.id] || 1) - 1) : (prev[comment.id] || 0) + 1,
    }));

    try {
      if (isLiked) {
        deleteDoc(doc(db, "commentLikes", likeId));
        updateDoc(doc(db, "posts", post.id, "comments", comment.id), { likesCount: increment(-1) }).catch(() => {});
      } else {
        setDoc(doc(db, "commentLikes", likeId), { commentId: comment.id, userId: user.uid, createdAt: serverTimestamp() });
        updateDoc(doc(db, "posts", post.id, "comments", comment.id), { likesCount: increment(1) }).catch(() => {});
      }
    } catch {}
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
                {c.isGif && c.gifUrl ? (
                  <img src={c.gifUrl} alt="GIF" className="comment-gif" />
                ) : c.text ? (
                  <FormattedText text={c.text} className="comment-text" />
                ) : null}
                <div className="comment-actions">
                  <button
                    className={`comment-like-btn ${likedComments[c.id] ? "liked" : ""}`}
                    onClick={() => handleLikeComment(c)}
                  >
                    <Heart size={12} fill={likedComments[c.id] ? "var(--error)" : "none"} />
                    {(commentLikeCounts[c.id] ?? c.likesCount ?? 0) > 0 && (
                      <span>{commentLikeCounts[c.id] ?? c.likesCount}</span>
                    )}
                  </button>
                </div>
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

      <RichTextToolbar textareaRef={inputRef} value={text} onChange={setText} />
      <form className="inline-comments-form" onSubmit={handleSend}>
        <textarea
          ref={inputRef}
          placeholder="Write a comment... (supports **bold**, *italic*)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          className="inline-comment-textarea"
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
