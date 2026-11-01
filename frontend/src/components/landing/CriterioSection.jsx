// src/components/landing/CriterioSection.jsx
// «Mi criterio»: las películas que tienen reseña, con nota, veredicto y un extracto.
// Es el diferencial del archivo, así que va antes que cualquier otra lista.

import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import useCineStore from "../../store/useCineStore";
import MoviePosterCard from "../MoviePosterCard";
import { VERDICT } from "./verdict";

const INITIAL_VISIBLE = 4;

function Stars({ value }) {
  return (
    <span className="flex gap-0.5" aria-label={`${value} de 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={11} className={i < value ? "fill-accent-400 text-accent-400" : "text-neutral-600"} />
      ))}
    </span>
  );
}

function ReviewCard({ movie, onPick }) {
  const verdict = movie.recommend != null ? VERDICT[movie.recommend] : null;
  return (
    <button
      type="button"
      onClick={() => onPick(movie.id)}
      aria-label={`Abrir ${movie.title} y sus vecinas`}
      className="group flex gap-4 rounded-2xl border border-white/[0.08] bg-surface/60 p-4 text-left transition-colors hover:border-white/20 focus-ring-cinematic"
    >
      <MoviePosterCard movie={movie} size="sm" showBadge={false} />
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className="font-serif text-lg leading-tight text-white">{movie.title}</span>
        <span className="text-xs text-neutral-400">
          {[movie.release_year, movie.director].filter(Boolean).join(" · ")}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-300">
          {movie.rating ? <Stars value={movie.rating} /> : null}
          {verdict && (
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${verdict.dot}`} aria-hidden="true" />
              {verdict.label}
            </span>
          )}
        </span>
        <span className="line-clamp-3 font-serif text-[15px] italic leading-snug text-neutral-300">
          “{movie.review}”
        </span>
      </span>
    </button>
  );
}

/** @param {{ onPick: (id: number) => void }} props */
export default function CriterioSection({ onPick }) {
  const catalog = useCineStore((s) => s.rawGraph.nodes);
  const [expanded, setExpanded] = useState(false);

  const reviewed = useMemo(
    () =>
      catalog
        .filter((m) => m.review)
        .sort(
          (a, b) =>
            (b.rating || 0) - (a.rating || 0) ||
            (b.recommend ?? -2) - (a.recommend ?? -2) ||
            (b.release_year || 0) - (a.release_year || 0),
        ),
    [catalog],
  );

  if (catalog.length > 0 && reviewed.length === 0) return null;
  const visible = expanded ? reviewed : reviewed.slice(0, INITIAL_VISIBLE);

  return (
    <section className="mt-16 w-full text-left" aria-label="Mi criterio">
      <div className="mb-6 flex flex-col justify-between gap-1 border-b border-white/[0.08] pb-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Mi criterio</span>
          <h2 className="font-serif text-2xl sm:text-3xl font-normal text-white">Lo que tengo para decir</h2>
        </div>
        {reviewed.length > 0 && (
          <span className="text-xs text-neutral-400">{reviewed.length} reseñas, con nota y veredicto</span>
        )}
      </div>

      {catalog.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2" aria-label="Cargando reseñas">
          {Array.from({ length: INITIAL_VISIBLE }).map((_, i) => (
            <div key={i} className="h-[152px] rounded-2xl bg-white/[0.04] animate-shimmer" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {visible.map((movie) => (
              <ReviewCard key={movie.id} movie={movie} onPick={onPick} />
            ))}
          </div>
          {reviewed.length > INITIAL_VISIBLE && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-4 rounded-full border border-white/15 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-white/30 hover:text-white focus-ring-cinematic"
            >
              {expanded ? "Mostrar menos" : `Ver las ${reviewed.length} reseñas`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
