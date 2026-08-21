import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import { alertError, alertSuccess } from "../utils/alerts";
import { uploadImage } from "../utils/uploadImage";
import {
  ImagePlus, X, Send, ChevronLeft, ChevronRight, Music,
  Volume2, VolumeX, Scissors, ArrowLeft, Check, Play, Pause,
} from "lucide-react";
import RichTextToolbar from "../components/RichTextToolbar";
import FormattedText from "../components/FormattedText";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE_MB = 10;
const MAX_IMAGES = 5;

export default function CreatePost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sliderIdx, setSliderIdx] = useState(0);
  const [uploadProgress, setUploadProgress] = useState("");
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [musicSearch, setMusicSearch] = useState("");
  const [musicTracks, setMusicTracks] = useState([]);

  // Music trim state
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [showTrim, setShowTrim] = useState(false);
  const [trimPlaying, setTrimPlaying] = useState(false);
  const [trimCurrentTime, setTrimCurrentTime] = useState(0);
  const [trimDuration, setTrimDuration] = useState(0);
  const trimAudioRef = useRef(null);

  const fileRef = useRef(null);
  const previewUrlsRef = useRef([]);
  const captionRef = useRef(null);

  // Load music from manifest
  useEffect(() => {
    fetch("/music/manifest.json")
      .then((r) => r.json())
      .then((data) => setMusicTracks(data.map((t) => ({ ...t, url: `/music/${t.file}` }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((p) => URL.revokeObjectURL(p));
      previewUrlsRef.current = [];
      document.body.style.overflow = "";
    };
  }, []);

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
      const newUrls = valid.map((f) => URL.createObjectURL(f));
      previewUrlsRef.current.push(...newUrls);
      setPreviews((prev) => [...prev, ...newUrls]);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeImage(idx) {
    URL.revokeObjectURL(previews[idx]);
    previewUrlsRef.current = previewUrlsRef.current.filter((_, i) => i !== idx);
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
    // Always reset to first image on any deletion
    setSliderIdx(0);
  }

  // ── Music trim with audio preview ──
  useEffect(() => {
    if (showTrim && selectedMusic) {
      const audio = new Audio(selectedMusic.url);
      audio.preload = "auto";
      trimAudioRef.current = audio;

      audio.addEventListener("loadedmetadata", () => {
        setTrimDuration(audio.duration);
      });

      audio.addEventListener("timeupdate", () => {
        if (!audio.duration) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        setTrimCurrentTime(pct);
        if (pct >= trimEnd) {
          audio.currentTime = (trimStart / 100) * audio.duration;
        }
      });

      audio.addEventListener("ended", () => setTrimPlaying(false));

      return () => {
        audio.pause();
        audio.src = "";
        trimAudioRef.current = null;
        setTrimPlaying(false);
        setTrimCurrentTime(0);
      };
    }
  }, [showTrim, selectedMusic]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleTrimPlay() {
    const audio = trimAudioRef.current;
    if (!audio) return;
    if (trimPlaying) {
      audio.pause();
      setTrimPlaying(false);
    } else {
      audio.currentTime = (trimStart / 100) * (trimDuration || 100);
      audio.play().catch(() => {});
      setTrimPlaying(true);
    }
  }

  function handleTrimChange(which, val) {
    const num = Number(val);
    if (which === "start") setTrimStart(Math.min(num, trimEnd - 1));
    else setTrimEnd(Math.max(num, trimStart + 1));
    const audio = trimAudioRef.current;
    if (audio && trimDuration) {
      audio.currentTime = (num / 100) * trimDuration;
    }
  }

  function formatTrimTime(pct) {
    const secs = Math.floor((pct / 100) * trimDuration);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
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

      const postData = {
        authorId: user.uid,
        authorName: user.displayName || user.email,
        imageUrls,
        imageUrl: imageUrls[0] || "",
        caption: text,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
      };

      if (selectedMusic && musicEnabled) {
        postData.musicName = selectedMusic.name;
        postData.musicArtist = selectedMusic.artist;
        postData.musicId = selectedMusic.id;
        if (trimStart > 0 || trimEnd < 100) {
          postData.musicTrimStart = trimStart;
          postData.musicTrimEnd = trimEnd;
        }
      }

      await addDoc(collection(db, "posts"), postData);

      alertSuccess("Posted!", "Your post has been shared.");
      navigate(`/profile/${user.uid}`);
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("network") || msg.includes("offline") || !navigator.onLine) {
        alertError("No internet", "You appear to be offline. Please check your connection and try again.");
      } else {
        alertError("Post failed", msg.replace("Firebase: ", "") || "Something went wrong. Please try again.");
      }
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  }

  const canSubmit = caption.trim() || files.length > 0;
  const filteredMusic = musicTracks.filter(
    (m) => m.name.toLowerCase().includes(musicSearch.toLowerCase()) || m.artist.toLowerCase().includes(musicSearch.toLowerCase())
  );

  usePageAnimations("create");

  return (
    <div className="create-post-page-root">
      {/* ── Music Trim Overlay ── */}
      {showTrim && selectedMusic && (
        <div className="trim-overlay">
          <div className="trim-header">
            <button type="button" className="btn icon-only" onClick={() => { setShowTrim(false); trimAudioRef.current?.pause(); }}>
              <X size={20} />
            </button>
            <span className="trim-title">Trim Music</span>
            <button type="button" className="btn icon-only" onClick={() => { setShowTrim(false); trimAudioRef.current?.pause(); }}>
              <Check size={20} />
            </button>
          </div>
          <div className="trim-content">
            <p className="trim-info">{selectedMusic.name} — {selectedMusic.artist}</p>
            <button type="button" className="trim-play-btn" onClick={toggleTrimPlay}>
              {trimPlaying ? <Pause size={28} /> : <Play size={28} />}
            </button>
            <div className="trim-waveform">
              <div className="trim-track-bg" />
              <div className="trim-playhead" style={{ left: `${trimCurrentTime}%` }} />
              <div className="trim-selection" style={{ left: `${trimStart}%`, width: `${trimEnd - trimStart}%` }} />
              <input type="range" min="0" max="100" value={trimStart} onChange={(e) => handleTrimChange("start", e.target.value)} className="trim-handle trim-handle-start" />
              <input type="range" min="0" max="100" value={trimEnd} onChange={(e) => handleTrimChange("end", e.target.value)} className="trim-handle trim-handle-end" />
            </div>
            <div className="trim-labels">
              <span>{formatTrimTime(trimStart)}</span>
              <span className="trim-duration">{formatTrimTime(trimEnd)}</span>
            </div>
            <p className="trim-hint">Drag handles to select the part you want</p>
          </div>
        </div>
      )}

      {/* ── Header (not sticky) ── */}
      <div className="cp-header">
        <button type="button" className="btn icon-only" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h2>New Post</h2>
        <div style={{ width: 40 }} />
      </div>

      {/* ── Scrollable content area ── */}
      <div className="cp-scroll-area">
        <form id="cp-form" className="cp-form" onSubmit={handleSubmit}>
          {/* Image Slider */}
          {previews.length > 0 && (
            <div className="cp-slider">
              <div className="cp-slider-track" style={{ transform: `translateX(-${sliderIdx * 100}%)` }}>
                {previews.map((src, idx) => (
                  <div key={idx} className="cp-slide">
                    <img src={src} alt={`Preview ${idx + 1}`} />
                    <button type="button" className="cp-remove-btn" onClick={() => removeImage(idx)}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              {previews.length > 1 && (
                <>
                  <button type="button" className="cp-nav-btn cp-nav-prev" onClick={() => setSliderIdx((i) => Math.max(0, i - 1))} disabled={sliderIdx === 0}>
                    <ChevronLeft size={18} />
                  </button>
                  <button type="button" className="cp-nav-btn cp-nav-next" onClick={() => setSliderIdx((i) => Math.min(previews.length - 1, i + 1))} disabled={sliderIdx === previews.length - 1}>
                    <ChevronRight size={18} />
                  </button>
                  <div className="cp-dots">
                    {previews.map((_, i) => (
                      <span key={i} className={`cp-dot ${i === sliderIdx ? "active" : ""}`} onClick={() => setSliderIdx(i)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Add photos button */}
          {files.length < MAX_IMAGES && (
            <button type="button" className="cp-add-btn" onClick={() => fileRef.current?.click()}>
              <ImagePlus size={18} />
              {files.length === 0 ? "Add photos" : `Add more (${files.length}/${MAX_IMAGES})`}
            </button>
          )}

          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={handleFileChange} style={{ display: "none" }} />

          {/* Caption */}
          <RichTextToolbar textareaRef={captionRef} value={caption} onChange={setCaption} />
          <textarea ref={captionRef} className="cp-caption" placeholder="Write a caption... (supports **bold**, *italic*, and more)" rows={4} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} />
          <p className="cp-count">{caption.length}/2200</p>

          {caption.trim() && (
            <div className="cp-preview-box">
              <span className="cp-preview-label">Preview</span>
              <FormattedText text={caption} />
            </div>
          )}

          {/* Music */}
          <div className="cp-music-section">
            <button type="button" className="cp-music-btn" onClick={() => setShowMusicPicker(!showMusicPicker)}>
              <Music size={16} />
              {selectedMusic ? `${selectedMusic.name} — ${selectedMusic.artist}` : "Add music"}
            </button>
            {selectedMusic && (
              <>
                <button type="button" className={`cp-music-toggle ${musicEnabled ? "active" : ""}`} onClick={() => setMusicEnabled(!musicEnabled)}>
                  {musicEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button type="button" className="cp-music-trim-btn" onClick={() => setShowTrim(true)} title="Trim music">
                  <Scissors size={16} />
                </button>
              </>
            )}
          </div>

          {/* Music Picker */}
          {showMusicPicker && (
            <div className="music-picker-overlay" onClick={() => { setShowMusicPicker(false); setMusicSearch(""); }}>
              <div className="music-picker" onClick={(e) => e.stopPropagation()}>
                <div className="music-picker-header">
                  <h3>Add Music</h3>
                  <button type="button" className="btn icon-only" onClick={() => { setShowMusicPicker(false); setMusicSearch(""); }}>
                    <X size={20} />
                  </button>
                </div>
                <input type="text" placeholder="Search music..." value={musicSearch} onChange={(e) => setMusicSearch(e.target.value)} className="music-picker-search" autoFocus />
                <div className="music-picker-list">
                  {filteredMusic.length === 0 ? (
                    <div className="music-picker-empty">
                      <Music size={24} />
                      <p>{musicTracks.length === 0 ? "No music files found. Add .mp3 to public/music/ and update manifest.json." : "No matches."}</p>
                    </div>
                  ) : filteredMusic.map((m) => (
                    <button key={m.id} type="button" className={`music-picker-item ${selectedMusic?.id === m.id ? "selected" : ""}`}
                      onClick={() => { setSelectedMusic(selectedMusic?.id === m.id ? null : m); setShowMusicPicker(false); setMusicSearch(""); setTrimStart(0); setTrimEnd(100); }}>
                      <Music size={14} />
                      <span className="music-picker-name">{m.name}</span>
                      <span className="music-picker-artist">{m.artist}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* ── Sticky Submit Bar (ALWAYS visible) ── */}
      <div className="cp-submit-bar">
        <button type="submit" className="cp-submit-btn" disabled={uploading || !canSubmit} form="cp-form">
          {uploading ? (
            <span className="setup-btn-loading"><span className="setup-btn-spinner" />{uploadProgress || "Posting..."}</span>
          ) : (<><Send size={16} />Share</>)}
        </button>
      </div>
    </div>
  );
}


