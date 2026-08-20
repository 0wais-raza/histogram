import { useEffect, useRef } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import { ArrowRight } from "lucide-react";
import Swal from "sweetalert2";

export default function Landing() {
  const { user, loading } = useAuth();
  const videoRef = useRef(null);
  usePageAnimations("landing");

  useEffect(() => {
    document.body.classList.add("landing-active");
    return () => document.body.classList.remove("landing-active");
  }, []);

  // Show SWAL on load, play video on confirm
  useEffect(() => {
    if (loading || user) return;

    const timer = setTimeout(() => {
      Swal.fire({
        title: "Welcome to Histogram",
        html: `
          <p style="color: var(--text-secondary); margin: 0 0 8px; font-size: 14px;">
            Share moments. Follow friends. A photo feed with a modern edge.
          </p>
        `,
        icon: "info",
        confirmButtonText: `<span style="display:flex;align-items:center;gap:8px;"><span>Enter</span></span>`,
        confirmButtonColor: "#863bff",
        buttonsStyling: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
        customClass: {
          popup: "swal-custom-popup",
          title: "swal-custom-title",
          htmlContainer: "swal-custom-html",
          confirmButton: "swal-confirm-btn",
        },
        showClass: { popup: "swal2-show swal2-bounce-in" },
        hideClass: { popup: "swal2-hide swal2-bounce-out" },
      }).then((result) => {
        if (result.isConfirmed && videoRef.current) {
          videoRef.current.muted = false;
          videoRef.current.play().catch(() => {});
        }
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [loading, user]);

  // Redirect to home if already logged in
  if (!loading && user) {
    return <Navigate to="/home" replace />;
  }

  if (loading) {
    return (
      <div className="landing-page">
        <div className="landing-glow" />
        <div className="hero">
          <div className="setup-btn-spinner" style={{ width: 32, height: 32 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="landing-page landing-page-video">
      {/* Background video — lightweight settings */}
      <video
        ref={videoRef}
        className="landing-bg-video"
        src="/bg.mp4"
        loop
        playsInline
        preload="metadata"
        poster="/histogram.png"
        webkit-playsinline="true"
      />

      {/* Beautiful gradient overlay */}
      <div className="landing-video-overlay" />

      {/* Extra decorative glow */}
      <div className="landing-glow" />

      {/* Landing Header */}
      <nav className="landing-header">
        <Link to="/" className="landing-header-logo">
          <img src="/histogram.png" alt="" className="landing-header-logo-img" />
          <span>Histogram</span>
        </Link>
        <div className="landing-header-actions">
          <Link to="/login" className="btn ghost">Log in</Link>
          <Link to="/signup" className="btn primary">Sign up</Link>
        </div>
      </nav>

      <div className="hero">
        <div className="hero-img-wrapper">
          <img src="/histogram.png" alt="Histogram logo" className="hero-img" />
        </div>
        <h1>Histogram</h1>
        <p>
          Share moments. Follow friends. A photo feed built on
          Firebase with a modern edge.
        </p>
        <div className="hero-actions">
          <div className="start">
            <Link to="/signup" className="btn primary">
              Get Started
              <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="btn">
              Have an account? Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
