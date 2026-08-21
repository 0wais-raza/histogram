import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import ScrollToTop from "./components/ScrollToTop";
import PageTransition from "./components/PageTransition";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Explore from "./pages/Explore";
import Followers from "./pages/Followers";
import Saved from "./pages/Saved";
import Discover from "./pages/Discover";
import Music from "./pages/Music";
import Notifications from "./pages/Notifications";
import Messages from "./pages/Messages";
import CreatePostPage from "./pages/CreatePostPage";
import PostDetail from "./pages/PostDetail";
import NotFound from "./pages/NotFound";
import SettingsPage from "./pages/SettingsPage";
import { useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useMicroInteractions } from "./animations";

function AppRoutes() {
  useMicroInteractions();
  const { user, loading } = useAuth();
  const location = useLocation();
  const isPublicPage = ["/", "/login", "/signup"].includes(location.pathname);
  const showSidebar = !loading && user && !isPublicPage;

  return (
    <div className={`app-layout ${showSidebar ? "has-sidebar" : "no-sidebar"}`}>
      {showSidebar && <Sidebar />}
      <main className={`app-main${showSidebar ? "" : " app-main-full"}`}>
        <PageTransition>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/home" element={<Home />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/music" element={<Music />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile/:uid" element={<Profile />} />
              <Route path="/profile/:uid/followers" element={<Followers />} />
              <Route path="/saved" element={<Saved />} />
              <Route path="/create" element={<CreatePostPage />} />
              <Route path="/post/:id" element={<PostDetail />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PageTransition>
        <footer className="site-footer">
          <span>Built by <a href="https://github.com/0wais-raza" target="_blank" rel="noopener noreferrer">@owais-raza</a></span>
        </footer>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <AppRoutes />
            <ScrollToTop />
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
