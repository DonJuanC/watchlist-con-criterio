// src/components/NextUpView.jsx
// Fase 2: "¿Qué veo hoy?" — de mi lista por ver (pendientes), lo que mejor encaja con lo
// que marqué 🟢, cada una con su razón. Opcional: escribir cómo te quieres sentir y buscar
// por sensación solo entre las pendientes. Tocar una abre su ficha debajo (las pendientes
// no están en el grafo, así que no tienen EgoView).

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
import { fetchNextUp, semanticSearch } from "../services/api";
import MovieInfo from "./MovieInfo";

const POSTER_BASE = "https://image.tmdb.org/t/p/w185";
const LIMIT = 6;

function Poster({ movie, className }) {
  const initial = (movie.title || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-neutral-800 ring-1 ring-white/20 transition group-hover:ring-emerald-400 group-focus-visible:ring-2 group-focus-visible:ring-emerald-400 ${className}`}
    >
      <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-neutral-400">
        {initial}
      </span>
      {movie.poster_path && (
        <img
          src={`${POSTER_BASE}${movie.poster_path}`}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export default function NextUpView() {
  // items: [{ node, because? }] — because solo existe en la lista por gusto (no por sensación).
  const [state, setState] = useState({
    status: "loading",
    items: [],
    error: "",
    offset: 0,
    hasMore: false,
  });
  const [mood, setMood] = useState("");
  const [activeMood, setActiveMood] = useState(""); // sensación aplicada ("" = por gusto)
  const [selectedId, setSelectedId] = useState(null);
  const requestIdRef = useRef(0); // descarta respuestas viejas
  const infoRef = useRef(null);

  // offset pagina el mismo ranking: "Otras opciones" pide las 6 siguientes.
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

  // Al abrir una ficha, llevarla a la vista.
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

  // Al final del ranking, vuelve al principio.
  const handleMore = () => load(activeMood, hasMore ? offset + LIMIT : 0);

  return (
    <section
      className="mx-auto flex w-full max-w-xl flex-col items-center px-4 pb-10 pt-6 text-center"
      aria-label="Qué ver hoy"
    >
      <h2 className="text-xl font-semibold text-white">¿Qué veo hoy?</h2>
      <p className="mt-1 max-w-sm text-sm text-neutral-400">
        {activeMood
          ? `De mi lista por ver, lo que más se acerca a “${activeMood}”.`
          : "De mi lista por ver, lo que mejor encaja con lo que más me gustó."}
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-5 flex w-full items-center gap-2 rounded-full border border-white/15 bg-neutral-900 px-4 py-2.5"
      >
        <Search size={16} className="shrink-0 text-neutral-400" />
        <input
          type="text"
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          placeholder="¿Cómo te quieres sentir? (opcional)"
          aria-label="Cómo te quieres sentir"
          autoComplete="off"
          className="flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-500"
        />
        {activeMood && (
          <button
            type="button"
            onClick={handleClearMood}
            aria-label="Quitar sensación y volver a la lista por gusto"
            className="rounded-full p-1 text-neutral-400 hover:bg-white/10 hover:text-white"
          >
            <X size={14} />
          </button>
        )}
      </form>

      {status === "loading" && (
        <p className="mt-8 inline-flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 size={16} className="animate-spin" />
          Buscando en mi lista…
        </p>
      )}

      {status === "error" && (
        <p className="mt-8 max-w-sm text-sm text-red-400">
          No pude armar la lista ahora mismo. Intenta de nuevo en unos segundos.
          <span className="mt-1 block text-xs text-neutral-500">{error}</span>
        </p>
      )}

      {status === "done" && items.length === 0 && (
        <p className="mt-8 max-w-sm text-sm text-neutral-400">
          No encontré nada en mi lista con esa idea. Prueba con otras palabras.
        </p>
      )}

      {status === "done" && items.length > 0 && (
        <div className="mt-8 grid w-full grid-cols-3 gap-x-2 gap-y-6">
          {items.map(({ node, because }) => (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedId((id) => (id === node.id ? null : node.id))}
              aria-pressed={selectedId === node.id}
              aria-label={`Ver ficha de ${node.title}`}
              className="group flex flex-col items-center focus:outline-none"
            >
              <Poster
                movie={node}
                className={`h-20 w-20 group-hover:scale-105 ${
                  selectedId === node.id ? "ring-2 ring-emerald-400" : ""
                }`}
              />
              <span className="mt-2 line-clamp-2 text-xs leading-tight text-neutral-100">
                {node.title}
              </span>
              {node.release_year && (
                <span className="mt-0.5 text-[10px] text-neutral-500">
                  {node.release_year}
                </span>
              )}
              {because?.length > 0 && (
                <span
                  title={`Porque me gustó ${because[0].title}`}
                  className="mt-1 line-clamp-2 max-w-full text-[10px] leading-tight text-emerald-400/90"
                >
                  Porque me gustó {because[0].title}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {status === "done" && items.length > 0 && (hasMore || offset > 0) && (
        <button
          type="button"
          onClick={handleMore}
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <RefreshCw size={14} />
          {hasMore ? "Otras opciones" : "Volver a las primeras"}
        </button>
      )}

      {selectedId != null && (
        <div
          ref={infoRef}
          className="mt-8 w-full scroll-mt-4 rounded-xl border border-white/10 bg-neutral-900/60 p-4 text-left"
        >
          <MovieInfo movieId={selectedId} />
        </div>
      )}
    </section>
  );
}
