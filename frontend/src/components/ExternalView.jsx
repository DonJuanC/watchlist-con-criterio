// src/components/ExternalView.jsx
// "Si te gustó X…" para cualquier película externa de TMDB comparada con el catálogo:
// Formato vertical 2:3, fondo ambiental cinemático y tarjetas con afinidad.

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, User, Check, RefreshCw, RotateCcw, Info, ChevronDown } from "lucide-react";
import { fetchRecommend } from "../services/api";
import useVisitorSeen, { markSeen, clearSeen } from "../hooks/useVisitorSeen";
import MoviePosterCard, { MovieCardSkeleton } from "./MoviePosterCard";
import BeyondSection from "./BeyondSection";
import MovieInfo from "./MovieInfo";

const REASON_LABEL = {
  same_director: "Mismo director",
  semantic_similarity: "Se siente parecida",
};

/**
 * @param {{ movie: { tmdb_id: number, title: string, release_year?: number, poster_path?: string },
 *           onPick: (id: number) => void }} props
 */
const NONE = [];

export default function ExternalView({ movie, onPick, onPickExternal, openInfo = false }) {
  const [showInfo, setShowInfo] = useState(openInfo);
  const [state, setState] = useState({ status: "loading", data: null, error: "" });
  const sectionRef = useRef(null);
  // Al llegar desde "Fuera de mi archivo" se reutiliza el mismo contenedor con scroll.
  useEffect(() => {
    sectionRef.current?.closest(".overflow-y-auto")?.scrollTo({ top: 0 });
  }, []);

  // "Otras opciones" (ids ya mostrados para ESTA película) + "Ya la vi" del visitante.
  const [pager, setPager] = useState({ tmdbId: movie.tmdb_id, shown: [] });
  const shown = pager.tmdbId === movie.tmdb_id ? pager.shown : NONE;
  const seen = useVisitorSeen();
  const exclude = useMemo(() => [...new Set([...seen, ...shown])], [seen, shown]);
  const excludeKey = exclude.join(",");

  useEffect(() => {
    let cancelled = false;
    // Al paginar dentro de la misma película se conservan las tarjetas actuales mientras carga.
    setState((prev) =>
      prev.data && prev.data.movie?.tmdb_id === movie.tmdb_id
        ? { ...prev, status: "refreshing" }
        : { status: "loading", data: null, error: "" },
    );
    fetchRecommend(movie.tmdb_id, excludeKey ? excludeKey.split(",").map(Number) : [])
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
  }, [movie.tmdb_id, onPick, excludeKey]);

  const refreshing = state.status === "refreshing";
  const recommendations = (state.data?.recommendations ?? []).filter(
    (r) => !exclude.includes(r.node.id),
  );
  const hasMore = Boolean(state.data?.hasMore) && !refreshing;
  const isPending = state.data?.source === "pending";
  const isDone = state.status === "done" || refreshing;
  const exhausted = state.status === "done" && recommendations.length === 0 && exclude.length > 0;

  const showMore = () =>
    setPager({ tmdbId: movie.tmdb_id, shown: [...shown, ...recommendations.map((r) => r.node.id)] });
  const restart = () => setPager({ tmdbId: movie.tmdb_id, shown: [] });

  return (
    <section
      ref={sectionRef}
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

      <button
        type="button"
        onClick={() => setShowInfo((v) => !v)}
        aria-expanded={showInfo}
        aria-controls="external-movie-info"
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-neutral-200 backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/10 hover:text-white focus-ring-cinematic"
      >
        <Info size={14} className="text-neutral-400" />
        Sobre esta película
        <ChevronDown size={14} className={`transition-transform duration-300 ${showInfo ? "rotate-180" : ""}`} />
      </button>
      {showInfo && (
        <div
          id="external-movie-info"
          className="mt-4 w-full rounded-2xl border border-white/10 bg-neutral-900/80 p-5 text-left backdrop-blur-xl shadow-2xl"
        >
          <MovieInfo tmdbId={movie.tmdb_id} />
        </div>
      )}

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

      {isDone && recommendations.length > 0 && (
        <div className="mt-8 w-full">
          <p className="font-serif text-base text-neutral-200 mb-6">
            De mi catálogo personal, te recomiendo:
          </p>
          <div className="grid w-full grid-cols-3 gap-x-3 gap-y-7 sm:gap-x-4">
            {recommendations.map((r) => {
              const isDirector = r.type === "same_director";
              return (
                <div key={r.node.id} className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => onPick(r.node.id)}
                  aria-label={`Abrir ${r.node.title}. ${REASON_LABEL[r.type] ?? "Conectada"}`}
                  className="group flex flex-col items-center focus-ring-cinematic rounded-xl p-1"
                >
                  <div className="transition-transform duration-300 group-hover:-translate-y-1">
                    <MoviePosterCard
                      movie={r.node}
                      size="md"
                      accentColor={isDirector ? "accent" : "neutral"}
                    />
                  </div>
                  <span className="mt-2.5 line-clamp-2 max-w-[120px] text-xs font-medium leading-snug text-neutral-200 group-hover:text-white transition-colors">
                    {r.node.title}
                  </span>
                  <span
                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium leading-none border ${
                      isDirector
                        ? "bg-accent-950/80 text-accent-300 border-accent-500/30"
                        : "bg-neutral-900/90 text-neutral-300 border-white/15"
                    }`}
                  >
                    {isDirector ? <User size={9} /> : <Sparkles size={9} />}
                    {REASON_LABEL[r.type] ?? "Conectada"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => markSeen(r.node.id)}
                  aria-label={`Ya vi ${r.node.title}: muéstrame otra`}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-neutral-400 transition-colors hover:bg-white/10 hover:text-white focus-ring-cinematic"
                >
                  <Check size={10} /> Ya la vi
                </button>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {(hasMore || refreshing) && (
              <button
                type="button"
                onClick={showMore}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-neutral-200 transition-all duration-200 hover:border-white/30 hover:bg-white/10 focus-ring-cinematic disabled:opacity-50"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                Otras opciones
              </button>
            )}
            {!hasMore && !refreshing && shown.length > 0 && (
              <button
                type="button"
                onClick={restart}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-neutral-200 transition-all duration-200 hover:border-white/30 hover:bg-white/10 focus-ring-cinematic"
              >
                <RotateCcw size={14} />
                Volver a empezar
              </button>
            )}
          </div>
        </div>
      )}

      {exhausted && (
        <div className="mt-8 max-w-sm">
          <p className="font-serif text-base text-neutral-200">
            Ya recorriste todo lo que tengo parecido a{" "}
            <span className="italic">{movie.title}</span>.
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Busca otra película que te haya gustado o vuelve a ver las opciones.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {shown.length > 0 && (
              <button
                type="button"
                onClick={restart}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-neutral-200 hover:border-white/30 hover:bg-white/10 focus-ring-cinematic"
              >
                <RotateCcw size={14} /> Volver a empezar
              </button>
            )}
            {seen.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  clearSeen();
                  restart();
                }}
                className="text-xs text-neutral-400 underline underline-offset-4 hover:text-neutral-200"
              >
                Desmarcar las que ya vi ({seen.length})
              </button>
            )}
          </div>
        </div>
      )}

      {(isDone || exhausted) && onPickExternal && (
        <BeyondSection
          seeds={[movie.tmdb_id]}
          label={movie.title}
          onPickExternal={onPickExternal}
          defaultOpen={exhausted}
        />
      )}

      {state.status === "done" && recommendations.length === 0 && exclude.length === 0 && (
        <p className="mt-8 max-w-sm text-sm text-neutral-400">
          No encontré películas parecidas entre lo que he visto en el catálogo.
        </p>
      )}
    </section>
  );
}
