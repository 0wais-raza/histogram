import { useNavigate } from "react-router-dom";
import { Ghost, ArrowLeft, Home } from "lucide-react";
import { usePageAnimations } from "../animations";

export default function NotFound() {
  const navigate = useNavigate();
  usePageAnimations("not-found");

  return (
    <div className="page page-enter not-found-page">
      <div className="not-found-icon">
        <Ghost size={64} />
      </div>
      <h1 className="not-found-title">404</h1>
      <p className="not-found-subtitle">This page doesn't exist or has been moved.</p>
      <div className="not-found-actions">
        <button className="btn primary" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Go Back
        </button>
        <button className="btn" onClick={() => navigate("/home")}>
          <Home size={16} /> Home
        </button>
      </div>
    </div>
  );
}
