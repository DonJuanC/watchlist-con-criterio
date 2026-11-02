// src/components/BeyondSection.jsx
// "Fuera de mi archivo": cuando lo mío se agota (o el visitante quiere ir más allá),
// sugerencias de TMDB a partir de películas de mi archivo. Siempre rotuladas como
// "no las he visto", para no mezclarlas con mi criterio.

import { useEffect, useMemo, useState } from "react";
import { Compass, Check, RefreshCw, Loader2, RotateCcw } from "lucide-react";
import { fetchBeyond } from "../services/api";
import { markSeenExternal, useVisitorSeenExternal } from "../hooks/useVisitorSeen";
import MoviePosterCard, { MovieCardSkeleton } from "./MoviePosterCard";

const NONE = [];

/**
 * @param {{
 *   seeds?: number[],      tmdb_id de partida
 *   seedIds?: number[],    ids del catálogo de partida (la órbita no tiene tmdb_id)
 *   label: string,         de qué parte ("Interstellar", "“amor”")
 *   query?: string,        la búsqueda por tema: el backend la usa como referencia semántica
 *   onPickExternal: (movie: object) => void,
 *   defaultOpen?: boolean,
 * }} props
 */
export default function BeyondSection({
  seeds = NONE,
  seedIds = NONE,
  label,
  query,
  onPickExternal,
  defaultOpen = false,
}) {
  const seedKey = `${seeds.join(",")}|${seedIds.join(",")}`;
  const [openFor, setOpenFor] = useState(defaultOpen ? seedKey : null);
  const open = openFor === seedKey || (defaultOpen && openFor === null);
  const seenExt = useVisitorSeenExternal();
  const [pager, setPager] = useState({ seedKey, shown: [] });
  const shown = pager.seedKey === seedKey ? pager.shown : NONE;
  const exclude = useMemo(() => [...new Set([...seenExt, ...shown])], [seenExt, shown]);
  const excludeKey = exclude.join(",");
  const [state, setState] = useState({ key: null, status: "idle", results: [], hasMore: false });
  const reqKey = `${seedKey}#${excludeKey}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState((s) => ({ ...s, status: s.results.length && s.key?.startsWith(seedKey) ? "refreshing" : "loading" }));
    fetchBeyond({ seeds, seedIds, query, exclude: excludeKey ? excludeKey.split(",").map(Number) : [] })
      .then((d) => {
        if (!cancelled)
          setState({ key: reqKey, status: "done", results: d.results ?? [], hasMore: Boolean(d.hasMore) });
      })
      .catch(() => {
        if (!cancelled) setState({ key: reqKey, status: "error", results: [], hasMore: false });
      });
    return () => {
      cancelled = true;
    };
    // seeds/seedIds están contenidos en seedKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reqKey]);

  if (!open) {
    return (
      <div className="mt-8 flex flex-col items-center gap-1 text-center">
        <button
          type="button"
          onClick={() => setOpenFor(seedKey)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/25 px-4 py-2 text-xs font-medium text-neutral-300 transition-all hover:border-white/40 hover:text-white focus-ring-cinematic"
        >
          <Compass size={14} /> Ver fuera de mi archivo
        </button>
        <span className="text-[11px] text-neutral-400">Sugerencias que no he visto, a partir de las mías</span>
      </div>
    );
  }

  const results = state.results.filter((r) => !exclude.includes(r.movie.tmdb_id));
  const loading = state.status === "loading";
  const refreshing = state.status === "refreshing";

  return (
    <section className="mt-12 w-full border-t border-dashed border-white/15 pt-8 text-center" aria-label="Fuera de mi archivo">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-400">
        <Compass size={12} /> Fuera de mi archivo
      </span>
      <h3 className="mt-1 font-serif text-xl text-white">Más allá de lo que he visto</h3>
      <p className="mx-auto mt-1 max-w-sm text-xs text-neutral-400">
        No las he visto: las sugiere TMDB a partir de {label} y de mis películas parecidas. Solo entran las que tienen 50% o más en Rotten Tomatoes.
      </p>

      {loading && (
        <div className="mt-6 grid grid-cols-3 gap-x-3 gap-y-6 sm:gap-x-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <MovieCardSkeleton size="md" />
              <div className="mt-2.5 h-3 w-20 rounded bg-white/10 animate-shimmer" />
            </div>
          ))}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className={`mt-6 grid grid-cols-3 gap-x-3 gap-y-7 sm:gap-x-4 transition-opacity ${refreshing ? "opacity-60" : ""}`}>
          {results.map(({ movie, because }) => (
            <div key={movie.tmdb_id} className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => onPickExternal(movie)}
                aria-label={`Ver qué de mi archivo se parece a ${movie.title}`}
                className="group flex flex-col items-center rounded-xl p-1 focus-ring-cinematic"
              >
                <div className="transition-transform duration-300 group-hover:-translate-y-1">
                  <MoviePosterCard movie={movie} size="md" showBadge={false} />
                </div>
                <span className="mt-2.5 line-clamp-2 max-w-[120px] text-xs font-medium leading-snug text-neutral-200 group-hover:text-white">
                  {movie.title}
                </span>
                {because?.[0] && (
                  <span className="mt-1 line-clamp-1 max-w-[120px] text-[10px] text-neutral-400">
                    por {because[0].title}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => markSeenExternal(movie.tmdb_id)}
                aria-label={`Ya vi ${movie.title}: muéstrame otra`}
                className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-neutral-400 hover:bg-white/10 hover:text-white focus-ring-cinematic"
              >
                <Check size={10} /> Ya la vi
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && state.status !== "error" && (
        <div className="mt-6 flex justify-center">
          {state.hasMore || refreshing ? (
            <button
              type="button"
              onClick={() => setPager({ seedKey, shown: [...shown, ...results.map((r) => r.movie.tmdb_id)] })}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-neutral-200 hover:border-white/30 hover:bg-white/10 focus-ring-cinematic disabled:opacity-50"
            >
              {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Otras opciones
            </button>
          ) : shown.length > 0 ? (
            <button
              type="button"
              onClick={() => setPager({ seedKey, shown: [] })}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-neutral-200 hover:border-white/30 hover:bg-white/10 focus-ring-cinematic"
            >
              <RotateCcw size={14} /> Volver a empezar
            </button>
          ) : results.length === 0 ? (
            <p className="text-xs text-neutral-400">No encontré más sugerencias por este lado. Prueba con otra película.</p>
          ) : null}
        </div>
      )}

      {state.status === "error" && (
        <p className="mt-6 text-xs text-red-400">No pude buscar fuera del archivo ahora. Intenta en unos segundos.</p>
      )}
    </section>
  );
}
