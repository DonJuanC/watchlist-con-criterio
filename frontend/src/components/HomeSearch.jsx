// src/components/HomeSearch.jsx
// Inicio: la tesis y el buscador arriba; debajo, Sorpréndeme para quien llega sin película
// en mente, el ejemplo de conexiones, mi criterio, los directores y la entrada a
// "¿Qué veo hoy?" con las plataformas del país del visitante.

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Search,
  Loader2,
  ChevronDown,
  Film,
  X,
  Sparkles,
  RotateCcw,
  Lock,
} from "lucide-react";
import { semanticSearch } from "../services/api";
import useCineStore from "../store/useCineStore";
import useTmdbSuggestions from "../hooks/useTmdbSuggestions";
import MoviePosterCard, { MovieCardSkeleton } from "./MoviePosterCard";
import SurprisePick from "./SurprisePick";
import BeyondSection from "./BeyondSection";
import LegalModal from "./LegalModal";
import ConnectionDemo from "./landing/ConnectionDemo";
import CriterioSection from "./landing/CriterioSection";
import NextUpBanner from "./landing/NextUpBanner";
import { SharedLink } from "./brand/BrandIcons";

const RESULTS_LIMIT = 6;
const SUGGESTIONS_LIMIT = 5;
const SUGGESTIONS_MIN_CHARS = 2;
const EXTERNAL_LIMIT = 4;

// Ejemplos clicables bajo el buscador: dos títulos del archivo y una sensación.
const SEARCH_EXAMPLES = [
  { label: "Parasite", title: "Parasite" },
  { label: "Interstellar", title: "Interstellar" },
  { label: "algo nostálgico", query: "nostalgia memoria pérdida recuerdos del pasado tiempo" },
];

function normalizeText(text) {
  return (text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function findCatalogSuggestions(nodes, rawQuery) {
  const q = normalizeText(rawQuery);
  if (q.length < SUGGESTIONS_MIN_CHARS) return [];
  const starts = [];
  const contains = [];
  const directorMatches = [];
  const genreMatches = [];

  for (const node of nodes) {
    const title = normalizeText(node.title);
    const director = normalizeText(node.director);
    const nodeGenres = Array.isArray(node.genres)
      ? node.genres.map(normalizeText)
      : [normalizeText(node.main_genre)].filter(Boolean);

    if (title.startsWith(q)) {
      starts.push(node);
    } else if (title.includes(q)) {
      contains.push(node);
    } else if (director && director.includes(q)) {
      directorMatches.push(node);
    } else if (nodeGenres.some((g) => g && g.includes(q))) {
      genreMatches.push(node);
    }
  }

  return [...starts, ...contains, ...directorMatches, ...genreMatches].slice(
    0,
    SUGGESTIONS_LIMIT,
  );
}

/**
 * @param {{
 *   onPick: (id: number) => void,
 *   onPickExternal: (movie: object) => void,
 *   onShowNextUp: (query?: string) => void,   query: "animo=reir&fuente=radar" (ver lib/moods.js)
 *   onShowMap: () => void,
 * }} props
 */
export default function HomeSearch({
  onPick,
  onPickExternal,
  onShowNextUp,
  onShowMap,
  onShowSelector,
  onShowAdmin,
}) {
  const catalog = useCineStore((s) => s.rawGraph.nodes);
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [results, setResults] = useState([]);
  const [heading, setHeading] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedDirector, setSelectedDirector] = useState(null);
  const [showLegal, setShowLegal] = useState(false);
  // "Ver más" de la búsqueda por tema: misma consulta, siguiente página.
  const [more, setMore] = useState({ query: "", hasMore: false, loading: false });
  const requestIdRef = useRef(0);

  // Directores clave con 4 o más películas en el catálogo
  const keyDirectors = useMemo(() => {
    if (!catalog || catalog.length === 0) return [];
    const counts = {};
    for (const m of catalog) {
      if (m.director) {
        counts[m.director] = (counts[m.director] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .filter(([, count]) => count >= 4)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [catalog]);

  // Películas del director seleccionado
  const directorMovies = useMemo(() => {
    if (!selectedDirector || !catalog) return [];
    return catalog.filter((m) => m.director === selectedDirector);
  }, [catalog, selectedDirector]);

  // Sugerencias de títulos, directores y géneros en vivo del catálogo
  const suggestions = useMemo(
    () => (suggestOpen ? findCatalogSuggestions(catalog, inputValue) : []),
    [catalog, inputValue, suggestOpen],
  );
  const showDropdown = suggestOpen && inputValue.trim().length >= 1;

  // Sugerencias externas de TMDB
  const { results: tmdbResults, loading: tmdbLoading } = useTmdbSuggestions(
    inputValue,
    suggestOpen,
  );
  const externalSuggestions = useMemo(() => {
    const shownIds = new Set(suggestions.map((m) => m.id));
    return tmdbResults
      .filter((r) => !(r.in_catalog && shownIds.has(r.in_catalog.id)))
      .slice(0, EXTERNAL_LIMIT);
  }, [tmdbResults, suggestions]);

  const semanticIndex = suggestions.length + externalSuggestions.length;

  const search = useCallback(async (query, label) => {
    const requestId = ++requestIdRef.current;
    setSuggestOpen(false);
    setStatus("loading");
    setErrorMsg("");
    setHeading(label);
    try {
      const data = await semanticSearch(query, RESULTS_LIMIT);
      if (requestId !== requestIdRef.current) return null;
      const rows = data.results ?? [];
      setResults(rows);
      setMore({ query, hasMore: Boolean(data.hasMore), loading: false });
      setStatus("done");
      return rows;
    } catch (err) {
      if (requestId !== requestIdRef.current) return null;
      setErrorMsg(err.message);
      setStatus("error");
      return null;
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!more.hasMore || more.loading) return;
    const requestId = requestIdRef.current; // una búsqueda nueva invalida esta página
    setMore((m) => ({ ...m, loading: true }));
    try {
      const data = await semanticSearch(more.query, RESULTS_LIMIT, "seen", results.length);
      if (requestId !== requestIdRef.current) return;
      const seenIds = new Set(results.map((r) => r.id));
      setResults((prev) => [...prev, ...(data.results ?? []).filter((r) => !seenIds.has(r.id))]);
      setMore((m) => ({ ...m, hasMore: Boolean(data.hasMore), loading: false }));
    } catch {
      if (requestId === requestIdRef.current) setMore((m) => ({ ...m, loading: false }));
    }
  }, [more, results]);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;
      search(trimmed, `“${trimmed}”`);
    },
    [inputValue, search],
  );

  const handlePickSuggestion = useCallback(
    (movie) => {
      setSuggestOpen(false);
      setActiveIndex(-1);
      setInputValue(movie.title);
      onPick(movie.id);
    },
    [onPick],
  );

  const handlePickExternal = useCallback(
    (movie) => {
      setSuggestOpen(false);
      setActiveIndex(-1);
      setInputValue(movie.title);
      if (movie.in_catalog?.status === "seen") onPick(movie.in_catalog.id);
      else onPickExternal(movie);
    },
    [onPick, onPickExternal],
  );

  const handleInputChange = useCallback((e) => {
    setInputValue(e.target.value);
    setSuggestOpen(true);
    setActiveIndex(-1);
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      const lastIndex = semanticIndex;
      if (e.key === "Escape") {
        setSuggestOpen(false);
        setActiveIndex(-1);
      } else if (e.key === "ArrowDown" && showDropdown) {
        e.preventDefault();
        setActiveIndex((i) => (i >= lastIndex ? 0 : i + 1));
      } else if (e.key === "ArrowUp" && showDropdown) {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? lastIndex : i - 1));
      } else if (
        e.key === "Enter" &&
        showDropdown &&
        activeIndex >= 0 &&
        activeIndex < semanticIndex
      ) {
        e.preventDefault();
        if (activeIndex < suggestions.length) {
          handlePickSuggestion(suggestions[activeIndex]);
        } else {
          handlePickExternal(externalSuggestions[activeIndex - suggestions.length]);
        }
      }
    },
    [
      suggestions,
      externalSuggestions,
      semanticIndex,
      showDropdown,
      activeIndex,
      handlePickSuggestion,
      handlePickExternal,
    ],
  );

  const handleMoodClick = useCallback(
    (mood) => {
      setInputValue(mood.label);
      search(mood.query, mood.label);
    },
    [search],
  );

  const handleExample = useCallback(
    (ex) => {
      if (ex.query) {
        handleMoodClick({ label: ex.label, query: ex.query });
        return;
      }
      const target = normalizeText(ex.title);
      const match = catalog.find((m) => normalizeText(m.title) === target);
      if (match) {
        onPick(match.id);
      } else {
        setInputValue(ex.title);
        setSuggestOpen(true);
      }
    },
    [catalog, handleMoodClick, onPick],
  );

  const handleReset = useCallback(() => {
    requestIdRef.current += 1;
    setInputValue("");
    setResults([]);
    setErrorMsg("");
    setSuggestOpen(false);
    setStatus("idle");
  }, []);

  const isLoading = status === "loading";
  const showResults = status === "done";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-24 pt-6 sm:pt-10 text-center">
      {/* 1. Hero: la tesis del producto y la acción principal arriba del fold */}
      {status === "idle" && (
        <header className="flex max-w-4xl flex-col items-center gap-4">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
            Una selección de{" "}
            <button
              type="button"
              onClick={onShowSelector}
              className="uppercase tracking-[0.14em] text-accent-400 underline decoration-accent-400/30 underline-offset-4 transition-colors hover:decoration-accent-400 focus-ring-cinematic rounded"
            >
              El Selector
            </button>{" "}
            ·{" "}
            <span className="tabular-nums">{catalog.length > 0 ? catalog.length : "casi 300"}</span> películas vistas
          </span>

          <h1 className="font-serif text-4xl sm:text-[3.5rem] font-normal tracking-tight text-white leading-[1.05] text-balance">
            Dime una película que te gustó.{" "}
            <span className="block text-neutral-300">Te digo cuál ver después.</span>
          </h1>

          <p className="mx-auto max-w-xl text-sm sm:text-base text-neutral-400 leading-relaxed">
            Cada película está conectada con otras por su atmósfera o su autoría.
            Con notas, veredictos y pistas para elegir bien.
          </p>
        </header>
      )}

      {/* 3. Buscador Cinéfilo y Selector de Atmósfera */}
      <div
        className="relative mt-8 w-full max-w-2xl"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setSuggestOpen(false);
            setActiveIndex(-1);
          }
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.12] bg-surface/90 px-5 py-4 shadow-surface-elevated transition-all duration-200 focus-within:border-accent-400/60"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-neutral-400" />
          ) : (
            <Search size={16} className="text-neutral-400" />
          )}
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Una película, o cómo te quieres sentir…"
            aria-label="Buscar película o atmósfera"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="home-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0
                ? activeIndex < suggestions.length
                  ? `suggestion-${suggestions[activeIndex]?.id}`
                  : `tmdb-${externalSuggestions[activeIndex - suggestions.length]?.tmdb_id}`
                : undefined
            }
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[15px] sm:text-base text-neutral-100 outline-none placeholder:text-neutral-400 font-sans"
          />
          {inputValue && (
            <button
              type="button"
              onClick={handleReset}
              aria-label="Limpiar búsqueda"
              className="rounded p-1 text-neutral-400 hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </form>

        {showDropdown && (
          <ul
            id="home-suggestions"
            role="listbox"
            onMouseDown={(e) => e.preventDefault()}
            className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-white/[0.08] bg-surface text-left shadow-2xl"
          >
            {suggestions.length > 0 && (
              <li role="presentation" className="px-4 pb-1 pt-3 text-[10px] font-mono uppercase tracking-[0.14em] text-neutral-400">
                En la colección ({suggestions.length})
              </li>
            )}
            {suggestions.map((movie, i) => (
              <li
                key={movie.id}
                id={`suggestion-${movie.id}`}
                role="option"
                aria-selected={activeIndex === i}
                onClick={() => handlePickSuggestion(movie)}
                onMouseMove={() => setActiveIndex(i)}
                className={`group flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors ${
                  activeIndex === i ? "bg-white/[0.06]" : ""
                }`}
              >
                <MoviePosterCard movie={movie} size="xs" showBadge={false} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-200 group-hover:text-white">
                    {movie.title}
                  </span>
                  <span className="block truncate text-xs text-neutral-400 font-mono text-[11px]">
                    {[movie.release_year, movie.director].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {movie.rating && (
                  <span className="text-[11px] text-accent-400/90 font-mono">
                    ★ {movie.rating}
                  </span>
                )}
              </li>
            ))}

            {(externalSuggestions.length > 0 || tmdbLoading) && (
              <li
                role="presentation"
                className={`flex items-center gap-2 px-4 pb-1 pt-3 text-[10px] font-mono uppercase tracking-[0.14em] text-neutral-400 ${
                  suggestions.length > 0 ? "mt-1 border-t border-white/[0.06]" : ""
                }`}
              >
                Explorar en todo el cine (TMDB)
                {tmdbLoading && <Loader2 size={11} className="animate-spin text-neutral-400" />}
              </li>
            )}
            {externalSuggestions.map((movie, j) => {
              const i = suggestions.length + j;
              return (
                <li
                  key={`tmdb-${movie.tmdb_id}`}
                  role="option"
                  aria-selected={activeIndex === i}
                  onClick={() => handlePickExternal(movie)}
                  onMouseMove={() => setActiveIndex(i)}
                  className={`group flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors ${
                    activeIndex === i ? "bg-white/[0.06]" : ""
                  }`}
                >
                  <MoviePosterCard movie={movie} size="xs" showBadge={false} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-neutral-200 group-hover:text-white">
                      {movie.title}
                    </span>
                    <span className="block truncate text-xs text-neutral-400 font-mono text-[11px]">
                      {movie.release_year || "Sin año"} · Base TMDB
                    </span>
                  </span>
                </li>
              );
            })}

            <li
              role="option"
              aria-selected={activeIndex === semanticIndex}
              onClick={() => search(inputValue.trim(), `“${inputValue.trim()}”`)}
              onMouseMove={() => setActiveIndex(semanticIndex)}
              className={`flex cursor-pointer items-center gap-3 px-4 py-3 ${
                semanticIndex > 0 || tmdbLoading ? "mt-1 border-t border-white/[0.06]" : ""
              } ${activeIndex === semanticIndex ? "bg-white/[0.06]" : ""}`}
            >
              <Sparkles size={15} className="shrink-0 text-accent-400/80" />
              <span className="min-w-0">
                <span className="block truncate text-sm text-neutral-100 font-medium">
                  Buscar por sensación: “{inputValue.trim()}”
                </span>
                <span className="block text-xs text-neutral-400">
                  Presiona Enter
                </span>
              </span>
            </li>
          </ul>
        )}
      </div>

      {status === "idle" && (
        <p className="mt-4 text-xs text-neutral-400">
          Prueba con{" "}
          {SEARCH_EXAMPLES.map((ex, i) => (
            <span key={ex.label}>
              {i > 0 && <span aria-hidden="true"> · </span>}
              <button
                type="button"
                onClick={() => handleExample(ex)}
                className="text-neutral-300 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-accent-400/60 focus-ring-cinematic rounded"
              >
                {ex.label}
              </button>
            </span>
          ))}
        </p>
      )}

      {/* 3b. Sin película en mente: una sola, al azar o por ánimo */}
      {status === "idle" && <SurprisePick onPick={onPick} onPickExternal={onPickExternal} onMore={onShowNextUp} />}

      {/* 4. Así funciona (ejemplo real) y Mi criterio (reseñas) */}
      {status === "idle" && <ConnectionDemo onPick={onPick} />}
      {status === "idle" && <CriterioSection onPick={onPick} />}

      {/* 5. SECCIÓN EDITORIAL: CICLOS DE DIRECTORES CLAVE */}
      {status === "idle" && keyDirectors.length > 0 && (
        <section className="mt-14 w-full text-left" aria-label="Ciclos de directores clave">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-end justify-between border-b border-white/[0.06] pb-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-400">
                Filmografías
              </span>
              <h3 className="font-serif text-xl sm:text-2xl font-normal text-white mt-0.5">
                Directores de Cabecera
              </h3>
            </div>
            {selectedDirector && (
              <button
                type="button"
                onClick={() => setSelectedDirector(null)}
                className="text-[11px] font-mono text-neutral-400 hover:text-white transition-colors mt-1 sm:mt-0"
              >
                Cerrar ciclo de {selectedDirector}
              </button>
            )}
          </div>

          {/* Directores: tarjetas con sus pósters apilados */}
          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {keyDirectors.slice(0, 6).map(({ name, count }) => {
              const isSelected = selectedDirector === name;
              const posters = catalog.filter((m) => m.director === name && m.poster_path).slice(0, 3);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedDirector(isSelected ? null : name)}
                  aria-pressed={isSelected}
                  className={`group flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors focus-ring-cinematic ${
                    isSelected
                      ? "border-accent-400/60 bg-accent-950/30"
                      : "border-white/[0.08] bg-surface/50 hover:border-white/20"
                  }`}
                >
                  <span className="relative h-12 w-14 shrink-0" aria-hidden="true">
                    {posters.map((m, i) => (
                      <img
                        key={m.id}
                        src={`https://image.tmdb.org/t/p/w92${m.poster_path}`}
                        alt=""
                        loading="lazy"
                        className="absolute top-0 h-12 w-8 rounded-[3px] object-cover shadow-poster"
                        style={{ left: `${i * 10}px`, zIndex: 3 - i }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">{name}</span>
                    <span className="block text-xs text-neutral-400">{count} películas</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Shelf de Películas del Director Seleccionado */}
          {selectedDirector && directorMovies.length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-surface/60 p-4 mb-6">
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-neutral-400 mb-3">
                Películas de {selectedDirector} en la colección:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {directorMovies.map((movie) => (
                  <button
                    key={movie.id}
                    type="button"
                    onClick={() => onPick(movie.id)}
                    aria-label={`Abrir constelación de ${movie.title}`}
                    className="group flex flex-col items-center text-center focus-ring-cinematic rounded-lg p-1"
                  >
                    <MoviePosterCard movie={movie} size="sm" showBadge={false} />
                    <span className="mt-1.5 line-clamp-1 max-w-[100px] text-xs font-medium text-neutral-200 group-hover:text-white transition-colors">
                      {movie.title}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400">
                      {movie.release_year}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 5b. Salida alternativa: qué ver hoy con las plataformas del visitante */}
      {status === "idle" && <NextUpBanner onOpen={() => onShowNextUp()} />}

      {/* 6. ESTADO DE RESULTADOS DE BÚSQUEDA */}
      {isLoading && (
        <section className="mt-10 w-full" aria-label="Buscando conexiones">
          <p className="font-serif text-lg font-medium text-neutral-200">{heading || "Buscando conexiones..."}</p>
          <p className="mb-6 text-xs text-neutral-400">
            Calculando afinidad por temática, atmósfera y autoría...
          </p>
          <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:gap-x-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <MovieCardSkeleton size="md" />
                <div className="mt-2.5 h-3 w-20 rounded bg-white/10 animate-shimmer" />
                <div className="mt-1 h-2.5 w-12 rounded bg-white/5 animate-shimmer" />
              </div>
            ))}
          </div>
        </section>
      )}

      {showResults && results.length > 0 && (
        <section className="mt-8 w-full" aria-label="Resultados de búsqueda">
          <div className="mb-6 text-center border-b border-white/[0.06] pb-4">
            <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-400">
              Conexiones temáticas
            </span>
            <h2 className="font-serif text-2xl font-normal text-white mt-1">{heading}</h2>
            <p className="mt-1 text-xs text-neutral-400">
              {results.length}
              {more.hasMore ? "+" : ""}{" "}
              {results.length === 1 ? "obra conectada" : "obras conectadas"} por atmósfera y temática. Selecciona una para abrir su constelación completa.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:gap-x-4">
            {results.map((movie) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => onPick(movie.id)}
                aria-label={`Abrir constelación de ${movie.title}`}
                className="group flex flex-col items-center focus-ring-cinematic rounded-lg p-1"
              >
                <div className="transition-transform duration-300">
                  <MoviePosterCard movie={movie} size="md" showBadge={false} />
                </div>
                <span className="mt-2.5 line-clamp-2 max-w-[120px] text-xs font-medium leading-snug text-neutral-200 group-hover:text-white transition-colors">
                  {movie.title}
                </span>
                <span className="mt-0.5 text-[11px] font-mono text-neutral-400">
                  {[movie.release_year, movie.director].filter(Boolean).join(" · ")}
                </span>
              </button>
            ))}
          </div>

          {more.hasMore ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={more.loading}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs font-medium text-neutral-200 transition-all hover:border-white/30 hover:bg-white/10 focus-ring-cinematic disabled:opacity-50"
              >
                {more.loading ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                Ver más
              </button>
            </div>
          ) : (
            results.length > RESULTS_LIMIT && (
              <p className="mt-8 text-center text-xs text-neutral-400">
                Son todas las obras de la colección que encajan con {heading}.
              </p>
            )
          )}

          {/* Se acabó lo que encaja en la colección: el puente hacia afuera */}
          {!more.hasMore && (
            <BeyondSection
              seeds={results.slice(0, 4).map((r) => r.tmdb_id).filter(Boolean)}
              label={heading}
              query={more.query}
              onPickExternal={onPickExternal}
              defaultOpen
            />
          )}

          <button
            type="button"
            onClick={handleReset}
            className="mt-10 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs text-neutral-300 transition-colors hover:border-white/20 hover:text-white focus-ring-cinematic"
          >
            <RotateCcw size={13} />
            <span>Volver al inicio</span>
          </button>
        </section>
      )}

      {showResults && results.length === 0 && (
        <div className="mt-10 max-w-sm text-center">
          <p className="text-sm text-neutral-300 font-medium">
            No encontré conexiones directas para esa búsqueda.
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            Prueba con otra sensación o selecciona una obra de la colección.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs text-neutral-300 transition-colors hover:border-white/20 hover:text-white focus-ring-cinematic"
          >
            <RotateCcw size={13} />
            <span>Volver</span>
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="mt-8 max-w-sm text-center">
          <p className="text-sm text-red-400 font-medium">
            No pudimos buscar en este momento. Intenta de nuevo en unos segundos.
          </p>
          {errorMsg && (
            <p className="mt-1 text-xs text-neutral-400 font-mono">{errorMsg}</p>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs text-neutral-300 transition-colors hover:border-white/20 hover:text-white focus-ring-cinematic"
          >
            <RotateCcw size={13} />
            <span>Volver al inicio</span>
          </button>
        </div>
      )}

      {/* 7. Mapa global y Sello de Sala del Archivo */}
      <footer className="mt-20 pt-8 border-t border-white/[0.06] w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400 font-mono">
        <button
          type="button"
          onClick={onShowMap}
          className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 text-xs font-medium text-neutral-300 hover:border-white/20 hover:text-white active:scale-95 focus-ring-cinematic transition-all"
        >
          <Film size={13} className="text-accent-400" />
          <span>Ver mapa de conexiones completo</span>
        </button>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-neutral-400 sm:justify-end">
          <a
            href="https://musicaconcriterio.com"
            target="_blank"
            rel="noopener noreferrer"
            title="Ir a Música con Criterio"
            className="inline-flex items-center gap-1.5 uppercase tracking-[0.14em] text-neutral-400 hover:text-white transition-colors focus-ring-cinematic"
          >
            <SharedLink size={13} className="text-accent-400" />
            <span>Música con Criterio</span>
          </a>
          <span className="text-neutral-700 hidden sm:inline">·</span>
          <button type="button" onClick={onShowSelector} className="uppercase tracking-[0.14em] hover:text-white transition-colors focus-ring-cinematic">
            Quién elige
          </button>
          <button type="button" onClick={() => setShowLegal(true)} className="uppercase tracking-[0.14em] hover:text-white transition-colors focus-ring-cinematic">
            Aviso legal
          </button>
          <span>Datos TMDB</span>
          <span className="text-neutral-700 hidden sm:inline">·</span>
          <a
            href="#/admin"
            onClick={(e) => {
              e.preventDefault();
              if (onShowAdmin) onShowAdmin();
              else window.location.hash = "#/admin";
            }}
            title="Acceso de administración (Criterio Studio)"
            className="inline-flex items-center gap-1 uppercase tracking-[0.14em] text-neutral-400 hover:text-white transition-colors focus-ring-cinematic"
          >
            <Lock size={11} className="text-neutral-400" />
            <span>Admin</span>
          </a>
        </div>
        <LegalModal isOpen={showLegal} onClose={() => setShowLegal(false)} />
      </footer>
    </main>
  );
}
