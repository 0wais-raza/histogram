import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import { ArrowRight } from "lucide-react";

export default function Landing() {
  const { user } = useAuth();
  usePageAnimations("landing");

  useEffect(() => {
    document.body.classList.add("landing-active");
    return () => document.body.classList.remove("landing-active");
  }, []);

  return (
    <div className="landing-page">
      <div className="landing-glow" />
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
          {user ? (
            <Link to="/home" className="btn primary">
              Go to feed
              <ArrowRight size={18} />
            </Link>
          ) : (
            <div className="start">
              <Link to="/signup" className="btn primary">
                Get Started
                <ArrowRight size={18} />
              </Link>
              <Link to="/login" className="btn">
                Have an account? Log in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}