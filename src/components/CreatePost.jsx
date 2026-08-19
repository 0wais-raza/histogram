import { useState, useRef, useEffect } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { alertError } from "../utils/alerts";
import { uploadImage } from "../utils/uploadImage";
import { ImagePlus, X, Send, ChevronLeft, ChevronRight } from "lucide-react";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE_MB = 10;
const MAX_IMAGES = 5;

export default function CreatePost({ onClose, onCreated }) {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sliderIdx, setSliderIdx] = useState(0);
  const [uploadProgress, setUploadProgress] = useState("");
  const fileRef = useRef(null);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function handleClose() {
    document.body.style.overflow = "";
    onClose();
  }

  function handleFileChange(e) {
    const selected = Array.from(e.target.files || []);
    const remaining = MAX_IMAGES - files.length;
    const toAdd = selected.slice(0, remaining);

    const valid = [];
    for (const f of toAdd) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        alertError("Invalid type", `${f.name} is not a supported image type.`);
        continue;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        alertError("Too large", `${f.name} must be under ${MAX_SIZE_MB} MB.`);
        continue;
      }
      valid.push(f);
    }

    if (valid.length) {
      setFiles((prev) => [...prev, ...valid]);
      setPreviews((prev) => [...prev, ...valid.map((f) => URL.createObjectURL(f))]);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeImage(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
    if (sliderIdx >= idx && sliderIdx > 0) setSliderIdx((s) => s - 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const text = caption.trim();
    if (!text && files.length === 0) {
      return alertError("Empty post", "Write something or add a photo.");
    }

    setUploading(true);

    try {
      let imageUrls = [];
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          setUploadProgress(`Uploading ${i + 1} of ${files.length}...`);
          const url = await uploadImage(files[i]);
          imageUrls.push(url);
        }
      }

      await addDoc(collection(db, "posts"), {
        authorId: user.uid,
        authorName: user.displayName || user.email,
        imageUrls,
        imageUrl: imageUrls[0] || "",
        caption: text,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });

      onCreated?.();
      handleClose();
    } catch (err) {
      alertError(
        "Post failed",
        err.message.replace("Firebase: ", "") || "Something went wrong."
      );
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  }

  const canSubmit = caption.trim() || files.length > 0;

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <form
        className="modal create-post-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="create-post-header">
          <h3>New Post</h3>
          <button type="button" className="btn icon-only" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <textarea
          className="create-post-caption"
          placeholder="What's on your mind?"
          rows={3}
          maxLength={2200}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          autoFocus
        />
        <p className="create-post-count">{caption.length}/2200</p>

        {/* Image slider preview */}
        {previews.length > 0 && (
          <div className="create-post-slider">
            <div className="create-post-slider-track" style={{ transform: `translateX(-${sliderIdx * 100}%)` }}>
              {previews.map((src, idx) => (
                <div key={idx} className="create-post-slide">
                  <img src={src} alt={`Preview ${idx + 1}`} />
                  <button type="button" className="create-post-remove" onClick={() => removeImage(idx)}>
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            {previews.length > 1 && (
              <>
                <button type="button" className="slider-btn slider-prev" onClick={() => setSliderIdx((i) => Math.max(0, i - 1))} disabled={sliderIdx === 0}>
                  <ChevronLeft size={18} />
                </button>
                <button type="button" className="slider-btn slider-next" onClick={() => setSliderIdx((i) => Math.min(previews.length - 1, i + 1))} disabled={sliderIdx === previews.length - 1}>
                  <ChevronRight size={18} />
                </button>
                <div className="slider-dots">
                  {previews.map((_, i) => (
                    <span key={i} className={`slider-dot ${i === sliderIdx ? "active" : ""}`} onClick={() => setSliderIdx(i)} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Add more images button */}
        {files.length < MAX_IMAGES && (
          <button type="button" className="create-post-add-image" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={18} />
            {files.length === 0 ? "Add photos" : `Add more (${files.length}/${MAX_IMAGES})`}
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        <button
          type="submit"
          className="btn primary create-post-submit"
          disabled={uploading || !canSubmit}
        >
          {uploading ? (
            <span className="setup-btn-loading">
              <span className="setup-btn-spinner" />
              {uploadProgress || "Posting..."}
            </span>
          ) : (
            <>
              <Send size={16} />
              Share
            </>
          )}
        </button>
      </form>
    </div>
  );
}
