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

// ── NavProgress ──────────────────────────────────────────────────────────────
// Thin bar at top during transitions. Simple, fast, non-blocking.
function NavProgress() {
  const [location] = useLocation();
  const [visible, setVisible] = useState(false);
  const prevRef = useRef(location);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVisible(true);
    hideTimer.current = setTimeout(() => setVisible(false), 600);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  useEffect(() => {
    const key = routeKey(location);
    if (key === routeKey(prevRef.current)) return;
    prevRef.current = location;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVisible(true);
    hideTimer.current = setTimeout(() => setVisible(false), 500);
  }, [location]);

  if (!visible) return null;
  return <div className="nav-progress-active" />;
}

// ── Router ───────────────────────────────────────────────────────────────────
// ARCHITECTURE: mode="wait" with instant exit.
//
// Why mode="wait":
//   - Only ONE page is in the DOM at any time → no double-render lag
//   - Old page exits (instant 0ms) → DOM is clean → new page mounts → slides in
//   - On mobile, rendering two full pages simultaneously causes jank/freeze
//
// Why instant exit (0ms):
//   - A slow exit (0.3s fade) keeps the old page visible at its scroll position
//     while the new page also tries to render → scroll conflict → jump
//   - Instant exit: old page gone → scroll free to reset → new page slides in
//
// Scroll handling:
//   1. useLayoutEffect: blur active input (prevents mobile scroll-into-view)
//   2. onExitComplete: fires after old page is fully removed → scrollTo(0,0)
//   3. New page mounts at scrollY=0 naturally
//
// This works on ALL transitions: home→details, search→details, details→watch, etc.
function Router() {
  const [location] = useLocation();
  const key = routeKey(location);

  // Blur active input on route change — prevents mobile browsers from
  // scrolling the focused element back into view during navigation.
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
        mode="wait"
        initial={false}
        onExitComplete={() => {
          // Old page is fully removed from DOM. Reset scroll to 0.
          // The new page (about to mount) will start at scrollY=0.
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
        }}
      >
        <motion.div
          key={key}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ willChange: 'transform, opacity' }}
        >
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
