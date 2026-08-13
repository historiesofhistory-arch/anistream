// shared/transition-variants.ts
// Centralized framer-motion variants — single source of truth for the whole site.
//
// ── ARCHITECTURE ──
// mode="wait": old page exits FIRST (instant), then new page enters (slide from right).
// This avoids rendering both pages simultaneously (which causes lag on mobile).
//
// Flow on navigation:
//   1. User clicks card → route changes
//   2. useLayoutEffect fires → blur active input (prevents mobile scroll-into-view)
//   3. AnimatePresence sees key changed → old page starts EXIT animation
//   4. Exit is INSTANT (0ms) → old page vanishes from DOM immediately
//   5. onExitComplete fires → scroll resets to 0 (window.scrollTo)
//   6. New page mounts → ScrollResetter fires (useLayoutEffect, before paint)
//   7. New page slides in from right (x: 100% → 0) with spring
//
// Why mode="wait" instead of mode="sync":
//   - sync: both pages render simultaneously → double DOM size → lag on mobile
//   - wait: only one page in DOM at a time → smooth, no jank
//   - The "gap" between exit and enter is 0ms (instant exit) so user doesn't see blank
//
// Why instant exit:
//   - A fade-out exit (0.3s) means the old page stays visible at its scroll position
//     for 0.3s while the new page also renders → scroll conflict → jump
//   - Instant exit: old page vanishes → scroll is free to reset → new page slides in clean

import type { Variants, Transition } from "framer-motion";

export const pageTransitionSpring: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 28,
  mass: 0.9,
};

export const pageVariants: Variants = {
  // New page enters from the RIGHT — slides in over where the old page was
  initial: {
    opacity: 0,
    x: "100%",
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: pageTransitionSpring,
  },
  // EXIT: INSTANT (0ms) — old page vanishes immediately.
  // With mode="wait", this means the old page is removed from DOM
  // BEFORE the new page mounts. No scroll conflict, no double-render.
  // The "gap" is invisible because the new page starts mounting instantly.
  exit: {
    opacity: 0,
    transition: { duration: 0 },
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
