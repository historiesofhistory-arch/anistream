// shared/transition-variants.ts
// Centralized framer-motion variants — single source of truth for the whole site.
// Goal: BUTTERY SMOOTH + SQUISHY. Feels alive, not robotic.
//
// Page transitions use spring physics for a natural "settle" feel.
// Tap/hover effects use soft springs with mild overshoot.

import type { Variants, Transition } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// PAGE TRANSITIONS — buttery smooth crossfade
// ─────────────────────────────────────────────────────────────────────────────
// Uses a spring with moderate stiffness and damping — feels like a native
// iOS app navigation. Not too fast (feels cheap), not too slow (feels sluggish).
// The spring gives it a subtle "alive" quality that a linear tween can't.

export const pageTransitionSpring: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 26,
  mass: 1,
};

export const pageVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: pageTransitionSpring,
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SQUISHY — used by cards, buttons, list items, anything "tappable"
// ─────────────────────────────────────────────────────────────────────────────
// whileTap = soft squish (scale down to 0.94 with a gentle spring)
// whileHover = subtle scale up (1.04x) with a soft spring — no y-offset
// The springs have mild overshoot (damping < stiffness ratio) so it feels
// "alive" — like pressing a soft button that bounces back.

export const squishyTap = {
  scale: 0.94,
  transition: { type: "spring" as const, stiffness: 400, damping: 17, mass: 0.6 },
};

export const squishyHover = {
  scale: 1.04,
  transition: { type: "spring" as const, stiffness: 300, damping: 20, mass: 0.7 },
};

// Stagger container — cards pop in one-by-one with a bouncy feel
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.02, staggerDirection: -1 },
  },
};

// Stagger child — soft fade + gentle slide up with spring
export const staggerChild: Variants = {
  hidden: {
    opacity: 0,
    y: 16,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 22,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
  },
};

// Modal/sheet variants — bouncy sheet from bottom
export const sheetUp: Variants = {
  hidden: { y: "100%", opacity: 0.6 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 28, mass: 0.9 },
  },
  exit: {
    y: "100%",
    opacity: 0.6,
    transition: { type: "spring" as const, stiffness: 350, damping: 30, mass: 0.8 },
  },
};
