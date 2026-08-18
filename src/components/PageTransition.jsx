import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import gsap from "gsap";

/**
 * PageTransition — wraps page content for smooth entrance animations.
 * Enhanced with neon cyber motion.
 */
export default function PageTransition({ children }) {
  const ref = useRef(null);
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Animate entrance on route change
  useEffect(() => {
    if (!ref.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 24, filter: "blur(4px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.5,
          ease: "power3.out",
        }
      );
    });

    return () => ctx.revert();
  }, [location.pathname]);

  return (
    <div ref={ref} style={{ minHeight: "calc(100vh - 60px)" }}>
      {children}
    </div>
  );
}
