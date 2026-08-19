import { useEffect } from "react";
import gsap from "gsap";

/* ══════════════════════════════════════════════════════════════════════════════
   GSAP ANIMATION GUIDE — Histogram
   ══════════════════════════════════════════════════════════════════════════════ */

// ────────────────────────────────────────────────────────────────────────────
//  NAMED PAGE PRESETS
// ────────────────────────────────────────────────────────────────────────────

export const pageAnimations = {
  landing: [
    { selector: ".hero-img-wrapper", opacity: 0, duration: 0.5, ease: "power2.out" },
    { selector: ".hero h1", y: 20, opacity: 0, duration: 0.4, delay: 0.1, ease: "power2.out" },
    { selector: ".hero p", y: 15, opacity: 0, duration: 0.4, delay: 0.2, ease: "power2.out" },
    { selector: ".hero-actions", y: 15, opacity: 0, duration: 0.35, delay: 0.3, ease: "power2.out" },
  ],
  home: [
    { selector: ".home-welcome", y: 15, opacity: 0, duration: 0.4, ease: "power2.out" },
    { selector: ".feed-placeholder", y: 20, opacity: 0, duration: 0.4, delay: 0.1, ease: "power2.out" },
  ],
  profile: [
    { selector: ".avatar", opacity: 0, duration: 0.4, ease: "power2.out" },
    { selector: ".profile-info", x: 15, opacity: 0, duration: 0.35, delay: 0.1, ease: "power2.out" },
    { selector: ".stat-item", y: 10, opacity: 0, duration: 0.3, stagger: 0.05, delay: 0.2, ease: "power2.out" },
    { selector: ".grid-item", y: 12, opacity: 0, duration: 0.3, stagger: 0.03, delay: 0.25, ease: "power2.out" },
  ],
  auth: [
    { selector: ".auth-card", y: 20, opacity: 0, duration: 0.4, ease: "power2.out" },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
//  PRESET RUNNER
// ────────────────────────────────────────────────────────────────────────────

export function runPageAnimations(pageKey) {
  const steps = pageAnimations[pageKey] || [];
  steps.forEach(({ selector, ...vars }) => {
    if (document.querySelector(selector)) gsap.from(selector, vars);
  });
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
        y: 15,
        duration: 0.35,
        ease: "power2.out",
      });

      gsap.from(`${containerSelector} > *`, {
        opacity: 0,
        y: 12,
        duration: 0.3,
        stagger: 0.05,
        delay: 0.1,
        ease: "power2.out",
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
    y: 12,
    opacity: 0,
    duration: 0.3,
    stagger: 0.05,
    ease: "power2.out",
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
    y: 25,
    opacity: 0,
    duration: 0.5,
    ease: "power2.out",
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(selector, { ...defaults, ...options, delay: 0.15 });
    });
    return () => ctx.revert();
  }, [selector]);
}

// ────────────────────────────────────────────────────────────────────────────
//  TIMELINE HELPER
// ────────────────────────────────────────────────────────────────────────────

export function createTimeline(options = {}) {
  return gsap.timeline({
    defaults: { ease: "power2.out", ...options },
  });
}
