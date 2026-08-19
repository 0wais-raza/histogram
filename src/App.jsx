import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import PageTransition from "./components/PageTransition";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Explore from "./pages/Explore";
import Followers from "./pages/Followers";
import Saved from "./pages/Saved";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Navbar />
          <PageTransition>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/home" element={<Home />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/profile/:uid" element={<Profile />} />
                <Route path="/profile/:uid/followers" element={<Followers />} />
                <Route path="/saved" element={<Saved />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PageTransition>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
