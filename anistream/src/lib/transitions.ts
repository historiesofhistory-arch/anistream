// shared/transition-variants.ts
// Centralized framer-motion variants — single source of truth for the whole site.
// Goal: SMOOTH + POLISHED. No "jhalak" of old page, no scroll jump.
//
// Strategy: CROSS-FADE with position:absolute on the exiting page.
// - Old page gets position:absolute so it "floats" and doesn't affect scroll
// - Old page fades out (0.2s) while new page fades in (0.2s) simultaneously
// - New page starts at scrollY=0 naturally (fresh mount)
// - NO useLayoutEffect scroll reset — the old page's scroll doesn't matter
//   because it's position:absolute (taken out of flow)
// - No gap, no blank state, no jhalak

import type { Variants, Transition } from "framer-motion";

export const pageTransitionSpring: Transition = {
  duration: 0.2,
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
  // EXIT: position:absolute takes the old page OUT of the document flow.
  // This means the old page's scroll position doesn't affect the new page.
  // The old page "floats" on top and fades out — the user never sees it
  // scroll up or jump. Combined with opacity fade = clean cross-fade.
  exit: {
    opacity: 0,
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
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
