// shared/transition-variants.ts
// Centralized framer-motion variants — single source of truth for the whole site.
// Goal: SMOOTH + POLISHED. No "jhalak", no scroll leak, no "niche khulna".
//
// Strategy: mode="wait" with INSTANT exit (0ms) + smooth fade-in (0.25s).
// - Old page vanishes INSTANTLY (no fade-out → no visible scroll leak)
// - Scroll resets to 0 in useLayoutEffect (before paint, before new page mounts)
// - New page mounts at scrollY=0 → fades in smoothly over 0.25s
// - No gap because exit is 0ms — the new page starts mounting immediately after
//
// WHY NOT mode="sync" (cross-fade):
//   With sync, both pages render simultaneously. The NEW page inherits the
//   window's scroll position from the OLD page → details page opens at
//   scrollY=400 instead of 0. This was the "niche khul ja raha hai" bug.

import type { Variants, Transition } from "framer-motion";

export const pageTransitionSpring: Transition = {
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1],
};

export const pageVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: pageTransitionSpring,
  },
  // EXIT: INSTANT (0ms) — old page disappears immediately.
  // This prevents scroll leak: the old page vanishes before the new page
  // mounts, so the new page starts at scrollY=0 (after useLayoutEffect reset).
  // No gap is visible because the new page starts fading in immediately after.
  exit: {
    opacity: 0,
    transition: { duration: 0 },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SQUISHY — used by cards, buttons, list items, anything "tappable"
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: whileHover NO LONGER uses `y: -2` — that was causing the
// "card jumps up before navigating" glitch the user reported. Now hover
// is just a subtle scale-up (no vertical movement), so clicking a card
// doesn't trigger any scroll-side-effect in the browser.

export const squishyTap = {
  scale: 0.96,
  transition: { type: "spring" as const, stiffness: 500, damping: 25, mass: 0.5 },
};

export const squishyHover = {
  scale: 1.03,
  transition: { type: "spring" as const, stiffness: 380, damping: 22, mass: 0.6 },
};

// Stagger container — used by card grids so cards pop in one-by-one
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.035,
      delayChildren: 0.04,
    },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.015, staggerDirection: -1 },
  },
};

// Stagger child — for use inside a stagger container
export const staggerChild: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 380,
      damping: 24,
      mass: 0.7,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.14, ease: [0.4, 0, 1, 1] },
  },
};

// Modal/sheet variants — already bouncy in existing code, but centralize them
export const sheetUp: Variants = {
  hidden: { y: "100%", opacity: 0.6 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.85 },
  },
  exit: {
    y: "100%",
    opacity: 0.6,
    transition: { type: "spring" as const, stiffness: 380, damping: 32, mass: 0.7 },
  },
};
