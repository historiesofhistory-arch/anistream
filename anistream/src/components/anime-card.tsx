import { Link } from "wouter";
import { Play } from "lucide-react";
import { cn } from "../lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";
import { squishyTap } from "../lib/transitions";

interface AnimeCardProps {
  anime: {
    id: number;
    title: string;
    posterUrl: string;
    year?: number | null;
    type?: string | null;
    rating?: number | null;
    episodeCount?: number | null;
  };
  badge?: string;
  badgeVariant?: "default" | "aired" | "upcoming";
  className?: string;
  priority?: boolean;
}

/** Normalise type string to short display label */
function typeLabel(type: string | null | undefined): string | null {
  if (!type) return null;
  const t = type.toUpperCase();
  if (t === "TV" || t === "ANIME") return "TV";
  if (t === "MOVIE") return "Movie";
  if (t === "OVA") return "OVA";
  if (t === "ONA") return "ONA";
  if (t === "SPECIAL") return "Special";
  if (t === "MUSIC") return "Music";
  return type;
}

/** Per-type badge colour classes */
function typePillClasses(label: string | null): string {
  switch (label) {
    case "TV":      return "bg-blue-500/25 border-blue-400/40 text-blue-300 shadow-[0_0_6px_rgba(59,130,246,0.35)]";
    case "Movie":   return "bg-violet-500/25 border-violet-400/40 text-violet-300 shadow-[0_0_6px_rgba(139,92,246,0.35)]";
    case "OVA":     return "bg-cyan-500/25 border-cyan-400/40 text-cyan-300 shadow-[0_0_6px_rgba(6,182,212,0.35)]";
    case "ONA":     return "bg-emerald-500/25 border-emerald-400/40 text-emerald-300 shadow-[0_0_6px_rgba(16,185,129,0.35)]";
    case "Special": return "bg-amber-500/25 border-amber-400/40 text-amber-300 shadow-[0_0_6px_rgba(245,158,11,0.35)]";
    default:        return "bg-white/10 border-white/15 text-white/70";
  }
}

export function AnimeCard({ anime, badge, badgeVariant = "default", className, priority = false }: AnimeCardProps) {
  const [imgState, setImgState] = useState<"loading" | "loaded" | "error">("loading");
  const label = typeLabel(anime.type);

  return (
    <motion.div
      whileTap={squishyTap}
      // Note: motion wrapper for squishy tap; the inner <Link> keeps semantics
      style={{ willChange: "transform" }}
    >
    <Link href={`/anime/${anime.id}`} className={cn("tap-scale group flex flex-col outline-none shrink-0", className)}>
      {/* ── Poster ── */}
      <div
        className="relative w-full aspect-[2/3] overflow-hidden bg-secondary transition-all duration-300 rounded-xl
          group-hover:shadow-[0_8px_32px_rgba(0,0,0,0.55),0_0_0_1.5px_hsl(var(--primary)/0.5)]
          group-active:scale-[0.97]"
        style={{ willChange: "transform, box-shadow" }}
      >
        {/* Skeleton while loading */}
        {imgState === "loading" && <div className="absolute inset-0 shimmer rounded-xl" />}

        <img
          src={anime.posterUrl}
          alt={anime.title}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onLoad={() => setImgState("loaded")}
          onError={() => setImgState("error")}
          className={cn(
            "w-full h-full object-cover rounded-xl",
            "transition-[opacity,transform] duration-500 ease-out",
            imgState === "loaded" ? "opacity-100 scale-100" : "opacity-0 scale-[1.04]",
          )}
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg glow-red
            scale-75 group-hover:scale-100 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
          </div>
        </div>

        {/* Type pill — top left */}
        {label && (
          <div className={cn(
            "absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide backdrop-blur-sm border",
            typePillClasses(label)
          )}>
            {label}
          </div>
        )}

        {/* Custom badge — top right */}
        {badge && (
          <div className={cn(
            "absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide",
            badgeVariant === "aired"    && "bg-emerald-600/90 backdrop-blur-sm text-white",
            badgeVariant === "upcoming" && "bg-black/60 backdrop-blur-sm text-white/50 border border-white/10",
            badgeVariant === "default"  && "bg-primary/90 backdrop-blur-sm text-white",
          )}>
            {badge}
          </div>
        )}
      </div>

      {/* ── Info below card ── */}
      <div className="mt-2 px-0.5 space-y-1">
        {/* Title */}
        <h3 className="font-semibold text-[12px] leading-snug truncate text-foreground/85 group-hover:text-white transition-colors duration-200">
          {anime.title}
        </h3>

        {/* Second line: type pill + year — always same height for symmetry */}
        <div className="flex items-center gap-1.5 h-4">
          {label ? (
            <span className={cn(
              "px-1.5 py-px text-[9px] font-bold rounded-full border leading-none",
              typePillClasses(label)
            )}>
              {label}
            </span>
          ) : null}
          {anime.year ? (
            <span className="text-[10px] text-white/30 leading-none">
              {anime.year}
            </span>
          ) : (
            <span className="text-[10px] text-white/20 leading-none">—</span>
          )}
          {anime.rating != null && (
            <span className="ml-auto text-[9px] text-yellow-500/80 font-semibold leading-none">
              ★{Math.round(anime.rating * 10)}
            </span>
          )}
        </div>
      </div>
    </Link>
    </motion.div>
  );
}
