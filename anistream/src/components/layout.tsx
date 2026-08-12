import { Link, useLocation } from "wouter";
import { Search, Tv2, CalendarDays, Home, X, Menu, Compass } from "lucide-react";
import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../lib/utils";

const NAV_LINKS = [
  { href: "/",        label: "Home",     icon: Home },
  { href: "/browse",  label: "Browse",   icon: Compass },
  { href: "/schedule",label: "Schedule", icon: CalendarDays },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const close = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans dark">

      {/* ── Navbar ── */}
      <header
        className="sticky top-0 z-50 w-full border-b border-white/[0.05]"
        style={{
          background: "rgba(7,8,16,0.92)",
          backdropFilter: "blur(16px) saturate(1.3)",
          WebkitBackdropFilter: "blur(16px) saturate(1.3)",
        }}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="max-w-screen-2xl mx-auto px-3 sm:px-5 h-14 flex items-center gap-3">

          {/* ── Left: hamburger (mobile) ── */}
          <TapButton
            onClick={() => setSidebarOpen(v => !v)}
            className="md:hidden w-9 h-9 flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.07] rounded-xl transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </TapButton>

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2 group shrink-0 outline-none tap-scale">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-rose-700 flex items-center justify-center
              shadow-[0_0_14px_rgba(229,43,80,0.4)] ring-1 ring-white/10
              group-hover:shadow-[0_0_22px_rgba(229,43,80,0.6)] group-hover:scale-105 transition-all duration-250">
              <Tv2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-[1.08rem] tracking-tight text-white">
              Ani<span className="text-gradient-red">Stream</span>
            </span>
          </Link>

          {/* ── Desktop nav ── */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 ml-2">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = location === href;
              return (
                <Link key={href} href={href}
                  className={cn(
                    "tap-scale relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                    active ? "text-white bg-white/[0.06]" : "text-white/40 hover:text-white/75 hover:bg-white/[0.04]"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {active && (
                    <span className="absolute bottom-[5px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* ── Right: search ── */}
          <div className="ml-auto flex items-center gap-2">
            <Link href="/search"
              className="tap-scale flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white/45 hover:text-white
                bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.14]
                transition-all duration-200 rounded-xl"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Full-screen Sidebar ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="sidebar-backdrop"
              className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={close}
            />

            {/* Drawer */}
            <motion.aside
              key="sidebar-drawer"
              className="fixed inset-0 z-[90] md:hidden flex flex-col bg-[#0a0b12]"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260, mass: 0.8 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-rose-700 flex items-center justify-center shadow-[0_0_14px_rgba(229,43,80,0.4)]">
                    <Tv2 className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-display font-bold text-[1.08rem] text-white">
                    Ani<span className="text-gradient-red">Stream</span>
                  </span>
                </div>
                <TapButton
                  onClick={close}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.07] hover:bg-white/[0.13] text-white/50 hover:text-white transition-all"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </TapButton>
              </div>

              {/* Nav items */}
              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {NAV_LINKS.map(({ href, label, icon: Icon }, i) => {
                  const active = location === href;
                  return (
                    <motion.div
                      key={href}
                      initial={{ opacity: 0, x: -18 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.06 + i * 0.05, duration: 0.22 }}
                    >
                      <Link href={href} onClick={close}
                        className={cn(
                          "tap-scale flex items-center gap-4 px-4 py-3.5 rounded-2xl text-base font-semibold transition-all duration-200",
                          active
                            ? "bg-primary/15 text-white border border-primary/25"
                            : "text-white/50 hover:text-white hover:bg-white/[0.05] border border-transparent"
                        )}
                      >
                        <Icon className={cn("w-5 h-5 shrink-0", active ? "text-primary" : "text-white/40")} />
                        {label}
                        {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              {/* Footer */}
              <div className="px-5 py-5 border-t border-white/[0.05]">
                <p className="text-[10px] text-white/15 font-medium">AniStream • Powered by AniList</p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Page content */}
      <main className="flex-1 flex flex-col relative z-0">
        {children}
      </main>
    </div>
  );
}

// ── Tap-feedback button wrapper ────────────────────────────────────────────────
// Gives every button a crisp scale-down on press without framer overhead.
export function TapButton({
  children, className, onClick, "aria-label": ariaLabel, type = "button",
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  "aria-label"?: string;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn("tap-scale", className)}
    >
      {children}
    </button>
  );
}
