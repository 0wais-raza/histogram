import { useEffect } from "react";
import gsap from "gsap";

/* ══════════════════════════════════════════════════════════════════════════════
   GSAP ANIMATION GUIDE — Histogram (Neon Cyber Edition)
   ══════════════════════════════════════════════════════════════════════════════ */

// ────────────────────────────────────────────────────────────────────────────
//  NAMED PAGE PRESETS
// ────────────────────────────────────────────────────────────────────────────

export const pageAnimations = {
  landing: [
    { selector: ".hero-img-wrapper", scale: 0.5, opacity: 0, duration: 1, ease: "back.out(1.7)" },
    { selector: ".hero h1", y: 40, opacity: 0, duration: 0.9, delay: 0.2, ease: "power3.out" },
    { selector: ".hero p", y: 30, opacity: 0, duration: 0.8, delay: 0.4, ease: "power3.out" },
    { selector: ".hero-actions", y: 25, opacity: 0, duration: 0.7, delay: 0.6, ease: "power3.out" },
    { selector: ".feature-card", y: 50, opacity: 0, duration: 0.6, stagger: 0.12, delay: 0.8, ease: "power3.out" },
  ],
  home: [
    { selector: ".home-welcome", y: 30, opacity: 0, duration: 0.7, ease: "power3.out" },
    { selector: ".feed-placeholder", y: 40, opacity: 0, duration: 0.8, delay: 0.2, ease: "power3.out" },
  ],
  profile: [
    { selector: ".avatar", scale: 0.6, opacity: 0, duration: 0.7, ease: "back.out(1.7)" },
    { selector: ".profile-info", x: 30, opacity: 0, duration: 0.6, delay: 0.15, ease: "power3.out" },
    { selector: ".stat-item", y: 15, opacity: 0, duration: 0.4, stagger: 0.08, delay: 0.3, ease: "power2.out" },
    { selector: ".grid-item", y: 25, opacity: 0, duration: 0.5, stagger: 0.05, delay: 0.4, ease: "power3.out" },
  ],
  auth: [
    { selector: ".auth-card", y: 40, opacity: 0, scale: 0.95, duration: 0.7, ease: "power3.out" },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
//  PRESET RUNNER
// ────────────────────────────────────────────────────────────────────────────

export function runPageAnimations(pageKey) {
  const steps = pageAnimations[pageKey] || [];
  steps.forEach(({ selector, ...vars }) => gsap.from(selector, vars));
}

export function usePageAnimations(pageKey) {
  useEffect(() => {
    const ctx = gsap.context(() => runPageAnimations(pageKey));
    return () => ctx.revert();
  }, [pageKey]);
}

// ────────────────────────────────────────────────────────────────────────────
//  ENTRANCE ANIMATION
// ────────────────────────────────────────────────────────────────────────────

export function usePageEntrance(containerSelector = ".page-enter") {
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(containerSelector, {
        opacity: 0,
        y: 30,
        duration: 0.6,
        ease: "power3.out",
      });

      gsap.from(`${containerSelector} > *`, {
        opacity: 0,
        y: 20,
        duration: 0.5,
        stagger: 0.08,
        delay: 0.15,
        ease: "power3.out",
      });
    });

    return () => ctx.revert();
  }, [containerSelector]);
}

// ────────────────────────────────────────────────────────────────────────────
//  STAGGER ANIMATION
// ────────────────────────────────────────────────────────────────────────────

export function useStagger(selector, options = {}) {
  const defaults = {
    y: 25,
    opacity: 0,
    duration: 0.5,
    stagger: 0.08,
    ease: "power3.out",
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(selector, { ...defaults, ...options });
    });

    return () => ctx.revert();
  }, [selector]);
}

// ────────────────────────────────────────────────────────────────────────────
//  SCROLL REVEAL
// ────────────────────────────────────────────────────────────────────────────

export function useScrollReveal(selector, options = {}) {
  const defaults = {
    y: 50,
    opacity: 0,
    duration: 0.8,
    ease: "power3.out",
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(selector, { ...defaults, ...options, delay: 0.3 });
    });
    return () => ctx.revert();
  }, [selector]);
}

// ────────────────────────────────────────────────────────────────────────────
//  TIMELINE HELPER
// ────────────────────────────────────────────────────────────────────────────

export function createTimeline(options = {}) {
  return gsap.timeline({
    defaults: { ease: "power3.out", ...options },
  });
}
