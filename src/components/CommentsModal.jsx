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
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { alertError } from "../utils/alerts";
import { X, Send, Trash2 } from "lucide-react";

export default function CommentsModal({ post, onClose }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const q = query(
      collection(db, "posts", post.id, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [post.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  async function handleSend(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

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

      setText("");
    } catch (err) {
      alertError(
        "Failed to comment",
        err.message.replace("Firebase: ", "") || "Something went wrong."
      );
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteComment(comment) {
    try {
      await deleteDoc(doc(db, "posts", post.id, "comments", comment.id));
      await updateDoc(doc(db, "posts", post.id), {
        commentsCount: increment(-1),
      });
    } catch {
      // silent
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal comments-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="create-post-header">
          <h3>Comments</h3>
          <button type="button" className="btn icon-only" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="comments-list">
          {comments.length === 0 ? (
            <p className="comments-empty">
              No comments yet. Be the first to comment!
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="comment-item">
                <div className="comment-avatar">
                  {c.authorName?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="comment-body">
                  <span className="comment-author">{c.authorName}</span>
                  <p className="comment-text">{c.text}</p>
                </div>
                {c.authorId === user?.uid && (
                  <button
                    className="comment-delete"
                    onClick={() => handleDeleteComment(c)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <form className="comments-form" onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Write a comment..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending}
          />
          <button
            type="submit"
            className="btn icon-only comments-send"
            disabled={!text.trim() || sending}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
