import { useState, useRef, useEffect, useCallback } from "react";
import { usePageAnimations } from "../animations";
import { Music as MusicIcon, Play, Pause, Search, Disc, Volume2, VolumeX } from "lucide-react";

export default function Music() {
  const [search, setSearch] = useState("");
  const [activeGenre, setActiveGenre] = useState("All");
  const [playing, setPlaying] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef(null);

  // Load manifest
  useEffect(() => {
    fetch("/music/manifest.json")
      .then((r) => r.json())
      .then((data) => {
        setTracks(data.map((t) => ({ ...t, url: `/music/${t.file}` })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function onTimeUpdate() {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    }
    function onLoadedMetadata() {
      setDuration(audio.duration);
    }
    function onEnded() {
      setPlaying(null);
      setProgress(0);
    }

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  // Play/pause handler
  const togglePlay = useCallback((track) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing === track.id) {
      audio.pause();
      setPlaying(null);
    } else {
      audio.src = track.url;
      audio.play().catch(() => {});
      setPlaying(track.id);
    }
  }, [playing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const GENRES = ["All", ...new Set(tracks.map((t) => t.genre))];

  const filtered = tracks.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.artist.toLowerCase().includes(search.toLowerCase());
    const matchesGenre = activeGenre === "All" || m.genre === activeGenre;
    return matchesSearch && matchesGenre;
  });

  function formatTime(s) {
    if (!s) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  usePageAnimations("home");

  return (
    <div className="page page-enter">
      <audio ref={audioRef} preload="auto" />

      <div className="home-header">
        <h1 className="home-title">
          <MusicIcon size={24} /> <span className="neon-text">Music</span>
        </h1>
      </div>

      <div className="search-bar">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Search music..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {GENRES.length > 1 && (
        <div className="music-genres">
          {GENRES.map((g) => (
            <button
              key={g}
              className={`music-genre-btn ${activeGenre === g ? "active" : ""}`}
              onClick={() => setActiveGenre(g)}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Now Playing Bar */}
      {playing && (
        <div className="music-now-playing">
          <div className="music-now-progress" style={{ width: `${progress * 100}%` }} />
          <div className="music-now-inner">
            <div className="music-now-info">
              <span className="music-now-name">{tracks.find((t) => t.id === playing)?.name}</span>
              <span className="music-now-artist">{tracks.find((t) => t.id === playing)?.artist}</span>
            </div>
            <span className="music-now-time">{formatTime(duration * progress)} / {formatTime(duration)}</span>
            <button className="music-now-mute" onClick={() => {
              if (audioRef.current) audioRef.current.muted = !audioRef.current.muted;
              setMuted(!muted);
            }}>
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="home-empty"><p>Loading music...</p></div>
      ) : (
        <div className="music-list">
          {filtered.map((m) => (
            <div key={m.id} className={`music-item ${playing === m.id ? "playing" : ""}`}>
              <button className="music-play-btn" onClick={() => togglePlay(m)}>
                {playing === m.id ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <div className="music-info">
                <span className="music-name">{m.name}</span>
                <span className="music-artist">{m.artist}</span>
              </div>
              <span className="music-genre-tag">{m.genre}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="home-empty">
              <Disc size={40} strokeWidth={1.5} />
              <p>{tracks.length === 0
                ? "No music files found. Add .mp3 files to public/music/ and update manifest.json."
                : "No music found. Try a different search."
              }</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
