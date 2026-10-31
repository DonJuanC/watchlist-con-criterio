// src/components/ExternalView.jsx
// "Si te gustó X…" para cualquier película externa de TMDB comparada con el catálogo:
// Formato vertical 2:3, fondo ambiental cinemático y tarjetas con afinidad.

import { useEffect, useState } from "react";
import { Sparkles, User } from "lucide-react";
import { fetchRecommend } from "../services/api";
import MoviePosterCard, { MovieCardSkeleton } from "./MoviePosterCard";

const REASON_LABEL = {
  same_director: "Mismo director",
  semantic_similarity: "Se siente parecida",
};

/**
 * @param {{ movie: { tmdb_id: number, title: string, release_year?: number, poster_path?: string },
 *           onPick: (id: number) => void }} props
 */
export default function ExternalView({ movie, onPick }) {
  const [state, setState] = useState({ status: "loading", data: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null, error: "" });
    fetchRecommend(movie.tmdb_id)
      .then((data) => {
        if (cancelled) return;
        if (data.source === "catalog") {
          onPick(data.movieId);
          return;
        }
        setState({ status: "done", data, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: "error", data: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [movie.tmdb_id, onPick]);

  const recommendations = state.data?.recommendations ?? [];
  const isPending = state.data?.source === "pending";

  return (
    <section
      className="relative mx-auto flex w-full max-w-xl flex-col items-center px-4 pb-16 pt-4 text-center"
      aria-label={`Recomendaciones si te gustó ${movie.title}`}
    >
      <div className="mb-2">
        <MoviePosterCard movie={movie} size="lg" />
      </div>

      <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-white leading-tight mt-2">
        Si te gustó <span className="italic">{movie.title}</span>
      </h2>
      <p className="text-xs sm:text-sm text-neutral-400 mt-1">
        {[movie.release_year, isPending && "En mi lista de pendientes"]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {state.status === "loading" && (
        <div className="mt-8 w-full">
          <p className="font-serif text-sm text-neutral-300 mb-5">
            Comparando atmósferas y temáticas con lo que he visto...
          </p>
          <div className="grid w-full grid-cols-3 gap-x-3 gap-y-6 sm:gap-x-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <MovieCardSkeleton size="md" />
                <div className="mt-2.5 h-3 w-20 rounded bg-white/10 animate-shimmer" />
                <div className="mt-1 h-2.5 w-14 rounded bg-white/5 animate-shimmer" />
              </div>
            ))}
          </div>
        </div>
      )}

      {state.status === "error" && (
        <p className="mt-8 max-w-sm text-sm text-red-400">
          No pude armar la recomendación ahora mismo. Intenta de nuevo en unos segundos.
          <span className="mt-1 block text-xs text-neutral-400">{state.error}</span>
        </p>
      )}

      {state.status === "done" && recommendations.length > 0 && (
        <div className="mt-8 w-full">
          <p className="font-serif text-base text-neutral-200 mb-6">
            De mi catálogo personal, te recomiendo:
          </p>
          <div className="grid w-full grid-cols-3 gap-x-3 gap-y-7 sm:gap-x-4">
            {recommendations.map((r) => {
              const isDirector = r.type === "same_director";
              return (
                <button
                  key={r.node.id}
                  type="button"
                  onClick={() => onPick(r.node.id)}
                  aria-label={`Abrir ${r.node.title}. ${REASON_LABEL[r.type] ?? "Conectada"}`}
                  className="group flex flex-col items-center focus-ring-cinematic rounded-xl p-1"
                >
                  <div className="transition-transform duration-300 group-hover:-translate-y-1">
                    <MoviePosterCard
                      movie={r.node}
                      size="md"
                      accentColor={isDirector ? "amber" : "neutral"}
                    />
                  </div>
                  <span className="mt-2.5 line-clamp-2 max-w-[120px] text-xs font-medium leading-snug text-neutral-200 group-hover:text-white transition-colors">
                    {r.node.title}
                  </span>
                  <span
                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium leading-none border ${
                      isDirector
                        ? "bg-amber-950/80 text-amber-300 border-amber-500/30"
                        : "bg-neutral-900/90 text-neutral-300 border-white/15"
                    }`}
                  >
                    {isDirector ? <User size={9} /> : <Sparkles size={9} />}
                    {REASON_LABEL[r.type] ?? "Conectada"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {state.status === "done" && recommendations.length === 0 && (
        <p className="mt-8 max-w-sm text-sm text-neutral-400">
          No encontré películas parecidas entre lo que he visto en el catálogo.
        </p>
      )}
    </section>
  );
}
