// src/components/SurprisePick.jsx
// "Sorpréndeme": para quien llega sin película en mente. Un botón (o un ánimo) y sale UNA
// película de mi archivo, con mi nota y la razón para verla. "Otra" no repite en la sesión;
// "Ya la vi" la saca para siempre en este navegador.

import { useRef, useState } from "react";
import { Dices, Check, ArrowRight, RefreshCw, Loader2, Star, Compass } from "lucide-react";
import { fetchSurprise } from "../services/api";
import useVisitorSeen, {
  markSeen,
  markSeenExternal,
  useVisitorSeenExternal,
} from "../hooks/useVisitorSeen";
import MoviePosterCard from "./MoviePosterCard";
import { MOODS, MOOD_LABEL, nextUpQuery } from "../lib/moods";

// Sorpréndeme ofrece dos fuentes: la colección curada o exploración más allá.
const SOURCES = [
  { key: "archive", label: "En la colección" },
  { key: "beyond", label: "Más allá" },
];

function clip(text, max = 220) {
  if (!text) return "";
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, "")}…` : t;
}

/** Crítica en una línea: RT · IMDb (o la nota de TMDB si OMDb no la tiene). */
function CriticLine({ movie }) {
  const parts = [];
  if (movie.rt_score != null) parts.push(["RT", `${movie.rt_score}%`, "text-red-400"]);
  if (movie.imdb_rating != null) parts.push(["IMDb", Number(movie.imdb_rating).toFixed(1), "text-accent-400"]);
  if (!parts.length && movie.vote_average) parts.push(["TMDB", Number(movie.vote_average).toFixed(1), "text-sky-400"]);
  if (!parts.length) return null;
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-mono text-neutral-300" title="Crítica externa">
      {parts.map(([k, v, c]) => (
        <span key={k} className="inline-flex items-center gap-1 rounded border border-white/[0.08] px-1.5 py-0.5">
          <span className={`font-semibold ${c}`}>{k}</span> {v}
        </span>
      ))}
    </p>
  );
}

/**
 * @param {{ onPick: (id: number) => void, onPickExternal: (movie: object) => void,
 *           onMore?: (query: string) => void }} props
 *  onMore: abre "¿Qué veo hoy?" con el mismo ánimo y la misma fuente.
 */
export default function SurprisePick({ onPick, onPickExternal, onMore }) {
  const seen = useVisitorSeen();
  const seenExt = useVisitorSeenExternal();
  const [source, setSource] = useState("archive"); // de mi archivo o fuera de él
  const [state, setState] = useState({ status: "idle", movie: null, mood: null, error: "" });
  // ya sorteadas en esta visita: "Otra" no las repite (ids del catálogo / tmdb_id de fuera)
  const shownRef = useRef({ archive: [], beyond: [] });
  const cardRef = useRef(null);
  const requestRef = useRef(0);

  const roll = async (mood, extraExclude = [], src = source) => {
    const req = ++requestRef.current;
    setState((s) => ({ ...s, status: "loading", mood, error: "" }));
    const beyond = src === "beyond";
    const shown = shownRef.current[src];
    const ask = (withShown) => {
      const base = beyond ? seenExt : seen;
      const ex = [...new Set([...base, ...(withShown ? shown : []), ...extraExclude])];
      return beyond
        ? fetchSurprise(mood, [], { source: "beyond", excludeExt: ex })
        : fetchSurprise(mood, ex);
    };
    try {
      let { movie } = await ask(true);
      if (!movie && shown.length) {
        // Se acabó la tanda: se vuelve a empezar sin repetir solo las que marcó como vistas.
        shownRef.current[src] = [];
        ({ movie } = await ask(false));
      }
      if (req !== requestRef.current) return;
      if (movie) shownRef.current[src].push(beyond ? movie.tmdb_id : movie.id);
      setState({ status: movie ? "shown" : "empty", movie, mood, error: "" });
      requestAnimationFrame(() =>
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      );
    } catch (err) {
      if (req === requestRef.current)
        setState((s) => ({ ...s, status: "error", error: err.message }));
    }
  };

  const loading = state.status === "loading";
  const movie = state.movie;
  const isExternal = Boolean(movie?.external);

  const switchSource = (src) => {
    if (src === source) return;
    setSource(src);
    if (state.status !== "idle") roll(state.mood, [], src);
  };

  return (
    <section className="mt-8 w-full max-w-2xl" aria-label="Sorpréndeme">
      <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-[0.16em] text-neutral-400">
        <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
        ¿No sabes qué ver?
        <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
      </div>

      <div className="mt-4 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => roll(null)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl bg-accent-400 px-6 py-3 text-sm font-semibold text-neutral-950 shadow-surface-elevated transition-all hover:bg-accent-300 active:scale-95 focus-ring-cinematic disabled:opacity-70"
        >
          {loading && !state.mood ? <Loader2 size={16} className="animate-spin" /> : <Dices size={16} />}
          Sorpréndeme
        </button>

        <div
          className="-mx-4 flex w-[calc(100%+2rem)] flex-nowrap items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
          role="group"
          aria-label="O elige un ánimo"
        >
          {MOODS.map((m) => {
            const active = state.mood === m.key && state.status !== "idle";
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => roll(m.key)}
                disabled={loading}
                aria-pressed={active}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-all duration-150 active:scale-95 disabled:opacity-60 ${
                  active
                    ? "border-accent-400/70 bg-accent-950/40 text-accent-300"
                    : "border-white/[0.1] bg-white/[0.03] text-neutral-300 hover:border-white/25 hover:text-white"
                }`}
              >
                {loading && state.mood === m.key && (
                  <Loader2 size={11} className="mr-1 inline animate-spin" />
                )}
                {m.label}
              </button>
            );
          })}
        </div>

        <div
          role="radiogroup"
          aria-label="De dónde sale la sorpresa"
          className="inline-flex rounded-full border border-white/[0.1] bg-white/[0.03] p-0.5 text-[11px]"
        >
          {SOURCES.map((src) => (
            <button
              key={src.key}
              type="button"
              role="radio"
              aria-checked={source === src.key}
              onClick={() => switchSource(src.key)}
              disabled={loading}
              className={`rounded-full px-3 py-1 font-medium transition-all ${
                source === src.key
                  ? "bg-white/[0.12] text-white"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {src.key === "beyond" && <Compass size={11} className="mr-1 inline" />}
              {src.label}
            </button>
          ))}
        </div>
        {source === "beyond" && (
          <p className="-mt-1 text-[11px] text-neutral-400">
            Películas conectadas por estilo y temática con la colección. Con 50% o más en Rotten Tomatoes.
          </p>
        )}
      </div>

      <div ref={cardRef} className="scroll-mt-24">
        {movie && (state.status === "shown" || loading) && (
          <article
            className={`mt-6 flex gap-4 rounded-2xl border border-white/[0.1] bg-surface/80 p-4 text-left shadow-surface-elevated backdrop-blur-md transition-opacity sm:gap-5 sm:p-5 ${
              loading ? "opacity-60" : "opacity-100"
            }`}
            aria-live="polite"
          >
            <button
              type="button"
              onClick={() =>
                isExternal ? onPickExternal(movie, { openInfo: true }) : onPick(movie.id, { openInfo: true })
              }
              aria-label={`Abrir ${movie.title}`}
              className="shrink-0 self-start rounded-xl focus-ring-cinematic"
            >
              <MoviePosterCard movie={movie} size="md" showBadge={false} />
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-accent-300">
                {state.mood ? MOOD_LABEL[state.mood] : "Elegida al azar"} ·{" "}
                {isExternal ? "más allá de la colección" : "en la colección"}
              </p>
              <h3 className="mt-1 font-serif text-xl font-semibold leading-tight text-white sm:text-2xl">
                {movie.title}
              </h3>
              <p className="mt-0.5 text-xs text-neutral-400">
                {[movie.release_year, movie.director && `Dir. ${movie.director}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <CriticLine movie={movie} />
              {isExternal && movie.because?.length > 0 && (
                <p className="mt-2 text-xs text-neutral-300">
                  Aún sin reseña propia. Sugerida por su afinidad con{" "}
                  {movie.because.map((b) => b.title).join(" y ")}.
                </p>
              )}
              {!isExternal && (movie.rating || movie.recommend === 1) && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-neutral-300">
                  {movie.rating && (
                    <span className="inline-flex items-center gap-0.5 text-accent-400">
                      <Star size={12} className="fill-current" /> {movie.rating}/5
                    </span>
                  )}
                  {movie.recommend === 1 && <span>· Recomendada</span>}
                </p>
              )}
              <p className={`mt-2 text-sm leading-relaxed text-neutral-300 ${movie.review ? "italic" : ""}`}>
                {movie.review ? `“${clip(movie.review)}”` : clip(movie.overview, 180)}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => roll(state.mood)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-neutral-200 hover:border-white/30 hover:bg-white/10 focus-ring-cinematic disabled:opacity-50"
                >
                  <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Otra
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isExternal) {
                      markSeenExternal(movie.tmdb_id);
                      roll(state.mood, [movie.tmdb_id]);
                    } else {
                      markSeen(movie.id);
                      roll(state.mood, [movie.id]);
                    }
                  }}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-neutral-200 hover:border-white/30 hover:bg-white/10 focus-ring-cinematic disabled:opacity-50"
                >
                  <Check size={13} /> Ya la vi
                </button>
                <button
                  type="button"
                  onClick={() =>
                    isExternal
                      ? onPickExternal(movie, { openInfo: true })
                      : onPick(movie.id, { openInfo: true })
                  }
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium text-accent-300 hover:text-accent-200 focus-ring-cinematic"
                >
                  Ver ficha y parecidas{" "}
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </article>
        )}

        {onMore && (state.status === "shown" || state.status === "empty") && (
          <p className="mt-3 text-center text-xs text-neutral-400">
            ¿Prefieres elegir tú?{" "}
            <button
              type="button"
              onClick={() => onMore(nextUpQuery({ mood: state.mood, source }))}
              className="inline-flex items-center gap-1 font-medium text-accent-300 hover:text-accent-200 hover:underline focus-ring-cinematic rounded"
            >
              Ver más opciones{state.mood ? ` «${MOOD_LABEL[state.mood]}»` : ""}, por tus plataformas
              <ArrowRight size={12} />
            </button>
          </p>
        )}

        {state.status === "empty" && (
          <div className="mt-6 text-center">
            <p className="text-sm text-neutral-300">
              {source === "beyond"
                ? "No se encontraron más sugerencias para este ánimo."
                : "Ya viste todas las recomendaciones de la colección para este ánimo."}
            </p>
            {source === "archive" && (
              <button
                type="button"
                onClick={() => {
                  setSource("beyond");
                  roll(state.mood, [], "beyond");
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/25 px-4 py-2 text-xs font-medium text-neutral-200 hover:border-white/40 hover:text-white focus-ring-cinematic"
              >
                <Compass size={14} /> Explorar más allá
              </button>
            )}
          </div>
        )}
        {state.status === "error" && (
          <p className="mt-6 text-center text-sm text-red-400">
            No pude elegir una ahora mismo. Intenta de nuevo en unos segundos.
          </p>
        )}
      </div>
    </section>
  );
}
