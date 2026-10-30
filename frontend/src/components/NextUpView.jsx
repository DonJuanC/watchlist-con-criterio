// src/components/NextUpView.jsx
// Fase 2: "¿Qué veo hoy?" — recomendador cinéfilo sobre la lista de pendientes:
// Formato vertical 2:3, razones de afinidad destacadas como sellos de recomendación,
// y esqueletos de carga animados.

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Search, X, Popcorn } from "lucide-react";
import { fetchNextUp, semanticSearch } from "../services/api";
import MovieInfo from "./MovieInfo";
import MoviePosterCard, { MovieCardSkeleton } from "./MoviePosterCard";

const LIMIT = 6;

export default function NextUpView() {
  const [state, setState] = useState({
    status: "loading",
    items: [],
    error: "",
    offset: 0,
    hasMore: false,
  });
  const [mood, setMood] = useState("");
  const [activeMood, setActiveMood] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const requestIdRef = useRef(0);
  const infoRef = useRef(null);

  const load = useCallback(async (moodText, offset = 0) => {
    const requestId = ++requestIdRef.current;
    setState((s) => ({ ...s, status: "loading", error: "" }));
    setSelectedId(null);
    setActiveMood(moodText);
    try {
      let items;
      let data;
      if (moodText) {
        data = await semanticSearch(moodText, LIMIT, "pending", offset);
        items = (data.results ?? []).map((node) => ({ node }));
      } else {
        data = await fetchNextUp(LIMIT, offset);
        items = data.results ?? [];
      }
      if (requestId !== requestIdRef.current) return;
      setState({ status: "done", items, error: "", offset, hasMore: Boolean(data.hasMore) });
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setState({ status: "error", items: [], error: err.message, offset, hasMore: false });
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  useEffect(() => {
    if (selectedId != null) {
      infoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    load(mood.trim());
  };

  const handleClearMood = () => {
    setMood("");
    load("");
  };

  const { status, items, error, offset, hasMore } = state;

  const handleMore = () => load(activeMood, hasMore ? offset + LIMIT : 0);

  return (
    <section
      className="mx-auto flex w-full max-w-xl flex-col items-center px-4 pb-16 pt-4 text-center"
      aria-label="Qué ver hoy"
    >
      <div className="space-y-2 mb-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-300 backdrop-blur-sm">
          <Popcorn size={13} className="text-emerald-400" />
          <span>Curaduría de tu lista de pendientes</span>
        </div>
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-white">
          ¿Qué veo hoy?
        </h2>
        <p className="mx-auto max-w-md text-xs sm:text-sm text-neutral-400">
          {activeMood
            ? `Pendientes que más se acercan a “${activeMood}”.`
            : "Pendientes que mejor encajan con tus películas mejor valoradas del catálogo."}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex w-full items-center gap-2 rounded-full border border-white/15 bg-neutral-900/90 px-4 py-2.5 shadow-xl backdrop-blur-md transition-all focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20"
      >
        <Search size={16} className="shrink-0 text-neutral-400" />
        <input
          type="text"
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          placeholder="¿Cómo te quieres sentir? (ej. ciencia ficción existencial)"
          aria-label="Cómo te quieres sentir"
          autoComplete="off"
          className="flex-1 bg-transparent text-xs sm:text-sm text-neutral-100 outline-none placeholder:text-neutral-500"
        />
        {activeMood && (
          <button
            type="button"
            onClick={handleClearMood}
            aria-label="Quitar sensación y volver a la lista por gusto"
            className="rounded-full p-1 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </form>

      {status === "loading" && (
        <div className="mt-8 grid w-full grid-cols-3 gap-x-3 gap-y-6 sm:gap-x-4" aria-label="Cargando recomendaciones">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <MovieCardSkeleton size="md" />
              <div className="mt-2.5 h-3 w-20 rounded bg-white/10 animate-shimmer" />
              <div className="mt-1 h-2.5 w-14 rounded bg-white/5 animate-shimmer" />
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <p className="mt-8 max-w-sm text-sm text-red-400">
          No pude armar la lista ahora mismo. Intenta de nuevo en unos segundos.
          <span className="mt-1 block text-xs text-neutral-500">{error}</span>
        </p>
      )}

      {status === "done" && items.length === 0 && (
        <p className="mt-8 max-w-sm text-sm text-neutral-400">
          No encontré películas en tu lista con esa atmósfera. Prueba con otras palabras.
        </p>
      )}

      {status === "done" && items.length > 0 && (
        <div className="mt-8 grid w-full grid-cols-3 gap-x-3 gap-y-7 sm:gap-x-4">
          {items.map(({ node, because }) => {
            const isSelected = selectedId === node.id;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedId((id) => (id === node.id ? null : node.id))}
                aria-pressed={isSelected}
                aria-label={`Ver ficha de ${node.title}`}
                className="group flex flex-col items-center focus:outline-none"
              >
                <div className={`transition-all duration-300 ${isSelected ? "scale-105" : "group-hover:-translate-y-1"}`}>
                  <MoviePosterCard
                    movie={node}
                    size="md"
                    selected={isSelected}
                    accentColor="emerald"
                  />
                </div>
                <span className="mt-2.5 line-clamp-2 max-w-[120px] text-xs font-medium leading-snug text-neutral-200 group-hover:text-emerald-300 transition-colors">
                  {node.title}
                </span>
                {node.release_year && (
                  <span className="mt-0.5 text-[11px] text-neutral-500">
                    {node.release_year}
                  </span>
                )}
                {because?.length > 0 && (
                  <span
                    title={`Afinidad con ${because[0].title}`}
                    className="mt-1.5 flex items-center justify-center gap-1 max-w-[120px] rounded-full bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-medium leading-tight text-emerald-300"
                  >
                    <span className="block h-1 w-1 rounded-full bg-emerald-400 shrink-0" />
                    <span className="truncate">{because[0].title}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {status === "done" && items.length > 0 && (hasMore || offset > 0) && (
        <button
          type="button"
          onClick={handleMore}
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs font-medium text-neutral-200 backdrop-blur-md transition-all hover:border-emerald-500/40 hover:bg-white/10 hover:text-white"
        >
          <RefreshCw size={13} className="text-emerald-400" />
          {hasMore ? "Ver otras 6 opciones" : "Volver a las primeras"}
        </button>
      )}

      {selectedId != null && (
        <div
          ref={infoRef}
          className="mt-8 w-full scroll-mt-4 rounded-2xl border border-white/10 bg-neutral-900/80 p-5 text-left shadow-2xl backdrop-blur-xl transition-all"
        >
          <MovieInfo movieId={selectedId} />
        </div>
      )}
    </section>
  );
}
