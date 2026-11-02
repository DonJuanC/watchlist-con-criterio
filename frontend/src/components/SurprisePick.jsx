// src/components/SurprisePick.jsx
// "Sorpréndeme": para quien llega sin película en mente. Un botón (o un ánimo) y sale UNA
// película de mi archivo, con mi nota y la razón para verla. "Otra" no repite en la sesión;
// "Ya la vi" la saca para siempre en este navegador.

import { useRef, useState } from "react";
import { Dices, Check, ArrowRight, RefreshCw, Loader2, Star } from "lucide-react";
import { fetchSurprise } from "../services/api";
import useVisitorSeen, { markSeen } from "../hooks/useVisitorSeen";
import MoviePosterCard from "./MoviePosterCard";

// Las claves deben existir en MOODS de src/controllers/surpriseController.js
const MOODS = [
  { key: "pensar", label: "Para pensar" },
  { key: "reir", label: "Para reír" },
  { key: "adrenalina", label: "Adrenalina" },
  { key: "llorar", label: "Para llorar" },
  { key: "miedo", label: "Miedo" },
  { key: "culto", label: "Rara y de culto" },
];
const MOOD_LABEL = Object.fromEntries(MOODS.map((m) => [m.key, m.label]));

function clip(text, max = 220) {
  if (!text) return "";
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, "")}…` : t;
}

/** @param {{ onPick: (id: number) => void }} props */
export default function SurprisePick({ onPick }) {
  const seen = useVisitorSeen();
  const [state, setState] = useState({ status: "idle", movie: null, mood: null, error: "" });
  const shownRef = useRef([]); // ya sorteadas en esta visita: "Otra" no las repite
  const cardRef = useRef(null);
  const requestRef = useRef(0);

  const roll = async (mood, extraExclude = []) => {
    const req = ++requestRef.current;
    setState((s) => ({ ...s, status: "loading", mood, error: "" }));
    try {
      const exclude = [...new Set([...seen, ...shownRef.current, ...extraExclude])];
      let { movie } = await fetchSurprise(mood, exclude);
      if (!movie && shownRef.current.length) {
        // Se acabó la tanda: se vuelve a empezar sin repetir solo las que marcó como vistas.
        shownRef.current = [];
        ({ movie } = await fetchSurprise(mood, [...new Set([...seen, ...extraExclude])]));
      }
      if (req !== requestRef.current) return;
      if (movie) shownRef.current.push(movie.id);
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
              onClick={() => onPick(movie.id)}
              aria-label={`Abrir ${movie.title}`}
              className="shrink-0 self-start rounded-xl focus-ring-cinematic"
            >
              <MoviePosterCard movie={movie} size="md" showBadge={false} />
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-accent-300">
                {state.mood ? MOOD_LABEL[state.mood] : "Elegida al azar"} · de mi archivo
              </p>
              <h3 className="mt-1 font-serif text-xl font-semibold leading-tight text-white sm:text-2xl">
                {movie.title}
              </h3>
              <p className="mt-0.5 text-xs text-neutral-400">
                {[movie.release_year, movie.director && `Dir. ${movie.director}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {(movie.rating || movie.recommend === 1) && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-neutral-300">
                  {movie.rating && (
                    <span className="inline-flex items-center gap-0.5 text-accent-400">
                      <Star size={12} className="fill-current" /> {movie.rating}/5
                    </span>
                  )}
                  {movie.recommend === 1 && <span>· La recomiendo</span>}
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
                    markSeen(movie.id);
                    roll(state.mood, [movie.id]);
                  }}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-neutral-200 hover:border-white/30 hover:bg-white/10 focus-ring-cinematic disabled:opacity-50"
                >
                  <Check size={13} /> Ya la vi
                </button>
                <button
                  type="button"
                  onClick={() => onPick(movie.id)}
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium text-accent-300 hover:text-accent-200 focus-ring-cinematic"
                >
                  Dónde verla y parecidas <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </article>
        )}

        {state.status === "empty" && (
          <p className="mt-6 text-center text-sm text-neutral-400">
            Ya viste todo lo que tengo para ese ánimo. Prueba con otro.
          </p>
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
