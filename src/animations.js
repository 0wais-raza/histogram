import { useEffect } from "react";
import gsap from "gsap";

/* ══════════════════════════════════════════════════════════════════════════════
   GSAP ANIMATION GUIDE — Histogram
   ══════════════════════════════════════════════════════════════════════════════

   This file contains all GSAP animation helpers for the app.
   Add new animations here — pages reference them via usePageAnimations()
   or usePageEntrance().

   ────────────────────────────────────────────────────────────────────────────
   1. ENTRANCE ANIMATIONS (page load)
   ────────────────────────────────────────────────────────────────────────────
   Triggered when a component mounts. Use for page-level fade-ins.

   Usage in a page:
     import { usePageEntrance } from "../animations";
     export default function MyPage() {
       usePageEntrance();  // fades .page-enter elements in
       return <div className="page page-enter">...</div>;
     }

   Or pass a custom container selector:
     usePageEntrance(".my-container");

   ────────────────────────────────────────────────────────────────────────────
   2. STAGGER ANIMATIONS (list items, cards, grid)
   ────────────────────────────────────────────────────────────────────────────
   Animates a group of elements one after another.

   Usage in a page:
     import { useStagger } from "../animations";
     export default function MyPage() {
       useStagger(".card");  // staggers all .card elements
       return <div><div className="card">...</div><div className="card">...</div></div>;
     }

   Custom options:
     useStagger(".card", { y: 30, opacity: 0, duration: 0.5, stagger: 0.1 });

   ────────────────────────────────────────────────────────────────────────────
   3. SCROLL-TRIGGERED ANIMATIONS
   ────────────────────────────────────────────────────────────────────────────
   Animates elements as they scroll into view.

   Usage:
     import { useScrollReveal } from "../animations";
     export default function MyPage() {
       useScrollReveal(".fade-up");  // reveals elements as user scrolls
       return <div className="fade-up">...</div>;
     }

   Custom options:
     useScrollReveal(".fade-up", { y: 40, duration: 0.8 });

   ────────────────────────────────────────────────────────────────────────────
   4. TIMELINE ANIMATIONS (sequenced)
   ────────────────────────────────────────────────────────────────────────────
   Run multiple animations in a defined order with labels.

   Usage:
     import { createTimeline } from "../animations";
     useEffect(() => {
       const tl = createTimeline();
       tl.from(".step-1", { opacity: 0, y: 20 })
         .from(".step-2", { opacity: 0, y: 20 }, "-=0.3")  // overlap 0.3s
         .from(".step-3", { opacity: 0, y: 20 }, "-=0.3");
       return () => tl.kill();
     }, []);

   ────────────────────────────────────────────────────────────────────────────
   5. PAGE-SPECIFIC ANIMATIONS (named presets)
   ────────────────────────────────────────────────────────────────────────────
   Define reusable animation presets in the pageAnimations object below.
   Each key maps to an array of { selector, ...gsapVars } steps.

   Usage:
     import { usePageAnimations } from "../animations";
     usePageAnimations("landing");

   To add a new page preset:
     pageAnimations.myPage = [
       { selector: ".heading", y: 20, opacity: 0, duration: 0.6 },
       { selector: ".card", y: 30, opacity: 0, duration: 0.5, stagger: 0.1, delay: 0.3 },
     ];

   ────────────────────────────────────────────────────────────────────────────
   6. GSAP CORE REFERENCE
   ────────────────────────────────────────────────────────────────────────────

   COMMON PROPERTIES:
     x, y          — translate (px)
     opacity       — 0 to 1
     scale         — 1 = normal, 0.5 = half, 2 = double
     rotation      — degrees
     duration      — seconds
     delay         — seconds before starting
     ease          — "power2.out", "back.out(1.7)", "elastic.out(1, 0.3)", etc.

   STAGGER:
     stagger: 0.1           — 100ms between each element
     stagger: { each: 0.1, from: "start" }  — from: "start" | "end" | "center" | "random"
     stagger: { each: 0.1, grid: "auto" }   — grid-based stagger for 2D layouts

   SCROLL TRIGGER (requires ScrollTrigger plugin):
     import { ScrollTrigger } from "gsap/ScrollTrigger";
     gsap.registerPlugin(ScrollTrigger);
     gsap.from(".el", {
       scrollTrigger: { trigger: ".el", start: "top 80%", toggleActions: "play none none none" },
       y: 40, opacity: 0, duration: 0.8,
     });

   TIMELINE:
     const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
     tl.from(".a", { y: 20, opacity: 0 })
       .from(".b", { y: 20, opacity: 0 }, "-=0.4")   // overlap
       .from(".c", { y: 20, opacity: 0 }, "<+=0.2");  // 0.2s after previous starts

   KILL / CLEANUP:
     gsap.killTweensOf(".el")     — kill specific tweens
     gsap.killTweensOf(myRef)     — kill by ref
     gsap.context(() => {...})     — scope + revert on ctx.revert()

   ══════════════════════════════════════════════════════════════════════════════ */

// ────────────────────────────────────────────────────────────────────────────
//  NAMED PAGE PRESETS
// ────────────────────────────────────────────────────────────────────────────
// Add new page presets here. Keys are passed to usePageAnimations("key").

export const pageAnimations = {
  landing: [
    { selector: ".hero-img", y: 30, opacity: 0, duration: 0.8 },
    { selector: ".hero h1", y: 24, opacity: 0, duration: 0.8, delay: 0.15 },
    { selector: ".hero p", y: 20, opacity: 0, duration: 0.8, delay: 0.3 },
    { selector: ".hero-actions", y: 20, opacity: 0, duration: 0.8, delay: 0.45 },
    { selector: ".feature-card", y: 40, opacity: 0, duration: 0.6, stagger: 0.12, delay: 0.6 },
  ],
  home: [
    { selector: ".page h1", y: 20, opacity: 0, duration: 0.6 },
    { selector: ".page p", y: 15, opacity: 0, duration: 0.6, delay: 0.15 },
  ],
  profile: [
    { selector: ".profile-header", y: 30, opacity: 0, duration: 0.7 },
    { selector: ".avatar", scale: 0.8, opacity: 0, duration: 0.5, delay: 0.1 },
    { selector: ".stats span", y: 10, opacity: 0, duration: 0.4, stagger: 0.08, delay: 0.3 },
    { selector: ".grid-item", y: 20, opacity: 0, duration: 0.5, stagger: 0.06, delay: 0.4 },
  ],
  auth: [
    { selector: ".auth-card", y: 30, opacity: 0, duration: 0.6, ease: "power2.out" },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
//  PRESET RUNNER
// ────────────────────────────────────────────────────────────────────────────
// Runs a named preset by key.

export function runPageAnimations(pageKey) {
  const steps = pageAnimations[pageKey] || [];
  steps.forEach(({ selector, ...vars }) => gsap.from(selector, vars));
}

// React hook — runs a named preset, cleans up on unmount (StrictMode-safe).
export function usePageAnimations(pageKey) {
  useEffect(() => {
    const ctx = gsap.context(() => runPageAnimations(pageKey));
    return () => ctx.revert();
  }, [pageKey]);
}

// ────────────────────────────────────────────────────────────────────────────
//  ENTRANCE ANIMATION
// ────────────────────────────────────────────────────────────────────────────
// Fades in a container and its children with stagger.
// Wrap your page content with className="page-enter" and call this hook.

export function usePageEntrance(containerSelector = ".page-enter") {
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(containerSelector, {
        opacity: 0,
        y: 24,
        duration: 0.5,
        ease: "power2.out",
      });

      gsap.from(`${containerSelector} > *`, {
        opacity: 0,
        y: 16,
        duration: 0.4,
        stagger: 0.06,
        delay: 0.15,
        ease: "power2.out",
      });
    });

    return () => ctx.revert();
  }, [containerSelector]);
}

// ────────────────────────────────────────────────────────────────────────────
//  STAGGER ANIMATION
// ────────────────────────────────────────────────────────────────────────────
// Animates a list of elements one after another.

export function useStagger(selector, options = {}) {
  const defaults = {
    y: 20,
    opacity: 0,
    duration: 0.45,
    stagger: 0.08,
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
// Fades elements in as they scroll into view.
// NOTE: Requires ScrollTrigger — uncomment and install if needed:
//   npm install gsap  (ScrollTrigger is bundled)
//   import { ScrollTrigger } from "gsap/ScrollTrigger";
//   gsap.registerPlugin(ScrollTrigger);

export function useScrollReveal(selector, options = {}) {
  const defaults = {
    y: 40,
    opacity: 0,
    duration: 0.7,
    ease: "power2.out",
  };

  useEffect(() => {
    // ScrollTrigger-based (uncomment when ready):
    //
    // import { ScrollTrigger } from "gsap/ScrollTrigger";
    // gsap.registerPlugin(ScrollTrigger);
    //
    // const ctx = gsap.context(() => {
    //   gsap.from(selector, {
    //     ...defaults,
    //     ...options,
    //     scrollTrigger: {
    //       trigger: selector,
    //       start: "top 85%",
    //       toggleActions: "play none none none",
    //     },
    //   });
    // });
    // return () => ctx.revert();

    // Fallback: simple entrance (no scroll dependency)
    const ctx = gsap.context(() => {
      gsap.from(selector, { ...defaults, ...options, delay: 0.3 });
    });
    return () => ctx.revert();
  }, [selector]);
}

// ────────────────────────────────────────────────────────────────────────────
//  TIMELINE HELPER
// ────────────────────────────────────────────────────────────────────────────
// Creates a reusable GSAP timeline with sensible defaults.

export function createTimeline(options = {}) {
  return gsap.timeline({
    defaults: { ease: "power2.out", ...options },
  });
}
