import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Home } from './pages/home';
import { Watch } from './pages/watch';
import { Search } from './pages/search';
import { Details } from './pages/details';
import { Schedule } from './pages/schedule';
import { Browse } from './pages/browse';
import { Layout } from './components/layout';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { pageVariants } from './lib/transitions';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1, refetchOnWindowFocus: false },
  },
});

function routeKey(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'watch') return `/watch/${parts[1] ?? ''}`;
  if (parts[0] === 'anime') return `/anime/${parts[1] ?? ''}`;
  if (!parts[0]) return '/';
  return `/${parts[0]}`;
}

// ── ScrollResetter ──────────────────────────────────────────────────────────
// Invisible component that resets window scroll to 0 when it mounts.
// Placed INSIDE each page's motion.div, so it mounts together with the new
// page content. useLayoutEffect fires synchronously after DOM commit but
// BEFORE paint — so the user never sees the new page at the old scroll position.
//
// The old (exiting) page is position:absolute (from pageVariants.exit), so
// it doesn't contribute to the document's scroll height. Resetting scroll
// to 0 only affects the new page — the old page stays exactly where it was.
function ScrollResetter() {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);
  return null;
}

// ── Top progress bar ──────────────────────────────────────────────────────────
// Shows a thin red bar at the top during page transitions.
// Timed to match the page transition (0.3s) — appears instantly, fills
// quickly, then disappears. No long 2s wait like before.
function NavProgress() {
  const [location] = useLocation();
  const [visible, setVisible] = useState(false);
  const prevRef = useRef(location);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show on initial load
  useEffect(() => {
    setVisible(true);
    hideTimer.current = setTimeout(() => setVisible(false), 600);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  // Show on route change
  useEffect(() => {
    const key = routeKey(location);
    if (key === routeKey(prevRef.current)) return;
    prevRef.current = location;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVisible(true);
    // Hide after the transition completes (0.2s cross-fade + small buffer)
    hideTimer.current = setTimeout(() => setVisible(false), 500);
  }, [location]);

  if (!visible) return null;
  return <div className="nav-progress-active" />;
}

// ── Router ────────────────────────────────────────────────────────────────────
// Key behaviour decisions for SMOOTH + SQUISHY page transitions:
//
// 1. AnimatePresence mode="wait" — old page exits fully BEFORE new page enters.
//    This avoids overlap glitches and double-scrollbar issues on mobile.
//    Combined with a fast exit (spring 380/32/0.7), the perceived duration is
//    short enough to feel instant but smooth — like a native mobile app.
//
// 2. Scroll restoration is HANDLED MANUALLY via history.scrollRestoration='manual'
//    (set in main.tsx) + a synchronous window.scrollTo(0,0) right when the
//    location changes (in the same commit cycle, before the new page mounts).
//    This prevents the "scroll jump" glitch where the old page's scroll position
//    briefly leaks into the new page during the exit animation.
//
// 3. The motion.div has `position: relative` so the old page's exit animation
//    doesn't cause layout shift on the new page. We're using `wait` mode so the
//    old page is fully unmounted before the new one mounts — no absolute
//    positioning needed.
//
// 4. `willChange: 'transform, opacity, filter'` ensures the GPU compositor
//    handles the spring animation at 60fps even on mid-range mobile devices.

function Router() {
  const [location] = useLocation();
  const key = routeKey(location);

  // ⚠️ SCROLL-RESTORATION + NO-SCROLL-JUMP STRATEGY — IMPORTANT
  //
  // PROBLEM the user reported:
  //   When navigating from search (scrolled down) → watch/details, the page
  //   "slightly goes up and then transitions" — a visible scroll-up glitch
  //   BEFORE the new page mounts.
  //
  // ROOT CAUSE:
  //   The search page auto-focuses its input on mount. When the user scrolls
  //   down to browse results, the input is left above the fold. The moment
  //   they click an anime card, the URL changes — but the input is STILL
  //   focused. Some browsers (especially mobile Safari + Chrome) will try
  //   to scroll the focused element back into view as a side-effect of the
  //   upcoming navigation, causing the visible "scroll up" before the
  //   framer-motion exit animation kicks in.
  //
  // FIX (this useLayoutEffect):
  //   The instant the route key changes — BEFORE the browser paints — we
  //   blur the active element. This removes the focus target, so the
  //   browser has nothing to scroll into view during the transition.
  //   useLayoutEffect runs synchronously after DOM mutation but before
  //   paint, so the blur lands before any scroll-side-effect can fire.
  //
  // We ALSO keep the existing `onExitComplete` scroll-to-0 hook so the new
  // page mounts at scrollTop=0 (in the gap between old-page-unmount and
  // new-page-mount that `mode="wait"` provides).
  // Blur input on route change. Do NOT reset scroll here.
  // Scroll is reset in the new page's useEffect (see PageWrapper below)
  // which fires AFTER the new page has mounted but BEFORE the user sees it.
  useLayoutEffect(() => {
    const active = document.activeElement;
    if (active && active instanceof HTMLElement && active.tagName === 'INPUT') {
      active.blur();
    }
  }, [key]);

  return (
    <Layout>
      <NavProgress />
      <AnimatePresence
        initial={false}
      >
        <motion.div
          key={key}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ willChange: 'transform, opacity' }}
        >
          {/* ScrollResetter: invisible component that resets scroll to 0
              the moment this page mounts. Fires synchronously in useLayoutEffect
              AFTER the new page's DOM is committed but BEFORE paint.
              The old page is position:absolute (from exit variant) so it
              doesn't contribute to scroll height — resetting to 0 only
              affects the new page. */}
          <ScrollResetter />
          <Switch location={location}>
            <Route path="/" component={Home} />
            <Route path="/anime/:animeId" component={Details} />
            <Route path="/watch/:animeId/:episodeId?" component={Watch} />
            <Route path="/browse" component={Browse} />
            <Route path="/search" component={Search} />
            <Route path="/schedule" component={Schedule} />
            <Route>
              <div className="flex flex-col h-[60vh] items-center justify-center space-y-4 text-center px-4">
                <div className="text-8xl font-display font-black text-primary/20">404</div>
                <h1 className="text-2xl font-display font-bold">Page not found</h1>
                <p className="text-muted-foreground text-sm">The page you're looking for doesn't exist.</p>
              </div>
            </Route>
          </Switch>
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
