// src/components/MoviePosterCard.jsx
// Tarjeta y póster cinematográfico con proporción real 2:3, ambient glow,
// badges de criterio y estados de fallback accesibles.

import { useState } from "react";
import { Star, Film, Check, Minus, X } from "lucide-react";

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
  showBadge = true,
}) {
  const [imageError, setImageError] = useState(false);

  const initial = (movie?.title || "?").trim().charAt(0).toUpperCase();

  // Resolución óptima de TMDB según el tamaño de la tarjeta
  const tmdbSize = size === "lg" || size === "xl" ? "w342" : "w185";

  // Tamaños y estilos de proporción cinematográfica 2:3 estandarizados
  const sizeStyles = {
    xs: "w-9 aspect-[2/3] rounded text-xs",
    sm: "w-16 sm:w-20 aspect-[2/3] rounded-lg text-xs",
    md: "w-24 sm:w-28 aspect-[2/3] rounded-xl text-sm",
    lg: "w-32 sm:w-36 aspect-[2/3] rounded-xl text-base",
    xl: "w-40 sm:w-48 aspect-[2/3] rounded-2xl text-lg",
  };

  // Tratamiento táctil de bordes y elevación (sin halos fluorescentes)
  const elevationStyle = isCenter
    ? "ring-1 ring-white/40 shadow-poster-hover"
    : selected
      ? "ring-1 ring-amber-400/70 shadow-poster-hover"
      : "border border-white/[0.08] group-hover:border-white/[0.22] shadow-poster group-hover:shadow-poster-hover group-hover:-translate-y-0.5";

  const hasPoster = movie?.poster_path && !imageError;

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-[#121215] transition-all duration-300 ease-out ${
        sizeStyles[size] || sizeStyles.md
      } ${elevationStyle} ${className}`}
    >
      {/* Respaldo / Fallback cuando no hay póster o falla la carga */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center select-none bg-[#121215]">
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
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
      )}

      {/* Gradiente sutil inferior para legibilidad y elegancia */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Reflejo especular táctil estilo lente al pasar el cursor */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-tr from-transparent via-white/[0.025] to-white/[0.05]" />

      {/* Badge de recomendación personal accesible (independiente del color según WCAG 1.4.1) */}
      {showBadge && movie?.recommend != null && (() => {
        const isRec = movie.recommend === 1;
        const isNeutral = movie.recommend === 0;
        const label = isRec
          ? "Recomendada"
          : isNeutral
            ? "Recomendada con reservas"
            : "No recomendada";

        const badgeColor = isRec
          ? "border-emerald-500/40 bg-neutral-950/80 text-emerald-300"
          : isNeutral
            ? "border-amber-500/40 bg-neutral-950/80 text-amber-300"
            : "border-red-500/40 bg-neutral-950/80 text-red-300";

        return (
          <div
            title={label}
            aria-label={label}
            className={`absolute top-1.5 right-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full border px-1 backdrop-blur-md shadow-sm ${badgeColor}`}
          >
            {isRec && <Check size={8} strokeWidth={3} className="shrink-0" />}
            {isNeutral && <Minus size={8} strokeWidth={3} className="shrink-0" />}
            {!isRec && !isNeutral && <X size={8} strokeWidth={3} className="shrink-0" />}
            <span className="sr-only">{label}</span>
          </div>
        );
      })()}

      {/* Badge de estrellas si tiene rating personal */}
      {showBadge && movie?.rating != null && (
        <div className="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1 rounded bg-neutral-950/85 px-1.5 py-0.5 text-[9px] font-mono font-medium text-amber-300/90 backdrop-blur-sm border border-white/10">
          <Star size={9} className="fill-amber-400 text-amber-400" />
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
