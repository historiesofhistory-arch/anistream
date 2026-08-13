// shared/transition-variants.ts
// Centralized framer-motion variants — single source of truth for the whole site.
// Goal: BUTTERY SMOOTH slide transition. New page slides in from right,
// old page stays in place underneath. Like iOS/Android native navigation.
//
// Strategy: mode="sync" — both pages render simultaneously.
//   - OLD page: stays in place (position absolute, opacity fades to 0)
//   - NEW page: slides in from right (x: 100% → 0) with spring physics
//   - Old page is position:absolute so it doesn't push new page
//   - Scroll resets to 0 in useLayoutEffect before paint

import type { Variants, Transition } from "framer-motion";

export const pageTransitionSpring: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 28,
  mass: 0.9,
};

export const pageVariants: Variants = {
  // New page enters from the RIGHT — slides in over the old page
  initial: {
    opacity: 0,
    x: "100%",
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: pageTransitionSpring,
  },
  // Old page: position absolute (floats underneath), fades out slightly.
  // Stays in place — no movement, just opacity fade so the new page
  // slides cleanly over it.
  exit: {
    opacity: 0,
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SQUISHY — soft press + bouncy release
// ─────────────────────────────────────────────────────────────────────────────
export const squishyTap = {
  scale: 0.94,
  transition: { type: "spring" as const, stiffness: 400, damping: 17, mass: 0.6 },
};

export const squishyHover = {
  scale: 1.04,
  transition: { type: "spring" as const, stiffness: 300, damping: 20, mass: 0.7 },
};

// Stagger container
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

// Stagger child
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

// Modal/sheet
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
