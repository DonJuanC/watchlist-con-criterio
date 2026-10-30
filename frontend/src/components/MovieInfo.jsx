// src/components/MovieInfo.jsx
// Ficha completa de una película con diseño editorial cinéfilo:
// Bloque "Mi Criterio" con jerarquía de reseña de autor, notas de crítica
// estilizadas (OMDb) y enlaces de streaming por país (JustWatch).

import { useState, useEffect } from "react";
import { Star, Compass, Award, ExternalLink, Play, X } from "lucide-react";
import useMovieDetail from "../hooks/useMovieDetail";
import WatchProviders from "./WatchProviders";
import ShareMovieButton from "./ShareMovieButton";

const RECOMMEND_CONFIG = {
  1: {
    label: "Imprescindible · La recomiendo sin dudarlo",
    badgeClass: "bg-emerald-950/50 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]",
    dotClass: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]",
  },
  0: {
    label: "Interesante · La recomiendo con reservas",
    badgeClass: "bg-amber-950/50 text-amber-300 border-amber-500/40",
    dotClass: "bg-amber-400",
  },
  "-1": {
    label: "Prescindible · No la recomendaría",
    badgeClass: "bg-red-950/50 text-red-300 border-red-500/40",
    dotClass: "bg-red-400",
  },
};

// Notas de la crítica (OMDb).
function CriticScores({ rtScore, imdbRating, metascore, imdbId }) {
  const hasScores = rtScore != null || imdbRating != null || metascore != null;
  if (!hasScores) return null;

  return (
    <section className="rounded-xl border border-white/10 bg-neutral-900/40 p-3.5 backdrop-blur-sm">
      <div className="mb-2.5 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          <Award size={13} className="text-neutral-400" />
          La Crítica
        </h4>
        <div className="flex items-center gap-1 text-[11px] text-neutral-500">
          <span>vía OMDb</span>
          {imdbId && (
            <a
              href={`https://www.imdb.com/title/${imdbId}/`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-neutral-400 hover:text-white transition-colors"
              title="Abrir en IMDb"
            >
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {rtScore != null && (
          <div
            title="Rotten Tomatoes Tomatometer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-950/30 px-2.5 py-1 text-xs font-medium text-red-200"
          >
            <span className="font-bold text-red-400">RT</span>
            <span className="font-semibold text-white">{rtScore}%</span>
          </div>
        )}

        {imdbRating != null && (
          <div
            title="Calificación IMDb"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-950/30 px-2.5 py-1 text-xs font-medium text-amber-200"
          >
            <span className="font-bold text-amber-400">IMDb</span>
            <span className="font-semibold text-white">
              {Number(imdbRating).toFixed(1)}
            </span>
          </div>
        )}

        {metascore != null && (
          <div
            title="Metascore (Metacritic)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-2.5 py-1 text-xs font-medium text-emerald-200"
          >
            <span className="font-semibold text-emerald-400">Metascore</span>
            <span className="font-semibold text-white">{metascore}</span>
          </div>
        )}
      </div>
    </section>
  );
}

// Bloque "Mi Criterio": el sello personal de curaduría
function MyCriteria({ rating, recommend, review }) {
  const hasCriteria = rating != null || recommend != null || review;
  if (!hasCriteria) return null;

  const recConfig = RECOMMEND_CONFIG[recommend];

  return (
    <section className="relative overflow-hidden rounded-xl border border-amber-500/25 bg-neutral-900/70 p-4 shadow-xl backdrop-blur-md">
      <div className="mb-2.5 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
          <Compass size={14} className="text-amber-400" />
          Mi Criterio Personal
        </h4>

        {rating != null && (
          <div
            className="flex items-center gap-0.5 rounded-full bg-neutral-950/60 px-2 py-0.5 border border-white/10"
            aria-label={`${rating} de 5 estrellas`}
          >
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                size={13}
                className={
                  i < rating
                    ? "fill-amber-400 text-amber-400"
                    : "text-neutral-700"
                }
              />
            ))}
          </div>
        )}
      </div>

      {recConfig && (
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${recConfig.badgeClass}`}
        >
          <span className={`h-2 w-2 rounded-full ${recConfig.dotClass}`} />
          {recConfig.label}
        </div>
      )}

      {review && (
        <blockquote className="mt-3 rounded-r-lg border-l-2 border-amber-500/50 bg-amber-950/15 px-3.5 py-2.5 font-serif text-sm sm:text-base italic leading-relaxed text-neutral-200">
          “{review}”
        </blockquote>
      )}
    </section>
  );
}

function TrailerModal({ trailer, movieTitle, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!trailer?.key) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Tráiler oficial de ${movieTitle}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-neutral-950 shadow-[0_0_50px_rgba(0,0,0,0.9)]"
      >
        {/* Cabecera del reproductor */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-neutral-900/70">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 rounded bg-red-950/80 border border-red-500/40 px-2 py-0.5 text-[10px] font-semibold text-red-300 uppercase tracking-wider">
              Oficial
            </span>
            <span className="truncate text-xs sm:text-sm font-medium text-white">
              {movieTitle} — {trailer.name || "Tráiler Oficial"}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`https://www.youtube.com/watch?v=${trailer.key}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors"
              title="Abrir directamente en YouTube"
            >
              <span>YouTube</span>
              <ExternalLink size={11} />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar reproductor"
              className="rounded-full p-1 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors ml-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Reproductor de YouTube embebido con modo sin cookies */}
        <div className="relative aspect-video w-full bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0&modestbranding=1`}
            title={`Tráiler oficial de ${movieTitle}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}

function TmdbAttribution() {
  return (
    <p className="border-t border-white/10 pt-3 text-[11px] leading-snug text-neutral-500">
      Datos e imágenes de{" "}
      <a
        href="https://www.themoviedb.org/"
        target="_blank"
        rel="noreferrer"
        className="underline hover:text-neutral-300 transition-colors"
      >
        TMDB
      </a>
      . This product uses the TMDB API but is not endorsed or certified by TMDB.
    </p>
  );
}

/**
 * @param {{ movieId: number }} props
 */
export default function MovieInfo({ movieId }) {
  const { data: movie, loading, error } = useMovieDetail(movieId);
  const [showTrailer, setShowTrailer] = useState(false);

  if (loading) {
    return (
      <div className="space-y-3 py-4 animate-shimmer">
        <div className="h-6 w-3/4 rounded bg-white/10" />
        <div className="h-4 w-1/2 rounded bg-white/5" />
        <div className="h-20 w-full rounded-xl bg-white/5" />
      </div>
    );
  }

  if (error || !movie) {
    return (
      <p className="py-6 text-center text-sm text-red-400">
        No pudimos cargar la ficha de esta película.
      </p>
    );
  }

  const subtitle =
    movie.original_title && movie.original_title !== movie.title
      ? movie.original_title
      : movie.title_es && movie.title_es !== movie.title
        ? movie.title_es
        : null;

  return (
    <div className="space-y-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-2xl font-bold tracking-tight text-white leading-tight">
            {movie.title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-neutral-400 italic font-serif">
              {subtitle}
            </p>
          )}
          <p className="mt-1.5 text-xs sm:text-sm font-medium text-neutral-300">
            {[
              movie.release_year,
              movie.director && `Dir. ${movie.director}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {movie.cinematographer && (
            <p className="mt-0.5 text-xs text-neutral-400">
              Fotografía: {movie.cinematographer}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {movie.trailer?.key && (
            <button
              type="button"
              onClick={() => setShowTrailer(true)}
              aria-label={`Ver tráiler oficial de ${movie.title}`}
              title="Ver tráiler oficial en YouTube"
              className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-200 backdrop-blur-md transition-all hover:border-red-400/70 hover:bg-red-950/80 hover:text-white hover:shadow-[0_0_15px_rgba(239,68,68,0.25)] active:scale-95"
            >
              <Play size={11} className="fill-red-400 text-red-400 shrink-0" />
              <span className="hidden sm:inline">Tráiler oficial</span>
              <span className="sm:hidden">Tráiler</span>
            </button>
          )}
          <ShareMovieButton movie={movie} />
        </div>
      </div>

      {Array.isArray(movie.genres) && movie.genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {movie.genres.map((g) => (
            <span
              key={g}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-neutral-300 backdrop-blur-sm"
            >
              {g}
            </span>
          ))}
        </div>
      )}

      {movie.overview && (
        <p className="text-sm leading-relaxed text-neutral-300 font-normal">
          {movie.overview}
        </p>
      )}

      {/* Bloque Mi Criterio */}
      <MyCriteria
        rating={movie.rating}
        recommend={movie.recommend}
        review={movie.review}
      />

      {/* La Crítica */}
      <CriticScores
        rtScore={movie.rt_score}
        imdbRating={movie.imdb_rating}
        metascore={movie.metascore}
        imdbId={movie.imdb_id}
      />

      {/* Dónde verla */}
      <WatchProviders tmdbId={movie.tmdb_id} />

      <TmdbAttribution />

      {/* Modal Cinematográfico de Tráiler Oficial */}
      {showTrailer && movie.trailer && (
        <TrailerModal
          trailer={movie.trailer}
          movieTitle={movie.title}
          onClose={() => setShowTrailer(false)}
        />
      )}
    </div>
  );
}
