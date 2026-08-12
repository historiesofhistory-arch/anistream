import { useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

interface RowSliderProps {
  title: string;
  badge?: string;
  icon?: { component: React.ComponentType<{ className?: string }>; color: string };
  children: React.ReactNode;
  className?: string;
}

export function RowSlider({ title, badge, icon, children, className }: RowSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.floor(el.clientWidth * 0.72);
    el.scrollBy({ left: dir === "right" ? amount : -amount, behavior: "smooth" });
    setTimeout(updateScrollState, 380);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="section-heading font-display text-[1.05rem] font-bold tracking-tight text-white flex items-center gap-2">
            {icon && <icon.component className={cn("w-4 h-4 shrink-0", icon.color)} />}
            {title}
          </h2>
          {badge && (
            <span className="px-2 py-0.5 bg-primary/90 text-white text-[9px] font-bold uppercase tracking-wider rounded-full">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className={cn(
              "tap-scale w-8 h-8 rounded-xl border flex items-center justify-center transition-all duration-200",
              canScrollLeft
                ? "border-white/12 text-white/60 hover:border-primary/60 hover:text-primary hover:bg-primary/8"
                : "border-white/5 text-white/15 cursor-not-allowed"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className={cn(
              "tap-scale w-8 h-8 rounded-xl border flex items-center justify-center transition-all duration-200",
              canScrollRight
                ? "border-white/12 text-white/60 hover:border-primary/60 hover:text-primary hover:bg-primary/8"
                : "border-white/5 text-white/15 cursor-not-allowed"
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable row */}
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1"
          style={{ scrollSnapType: "x proximity" }}
        >
          {children}
        </div>

        {/* Fade edges */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-1 w-10 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
        )}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-1 w-10 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
        )}
      </div>
    </div>
  );
}
