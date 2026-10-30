// src/components/MoviePosterCard.jsx
// Tarjeta y póster cinematográfico con proporción real 2:3, ambient glow,
// badges de criterio y estados de fallback accesibles.

import { useState } from "react";
import { Star, Film } from "lucide-react";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/";

/**
 * @param {object} props
 * @param {object} props.movie
 * @param {"xs"|"sm"|"md"|"lg"|"xl"} [props.size="md"]
 * @param {boolean} [props.isCenter=false]
 * @param {boolean} [props.selected=false]
 * @param {string} [props.className=""]
 * @param {string} [props.accentColor="neutral"] "neutral" | "amber" | "emerald"
 * @param {boolean} [props.showBadge=true]
 */
export default function MoviePosterCard({
  movie,
  size = "md",
  isCenter = false,
  selected = false,
  className = "",
  accentColor = "neutral",
  showBadge = true,
}) {
  const [imageError, setImageError] = useState(false);

  const initial = (movie?.title || "?").trim().charAt(0).toUpperCase();

  // Resolución óptima de TMDB según el tamaño de la tarjeta
  const tmdbSize = size === "lg" || size === "xl" ? "w342" : "w185";

  // Tamaños y estilos de proporción cinematográfica 2:3
  const sizeStyles = {
    xs: "w-9 aspect-[2/3] rounded-md text-xs",
    sm: "w-16 sm:w-20 aspect-[2/3] rounded-lg text-xs",
    md: "w-24 sm:w-28 aspect-[2/3] rounded-xl text-sm",
    lg: "w-32 sm:w-36 aspect-[2/3] rounded-2xl text-base",
    xl: "w-40 sm:w-48 aspect-[2/3] rounded-2xl text-lg",
  };

  const accentBorder = {
    neutral: isCenter
      ? "ring-1.5 ring-white/60 shadow-2xl shadow-black"
      : selected
        ? "ring-1.5 ring-white/60 shadow-xl"
        : "border-white/10 group-hover:border-white/30 group-hover:shadow-xl shadow-black/50",
    cyan: isCenter
      ? "ring-1.5 ring-white/60 shadow-2xl shadow-black"
      : selected
        ? "ring-1.5 ring-white/60 shadow-xl"
        : "border-white/10 group-hover:border-white/30 group-hover:shadow-xl shadow-black/50",
    emerald: isCenter
      ? "ring-1.5 ring-emerald-400/80 shadow-2xl shadow-black"
      : selected
        ? "ring-1.5 ring-emerald-400/80 shadow-xl"
        : "border-white/10 group-hover:border-emerald-500/30 group-hover:shadow-xl shadow-black/50",
    amber: isCenter
      ? "ring-1.5 ring-amber-400/80 shadow-2xl shadow-black"
      : selected
        ? "ring-1.5 ring-amber-400/80 shadow-xl"
        : "border-white/10 group-hover:border-amber-500/30 group-hover:shadow-xl shadow-black/50",
  };

  const hasPoster = movie?.poster_path && !imageError;

  return (
    <div
      className={`relative shrink-0 overflow-hidden border bg-gradient-to-b from-neutral-850 to-neutral-900 transition-all duration-300 ${
        sizeStyles[size] || sizeStyles.md
      } ${accentBorder[accentColor] || accentBorder.cyan} ${className}`}
    >
      {/* Respaldo / Fallback cuando no hay póster o falla la carga */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center select-none bg-neutral-900/90">
        <Film size={size === "xs" || size === "sm" ? 14 : 20} className="mb-1 text-neutral-600" />
        <span className="font-serif font-semibold text-neutral-400 leading-tight">
          {initial}
        </span>
      </div>

      {/* Imagen del póster TMDB */}
      {hasPoster && (
        <img
          src={`${TMDB_IMAGE_BASE}${tmdbSize}${movie.poster_path}`}
          alt={`Afiche oficial de ${movie.title || "película"}`}
          loading="lazy"
          onError={() => setImageError(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}

      {/* Gradiente sutil inferior para legibilidad y elegancia */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Badge de recomendación personal (🟢/🟡/🔴) o calificación */}
      {showBadge && movie?.recommend != null && (
        <div
          title={
            movie.recommend === 1
              ? "Recomendada"
              : movie.recommend === 0
                ? "Recomendada con reservas"
                : "No recomendada"
          }
          className="absolute top-1.5 right-1.5 z-10 flex items-center justify-center rounded-full bg-neutral-950/80 px-1 py-0.5 backdrop-blur-sm border border-white/10"
        >
          <span
            className={`block h-2 w-2 rounded-full ${
              movie.recommend === 1
                ? "bg-emerald-400"
                : movie.recommend === 0
                  ? "bg-amber-400"
                  : "bg-red-400"
            }`}
          />
        </div>
      )}

      {/* Badge de estrellas si tiene rating personal */}
      {showBadge && movie?.rating != null && (
        <div className="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-0.5 rounded-md bg-neutral-950/85 px-1 py-0.5 text-[10px] font-medium text-amber-300 backdrop-blur-sm border border-white/10">
          <Star size={10} className="fill-amber-400 text-amber-400" />
          <span>{movie.rating}</span>
        </div>
      )}
    </div>
  );
}

/** Componente Skeleton para simular tarjetas mientras se carga la búsqueda o la lista */
export function MovieCardSkeleton({ size = "md", className = "" }) {
  const sizeStyles = {
    sm: "w-16 sm:w-20 aspect-[2/3] rounded-lg",
    md: "w-24 sm:w-28 aspect-[2/3] rounded-xl",
    lg: "w-32 sm:w-36 aspect-[2/3] rounded-2xl",
  };

  return (
    <div
      className={`animate-shimmer relative shrink-0 border border-white/5 bg-neutral-900/80 ${
        sizeStyles[size] || sizeStyles.md
      } ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
    </div>
  );
}
