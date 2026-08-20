import { Component } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = "/home";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "40px 24px",
          textAlign: "center",
          gap: 16,
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(248, 113, 113, 0.1)",
            border: "1px solid rgba(248, 113, 113, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <AlertTriangle size={28} style={{ color: "var(--error)" }} />
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
            Something went wrong
          </h2>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14, maxWidth: 360 }}>
            An unexpected error occurred. You can try again or head back home.
          </p>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 8,
              background: "rgba(0,0,0,0.4)",
              border: "1px solid var(--border)",
              color: "var(--error)",
              fontSize: 12,
              maxWidth: "100%",
              overflow: "auto",
              textAlign: "left",
              whiteSpace: "pre-wrap",
            }}>
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button className="btn primary" onClick={this.handleRetry}>
              <RefreshCw size={16} /> Try Again
            </button>
            <button className="btn" onClick={this.handleGoHome}>
              <Home size={16} /> Go Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
