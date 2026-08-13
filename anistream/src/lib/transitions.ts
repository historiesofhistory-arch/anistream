// shared/transition-variants.ts
// Centralized framer-motion variants — single source of truth for the whole site.
// Goal: SMOOTH + POLISHED. No "collapsing" or "up-down" glitches on page change.
// Simple opacity crossfade — clean, fast, no janky spring overshoot.

import type { Variants, Transition } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// PAGE TRANSITIONS
// ─────────────────────────────────────────────────────────────────────────────
// Strategy: SIMPLE OPACITY CROSSFADE. No scale, no y-offset, no blur — these
// were causing the "previous page collapses" + "up-down then navigate" bugs
// the user reported. A clean opacity-only transition feels polished and
// professional, like modern streaming apps (Netflix, Crunchyroll).
//
// Using mode="wait" with instant opacity transitions = no visible gap,
// no collapse, no scroll jump. The new page just fades in over the old one.

export const pageTransitionSpring: Transition = {
  duration: 0.15,
  ease: [0.4, 0, 0.2, 1],  // standard Material ease — smooth, no overshoot
};

export const pageVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: pageTransitionSpring,
  },
  // EXIT: Very fast fade (50ms) — short enough that the old page disappears
  // before the scroll-jump is visible, but smooth enough to not feel like
  // a hard cut. Combined with useLayoutEffect scroll-reset, this gives a
  // clean "old page fades out → new page fades in" feel with no jhataka.
  exit: {
    opacity: 0,
    transition: { duration: 0.05, ease: [0.4, 0, 0.2, 1] },
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
