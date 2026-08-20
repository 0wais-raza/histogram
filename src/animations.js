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
    { selector: ".hero-img-wrapper", opacity: 0, scale: 0.9, duration: 0.6, ease: "power3.out" },
    { selector: ".hero h1", y: 30, opacity: 0, duration: 0.5, delay: 0.15, ease: "power3.out" },
    { selector: ".hero p", y: 20, opacity: 0, duration: 0.45, delay: 0.25, ease: "power2.out" },
    { selector: ".hero-actions", y: 20, opacity: 0, duration: 0.4, delay: 0.35, ease: "power2.out" },
  ],
  home: [
    { selector: ".home-title", y: 15, opacity: 0, duration: 0.4, ease: "power3.out" },
    { selector: ".feed-post", y: 20, opacity: 0, duration: 0.4, stagger: 0.08, delay: 0.15, ease: "power3.out" },
  ],
  profile: [
    { selector: ".avatar", opacity: 0, scale: 0.85, duration: 0.5, ease: "back.out(1.7)" },
    { selector: ".profile-info", x: 20, opacity: 0, duration: 0.4, delay: 0.1, ease: "power3.out" },
    { selector: ".stat-item", y: 12, opacity: 0, duration: 0.3, stagger: 0.06, delay: 0.2, ease: "power2.out" },
    { selector: ".grid-item", y: 15, opacity: 0, scale: 0.95, duration: 0.35, stagger: 0.04, delay: 0.3, ease: "power3.out" },
  ],
  auth: [
    { selector: ".auth-card", y: 30, opacity: 0, scale: 0.95, duration: 0.5, ease: "back.out(1.7)" },
  ],
  messages: [
    { selector: ".home-title", y: 15, opacity: 0, duration: 0.4, ease: "power3.out" },
    { selector: ".message-item", x: -15, opacity: 0, duration: 0.3, stagger: 0.05, delay: 0.1, ease: "power2.out" },
  ],
  explore: [
    { selector: ".home-title", y: 15, opacity: 0, duration: 0.4, ease: "power3.out" },
    { selector: ".search-bar", y: 10, opacity: 0, duration: 0.3, delay: 0.1, ease: "power2.out" },
  ],
  discover: [
    { selector: ".discover-category-btn", y: 10, opacity: 0, duration: 0.3, stagger: 0.04, ease: "power2.out" },
    { selector: ".discover-grid-item", scale: 0.9, opacity: 0, duration: 0.35, stagger: 0.03, delay: 0.15, ease: "power3.out" },
  ],
  create: [
    { selector: ".create-post-page-header", y: -10, opacity: 0, duration: 0.3, ease: "power2.out" },
    { selector: ".create-post-form > *", y: 12, opacity: 0, duration: 0.3, stagger: 0.05, delay: 0.1, ease: "power2.out" },
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

// ────────────────────────────────────────────────────────────────────────────
//  MICRO-INTERACTIONS
// ────────────────────────────────────────────────────────────────────────────

export function useMicroInteractions() {
  useEffect(() => {
    // Like button spring animation
    const handleLikeClick = (e) => {
      const btn = e.target.closest('.feed-post-action-btn');
      if (!btn) return;
      const icon = btn.querySelector('svg');
      if (icon) {
        gsap.fromTo(icon, { scale: 1 }, { scale: 1.4, duration: 0.15, ease: 'back.out(3)', yoyo: true, repeat: 1 });
      }
    };

    // Card hover lift
    const handleCardHover = (e) => {
      const card = e.target.closest('.feed-post, .grid-item-wrapper, .settings-item');
      if (!card) return;
      gsap.to(card, { y: -2, duration: 0.2, ease: 'power2.out' });
    };

    const handleCardLeave = (e) => {
      const card = e.target.closest('.feed-post, .grid-item-wrapper, .settings-item');
      if (!card) return;
      gsap.to(card, { y: 0, duration: 0.3, ease: 'power2.out' });
    };

    document.addEventListener('click', handleLikeClick);
    document.addEventListener('mouseenter', handleCardHover, true);
    document.addEventListener('mouseleave', handleCardLeave, true);

    return () => {
      document.removeEventListener('click', handleLikeClick);
      document.removeEventListener('mouseenter', handleCardHover, true);
      document.removeEventListener('mouseleave', handleCardLeave, true);
    };
  }, []);
}
