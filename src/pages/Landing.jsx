import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import { ArrowRight, Camera } from "lucide-react";

export default function Landing() {
  const { user, loading } = useAuth();
  usePageAnimations("landing");

  useEffect(() => {
    document.body.classList.add("landing-active");
    return () => document.body.classList.remove("landing-active");
  }, []);

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
    <div className="landing-page">
      <div className="landing-glow" />
      
      {/* Landing Header */}
      <nav className="landing-header">
        <Link to="/" className="landing-header-logo">
          <Camera size={22} />
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
