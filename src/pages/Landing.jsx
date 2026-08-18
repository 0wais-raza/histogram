import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePageAnimations } from "../animations";
import {
  Camera,
  Users,
  Shield,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: Camera,
    title: "Share Moments",
    desc: "Capture and share your best photos with the world in stunning quality.",
  },
  {
    icon: Users,
    title: "Follow Friends",
    desc: "Stay connected with your friends and see what they're up to.",
  },
  {
    icon: Shield,
    title: "Privacy First",
    desc: "Your data is secure with Firebase authentication and encryption.",
  },
  {
    icon: Sparkles,
    title: "Beautiful Feed",
    desc: "A sleek, modern feed designed for an amazing viewing experience.",
  },
];

export default function Landing() {
  const { user } = useAuth();
  usePageAnimations("landing");

  return (
    <div className="landing">
      <section className="hero">
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

        <div className="features">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon">
                <f.icon size={24} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}