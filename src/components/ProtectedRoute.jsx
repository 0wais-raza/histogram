import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  // Wait for auth state to resolve before making any decision
  if (loading) {
    return (
      <div className="loading">
        <div className="setup-btn-spinner" style={{ width: 24, height: 24 }} />
      </div>
    );
  }

  return user ? <Outlet /> : <Navigate to="/" replace />;
}
