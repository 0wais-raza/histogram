import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";

export default function Landing() {
  const { user } = useAuth();
  usePageAnimations("landing");

  return (
    <div className="landing">
      <section className="hero">
        <img src="/histogram.png" alt="Histogram logo" className="hero-img" />
        <h1>Histogram</h1>
        <p>
          Share moments. Follow friends. An Instagram-style photo <br /> feed
          built on Firebase.
        </p>
        <div className="hero-actions">
          {user ? (
            <Link to="/home" className="btn primary">
              Go to feed
            </Link>
          ) : (
            <div className="start">
              <Link to="/signup" className="btn primary">
                Get Started!
              </Link>
              <Link to="/login" className="btn">
                Have an account? Login!
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}