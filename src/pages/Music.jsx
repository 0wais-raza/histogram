import { useState, useRef } from "react";
import { usePageAnimations } from "../animations";
import { Music as MusicIcon, Play, Pause, Search, Disc } from "lucide-react";

// Demo music library - in production, integrate with a real music API
const MUSIC_LIBRARY = [
  { id: "m1", name: "Chill Vibes", artist: "Lo-Fi Beats", duration: "3:24", genre: "Lo-Fi", url: "" },
  { id: "m2", name: "Sunset Drive", artist: "Synthwave", duration: "4:01", genre: "Synthwave", url: "" },
  { id: "m3", name: "Midnight Rain", artist: "Ambient", duration: "3:56", genre: "Ambient", url: "" },
  { id: "m4", name: "Electric Dreams", artist: "Electronic", duration: "3:12", genre: "Electronic", url: "" },
  { id: "m5", name: "Morning Coffee", artist: "Jazz Hop", duration: "2:45", genre: "Jazz", url: "" },
  { id: "m6", name: "City Lights", artist: "R&B", duration: "3:33", genre: "R&B", url: "" },
  { id: "m7", name: "Summer Breeze", artist: "Tropical", duration: "3:18", genre: "Pop", url: "" },
  { id: "m8", name: "Neon Nights", artist: "Retrowave", duration: "4:15", genre: "Synthwave", url: "" },
  { id: "m9", name: "Ocean Waves", artist: "Nature Sounds", duration: "5:00", genre: "Ambient", url: "" },
  { id: "m10", name: "Hip Hop Flow", artist: "Beat Maker", duration: "2:58", genre: "Hip Hop", url: "" },
  { id: "m11", name: "Piano Dreams", artist: "Classical", duration: "4:42", genre: "Classical", url: "" },
  { id: "m12", name: "Trap Beat", artist: "Producer X", duration: "3:07", genre: "Trap", url: "" },
];

const GENRES = ["All", "Lo-Fi", "Synthwave", "Ambient", "Electronic", "Jazz", "R&B", "Pop", "Hip Hop", "Classical", "Trap"];

export default function Music() {
  const [search, setSearch] = useState("");
  const [activeGenre, setActiveGenre] = useState("All");
  const [playing, setPlaying] = useState(null);

  const filtered = MUSIC_LIBRARY.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.artist.toLowerCase().includes(search.toLowerCase());
    const matchesGenre = activeGenre === "All" || m.genre === activeGenre;
    return matchesSearch && matchesGenre;
  });

  usePageAnimations("home");

  return (
    <div className="page page-enter">
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

      <div className="music-list">
        {filtered.map((m) => (
          <div key={m.id} className={`music-item ${playing === m.id ? "playing" : ""}`}>
            <button
              className="music-play-btn"
              onClick={() => setPlaying(playing === m.id ? null : m.id)}
            >
              {playing === m.id ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <div className="music-info">
              <span className="music-name">{m.name}</span>
              <span className="music-artist">{m.artist}</span>
            </div>
            <span className="music-genre-tag">{m.genre}</span>
            <span className="music-duration">{m.duration}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="home-empty">
            <Disc size={40} strokeWidth={1.5} />
            <p>No music found. Try a different search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
