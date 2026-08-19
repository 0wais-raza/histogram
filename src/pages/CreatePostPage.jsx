import { useState, useRef, useEffect, useCallback } from "react";
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
  Volume2, VolumeX, Crop, Scissors, ArrowLeft, Check, ZoomIn, ZoomOut, Play, Pause,
} from "lucide-react";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE_MB = 10;
const MAX_IMAGES = 5;

// Crop an image File using canvas, returns a new File
function cropImageFile(file, cropData, aspect) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      let cropW, cropH;
      const vw = window.innerWidth * 0.9;
      const vh = window.innerHeight * 0.6;

      if (aspect === "1:1") {
        const s = Math.min(vw, vh);
        cropW = cropW = (s / cropData.scale) * (img.naturalWidth / vw);
        cropH = cropW;
      } else if (aspect === "4:5") {
        cropW = (vw / cropData.scale) * (img.naturalWidth / vw);
        cropH = cropW * (5 / 4);
      } else if (aspect === "16:9") {
        cropW = (vw / cropData.scale) * (img.naturalWidth / vw);
        cropH = cropW * (9 / 16);
      } else {
        // Free: use the full image
        cropW = img.naturalWidth / cropData.scale;
        cropH = img.naturalHeight / cropData.scale;
      }

      // Clamp to image bounds
      cropW = Math.min(cropW, img.naturalWidth);
      cropH = Math.min(cropH, img.naturalHeight);

      // Calculate source crop region (centered with offset)
      const sx = Math.max(0, (img.naturalWidth - cropW) / 2 - (cropData.x / cropData.scale) * (img.naturalWidth / vw));
      const sy = Math.max(0, (img.naturalHeight - cropH) / 2 - (cropData.y / cropData.scale) * (img.naturalHeight / vh));

      canvas.width = cropW;
      canvas.height = cropH;
      ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
        } else {
          resolve(file);
        }
      }, "image/jpeg", 0.92);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

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

  // Crop state — store per image
  const [cropIndex, setCropIndex] = useState(null);
  const [cropData, setCropData] = useState({ x: 0, y: 0, scale: 1 });
  const [cropAspect, setCropAspect] = useState("free");
  const [cropStates, setCropStates] = useState({}); // { [idx]: { x, y, scale, aspect } }
  const cropDragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  // Music trim state
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [showTrim, setShowTrim] = useState(false);
  const [trimPlaying, setTrimPlaying] = useState(false);
  const [trimCurrentTime, setTrimCurrentTime] = useState(0);
  const [trimDuration, setTrimDuration] = useState(0);
  const trimAudioRef = useRef(null);

  const fileRef = useRef(null);

  // Load music from manifest
  useEffect(() => {
    fetch("/music/manifest.json")
      .then((r) => r.json())
      .then((data) => setMusicTracks(data.map((t) => ({ ...t, url: `/music/${t.file}` }))))
      .catch(() => {});
  }, []);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
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
      setPreviews((prev) => [...prev, ...valid.map((f) => URL.createObjectURL(f))]);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeImage(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
    // Shift crop states
    setCropStates((prev) => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki < idx) next[ki] = v;
        else if (ki > idx) next[ki - 1] = v;
      });
      return next;
    });
    if (sliderIdx >= idx && sliderIdx > 0) setSliderIdx((s) => s - 1);
  }

  // ── Crop handlers ──
  function openCrop(idx) {
    setCropIndex(idx);
    const existing = cropStates[idx];
    setCropData(existing ? { x: existing.x, y: existing.y, scale: existing.scale } : { x: 0, y: 0, scale: 1 });
    setCropAspect(existing?.aspect || "free");
  }

  function handleCropMouseDown(e) {
    e.preventDefault();
    cropDragRef.current = {
      dragging: true,
      startX: e.clientX || e.touches?.[0]?.clientX || 0,
      startY: e.clientY || e.touches?.[0]?.clientY || 0,
      origX: cropData.x,
      origY: cropData.y,
    };
  }

  const handleCropMouseMove = useCallback((e) => {
    if (!cropDragRef.current.dragging) return;
    const cx = e.clientX || e.touches?.[0]?.clientX || 0;
    const cy = e.clientY || e.touches?.[0]?.clientY || 0;
    const dx = cx - cropDragRef.current.startX;
    const dy = cy - cropDragRef.current.startY;
    setCropData((prev) => ({ ...prev, x: cropDragRef.current.origX + dx, y: cropDragRef.current.origY + dy }));
  }, []);

  const handleCropMouseUp = useCallback(() => {
    cropDragRef.current.dragging = false;
  }, []);

  useEffect(() => {
    if (cropIndex !== null) {
      window.addEventListener("mousemove", handleCropMouseMove);
      window.addEventListener("mouseup", handleCropMouseUp);
      window.addEventListener("touchmove", handleCropMouseMove, { passive: false });
      window.addEventListener("touchend", handleCropMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleCropMouseMove);
        window.removeEventListener("mouseup", handleCropMouseUp);
        window.removeEventListener("touchmove", handleCropMouseMove);
        window.removeEventListener("touchend", handleCropMouseUp);
      };
    }
  }, [cropIndex, handleCropMouseMove, handleCropMouseUp]);

  function applyCrop() {
    // Save crop state for this image
    setCropStates((prev) => ({
      ...prev,
      [cropIndex]: { ...cropData, aspect: cropAspect },
    }));
    setCropIndex(null);
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
          // Apply crop if this image was cropped
          let fileToUpload = files[i];
          if (cropStates[i]) {
            fileToUpload = await cropImageFile(files[i], cropStates[i], cropStates[i].aspect);
          }
          const url = await uploadImage(fileToUpload);
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
      alertError("Post failed", err.message.replace("Firebase: ", "") || "Something went wrong.");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  }

  const canSubmit = caption.trim() || files.length > 0;
  const filteredMusic = musicTracks.filter(
    (m) => m.name.toLowerCase().includes(musicSearch.toLowerCase()) || m.artist.toLowerCase().includes(musicSearch.toLowerCase())
  );

  usePageAnimations("home");

  return (
    <div className="page page-enter create-post-page">
      {/* ── Crop Overlay ── */}
      {cropIndex !== null && (
        <div className="crop-overlay">
          <div className="crop-header">
            <button type="button" className="btn icon-only" onClick={() => setCropIndex(null)}>
              <X size={20} />
            </button>
            <span className="crop-title">Crop</span>
            <button type="button" className="btn icon-only crop-check" onClick={applyCrop}>
              <Check size={20} />
            </button>
          </div>

          <div className="crop-viewport">
            <div
              className="crop-image-wrapper"
              onMouseDown={handleCropMouseDown}
              onTouchStart={handleCropMouseDown}
              style={{ transform: `translate(${cropData.x}px, ${cropData.y}px) scale(${cropData.scale})` }}
            >
              <img src={previews[cropIndex]} alt="" className="crop-image" draggable={false} />
            </div>
            <div className={`crop-frame crop-frame-${cropAspect}`} />
          </div>

          <div className="crop-tools">
            {["free", "1:1", "4:5", "16:9"].map((a) => (
              <button
                key={a}
                type="button"
                className={`crop-aspect-btn ${cropAspect === a ? "active" : ""}`}
                onClick={() => { setCropAspect(a); setCropData({ x: 0, y: 0, scale: a === "free" ? 1 : a === "16:9" ? 1.3 : 1.15 }); }}
              >
                {a === "free" ? "Free" : a}
              </button>
            ))}
          </div>

          <div className="crop-zoom-bar">
            <ZoomOut size={16} />
            <input
              type="range"
              min="50"
              max="300"
              value={Math.round(cropData.scale * 100)}
              onChange={(e) => setCropData((p) => ({ ...p, scale: Number(e.target.value) / 100 }))}
              className="crop-zoom-slider"
            />
            <ZoomIn size={16} />
          </div>
        </div>
      )}

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

      {/* ── Main Create Post UI ── */}
      <div className="create-post-page-header">
        <button type="button" className="btn icon-only" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h2>New Post</h2>
        <div style={{ width: 40 }} />
      </div>

      <form className="create-post-form" onSubmit={handleSubmit}>
        {previews.length > 0 && (
          <div className="create-post-slider">
            <div className="create-post-slider-track" style={{ transform: `translateX(-${sliderIdx * 100}%)` }}>
              {previews.map((src, idx) => (
                <div key={idx} className="create-post-slide">
                  <img src={src} alt={`Preview ${idx + 1}`} />
                  {cropStates[idx] && <div className="create-post-cropped-badge"><Crop size={12} /> Cropped</div>}
                  <button type="button" className="create-post-remove" onClick={() => removeImage(idx)}>
                    <X size={16} />
                  </button>
                  <button type="button" className="create-post-crop-btn" onClick={() => openCrop(idx)} title="Crop">
                    <Crop size={16} />
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

        {files.length < MAX_IMAGES && (
          <button type="button" className="create-post-add-image" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={18} />
            {files.length === 0 ? "Add photos" : `Add more (${files.length}/${MAX_IMAGES})`}
          </button>
        )}

        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={handleFileChange} style={{ display: "none" }} />

        <textarea className="create-post-caption" placeholder="Write a caption..." rows={4} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} />
        <p className="create-post-count">{caption.length}/2200</p>

        <div className="create-post-music-section">
          <button type="button" className="create-post-music-btn" onClick={() => setShowMusicPicker(!showMusicPicker)}>
            <Music size={16} />
            {selectedMusic ? `${selectedMusic.name} — ${selectedMusic.artist}` : "Add music"}
          </button>
          {selectedMusic && (
            <>
              <button type="button" className={`create-post-music-toggle ${musicEnabled ? "active" : ""}`} onClick={() => setMusicEnabled(!musicEnabled)}>
                {musicEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <button type="button" className="create-post-music-trim-btn" onClick={() => setShowTrim(true)} title="Trim music">
                <Scissors size={16} />
              </button>
            </>
          )}
        </div>

        {showMusicPicker && (
          <div className="music-picker">
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
        )}

        <button type="submit" className="btn primary create-post-submit" disabled={uploading || !canSubmit}>
          {uploading ? (
            <span className="setup-btn-loading"><span className="setup-btn-spinner" />{uploadProgress || "Posting..."}</span>
          ) : (<><Send size={16} />Share</>)}
        </button>
      </form>
    </div>
  );
}
