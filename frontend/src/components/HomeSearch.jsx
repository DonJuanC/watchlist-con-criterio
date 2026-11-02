// src/components/HomeSearch.jsx
// Inicio: la tesis y el buscador arriba; debajo, Sorpréndeme para quien llega sin película
// en mente, el ejemplo de conexiones, mi criterio, los directores y la entrada a
// "¿Qué veo hoy?" con las plataformas del país del visitante.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Loader2,
  ChevronDown,
  Film,
  X,
  Sparkles,
  RotateCcw,
  Lock,
  User,
  ArrowRight,
} from "lucide-react";
import { semanticSearch, fetchDirectorFilmography } from "../services/api";
import useCineStore from "../store/useCineStore";
import useTmdbSuggestions from "../hooks/useTmdbSuggestions";
import MoviePosterCard, { MovieCardSkeleton } from "./MoviePosterCard";
import SurprisePick from "./SurprisePick";
import BeyondSection from "./BeyondSection";
import LegalModal from "./LegalModal";
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

function findMatchingDirectors(nodes, rawQuery) {
  const q = normalizeText(rawQuery);
  if (q.length < SUGGESTIONS_MIN_CHARS) return [];
  const map = new Map();
  for (const node of nodes) {
    if (!node.director) continue;
    const norm = normalizeText(node.director);
    if (norm.includes(q)) {
      map.set(node.director, (map.get(node.director) || 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 2);
}

function findCatalogSuggestions(nodes, rawQuery) {
  const q = normalizeText(rawQuery);
  if (q.length < SUGGESTIONS_MIN_CHARS) return [];
  const starts = [];
  const contains = [];
  const genreMatches = [];

  for (const node of nodes) {
    const title = normalizeText(node.title);
    const nodeGenres = Array.isArray(node.genres)
      ? node.genres.map(normalizeText)
      : [normalizeText(node.main_genre)].filter(Boolean);

    if (title.startsWith(q)) {
      starts.push(node);
    } else if (title.includes(q)) {
      contains.push(node);
    } else if (nodeGenres.some((g) => g && g.includes(q))) {
      genreMatches.push(node);
    }
  }

  return [...starts, ...contains, ...genreMatches].slice(
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
  initialDirector,
  onPick,
  onPickExternal,
  onShowNextUp,
  onShowMap,
  onShowSelector,
  onShowHowItWorks,
  onShowAdmin,
}) {
  const catalog = useCineStore((s) => s.rawGraph.nodes);
  const [inputValue, setInputValue] = useState(initialDirector || "");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [results, setResults] = useState([]);
  const [heading, setHeading] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedDirector, setSelectedDirector] = useState(initialDirector || null);
  const [showLegal, setShowLegal] = useState(false);
  // "Ver más" de la búsqueda por tema: misma consulta, siguiente página.
  const [more, setMore] = useState({ query: "", hasMore: false, loading: false });
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (initialDirector) {
      setSelectedDirector(initialDirector);
      setInputValue(initialDirector);
      setStatus("idle");
    }
  }, [initialDirector]);

  // Películas del director seleccionado ordenadas cronológicamente
  const directorMovies = useMemo(() => {
    if (!selectedDirector || !catalog) return [];
    return catalog
      .filter((m) => m.director === selectedDirector)
      .sort((a, b) => (a.release_year || 0) - (b.release_year || 0));
  }, [catalog, selectedDirector]);

  // Consulta extendida de filmografía en TMDB
  const [directorTmdb, setDirectorTmdb] = useState({ loading: false, director: null, external: [] });
  useEffect(() => {
    if (!selectedDirector) {
      setDirectorTmdb({ loading: false, director: null, external: [] });
      return;
    }
    let cancelled = false;
    setDirectorTmdb((prev) => ({ ...prev, loading: true }));
    fetchDirectorFilmography(selectedDirector)
      .then((data) => {
        if (!cancelled) {
          setDirectorTmdb({
            loading: false,
            director: data.director,
            external: data.external || [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDirectorTmdb({ loading: false, director: null, external: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDirector]);

  // Directores que coinciden con el texto escrito
  const matchingDirectors = useMemo(
    () => (suggestOpen ? findMatchingDirectors(catalog, inputValue) : []),
    [catalog, inputValue, suggestOpen],
  );

  // Sugerencias de títulos y géneros en vivo del catálogo
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

  const semanticIndex = matchingDirectors.length + suggestions.length + externalSuggestions.length;

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

  const handlePickDirector = useCallback((directorName) => {
    setSuggestOpen(false);
    setActiveIndex(-1);
    setInputValue(directorName);
    setSelectedDirector(directorName);
    window.location.hash = `#/director/${encodeURIComponent(directorName)}`;
    setStatus("idle");
    setResults([]);
  }, []);

  const handleCloseDirector = useCallback(() => {
    setSelectedDirector(null);
    setInputValue("");
    if (window.location.hash.startsWith("#/director/")) {
      window.location.hash = "#/";
    }
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;
      const qNorm = normalizeText(trimmed);
      const matchedDir = matchingDirectors.find(
        (d) => normalizeText(d.name) === qNorm || normalizeText(d.name).includes(qNorm),
      );
      if (matchedDir) {
        handlePickDirector(matchedDir.name);
        return;
      }
      setSelectedDirector(null);
      search(trimmed, `“${trimmed}”`);
    },
    [inputValue, matchingDirectors, handlePickDirector, search],
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
        activeIndex <= semanticIndex
      ) {
        e.preventDefault();
        const dirLen = matchingDirectors.length;
        const suggLen = suggestions.length;
        if (activeIndex < dirLen) {
          handlePickDirector(matchingDirectors[activeIndex].name);
        } else if (activeIndex < dirLen + suggLen) {
          handlePickSuggestion(suggestions[activeIndex - dirLen]);
        } else if (activeIndex < semanticIndex) {
          handlePickExternal(externalSuggestions[activeIndex - dirLen - suggLen]);
        } else if (activeIndex === semanticIndex) {
          search(inputValue.trim(), `“${inputValue.trim()}”`);
        }
      }
    },
    [
      matchingDirectors,
      suggestions,
      externalSuggestions,
      semanticIndex,
      showDropdown,
      activeIndex,
      inputValue,
      handlePickDirector,
      handlePickSuggestion,
      handlePickExternal,
      search,
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
    setSelectedDirector(null);
    setStatus("idle");
    if (window.location.hash.startsWith("#/director/")) {
      window.location.hash = "#/";
    }
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
            {matchingDirectors.length > 0 && (
              <li role="presentation" className="px-4 pb-1 pt-3 text-[10px] font-mono uppercase tracking-[0.14em] text-accent-400">
                Directores en la colección ({matchingDirectors.length})
              </li>
            )}
            {matchingDirectors.map((dir, dIdx) => (
              <li
                key={`dir-${dir.name}`}
                id={`suggestion-dir-${dir.name}`}
                role="option"
                aria-selected={activeIndex === dIdx}
                onClick={() => handlePickDirector(dir.name)}
                onMouseMove={() => setActiveIndex(dIdx)}
                className={`group flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 transition-colors border-b border-white/[0.06] ${
                  activeIndex === dIdx ? "bg-accent-950/40 text-accent-200" : "bg-accent-950/15 text-neutral-200"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-accent-500/30 bg-accent-500/10 text-accent-300">
                    <User size={13} />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white group-hover:text-accent-300">
                      {dir.name}
                    </span>
                    <span className="block text-[11px] font-mono text-neutral-400">
                      Filmografía · {dir.count} {dir.count === 1 ? "película" : "películas"} en el archivo
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-accent-400 flex items-center gap-1 shrink-0">
                  Ver todo <ArrowRight size={12} />
                </span>
              </li>
            ))}

            {suggestions.length > 0 && (
              <li role="presentation" className="px-4 pb-1 pt-3 text-[10px] font-mono uppercase tracking-[0.14em] text-neutral-400">
                En la colección ({suggestions.length})
              </li>
            )}
            {suggestions.map((movie, sIdx) => {
              const i = matchingDirectors.length + sIdx;
              return (
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
              );
            })}

            {(externalSuggestions.length > 0 || tmdbLoading) && (
              <li
                role="presentation"
                className={`flex items-center gap-2 px-4 pb-1 pt-3 text-[10px] font-mono uppercase tracking-[0.14em] text-neutral-400 ${
                  suggestions.length > 0 || matchingDirectors.length > 0 ? "mt-1 border-t border-white/[0.06]" : ""
                }`}
              >
                Explorar en todo el cine (TMDB)
                {tmdbLoading && <Loader2 size={11} className="animate-spin text-neutral-400" />}
              </li>
            )}
            {externalSuggestions.map((movie, j) => {
              const i = matchingDirectors.length + suggestions.length + j;
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

      {/* 3b. Si hay un director seleccionado: mostramos su Filmografía completa */}
      {status === "idle" && selectedDirector && (
        <section className="mt-8 w-full text-left animate-view-enter" aria-label={`Filmografía de ${selectedDirector}`}>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-4">
              {directorTmdb.director?.profile_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w185${directorTmdb.director.profile_path}`}
                  alt={selectedDirector}
                  className="h-16 w-16 rounded-full object-cover border border-white/15 shadow-poster shrink-0"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-accent-500/30 bg-accent-950/40 text-accent-300 font-serif text-2xl">
                  {selectedDirector.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-accent-400">
                  Filmografía del autor
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-normal text-white">
                  {selectedDirector}
                </h2>
                <p className="text-xs text-neutral-400 font-mono mt-0.5">
                  {directorMovies.length} {directorMovies.length === 1 ? "película" : "películas"} en la colección personal
                  {directorTmdb.external.length > 0 && ` · ${directorTmdb.external.length} adicionales en TMDB`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCloseDirector}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-neutral-300 hover:border-white/30 hover:text-white transition-colors self-start sm:self-auto"
            >
              <RotateCcw size={12} />
              Volver al inicio
            </button>
          </div>

          {/* Obras en la colección */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-200">
              Películas en la colección ({directorMovies.length})
            </h3>
            <span className="text-[11px] text-neutral-400 font-mono">
              Orden cronológico
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {directorMovies.map((movie) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => onPick(movie.id)}
                aria-label={`Abrir constelación de ${movie.title}`}
                className="group flex flex-col items-center text-center focus-ring-cinematic rounded-xl p-1.5 hover:bg-white/[0.03] transition-colors"
              >
                <MoviePosterCard movie={movie} size="sm" showBadge={false} />
                <span className="mt-2 line-clamp-1 max-w-[120px] text-xs font-medium text-neutral-200 group-hover:text-white transition-colors">
                  {movie.title}
                </span>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-mono text-neutral-400">
                  <span>{movie.release_year}</span>
                  {movie.rating && <span className="text-accent-400">★ {movie.rating}</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Más obras en TMDB */}
          {directorTmdb.loading && (
            <div className="mt-10 flex items-center justify-center gap-2 text-xs text-neutral-400 py-6">
              <Loader2 size={14} className="animate-spin text-accent-400" />
              <span>Buscando el resto de su filmografía en TMDB…</span>
            </div>
          )}

          {!directorTmdb.loading && directorTmdb.external.length > 0 && (
            <div className="mt-12 border-t border-dashed border-white/15 pt-8">
              <div className="mb-4">
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-400">
                  Fuera de la colección
                </span>
                <h3 className="font-serif text-xl font-normal text-white mt-0.5">
                  Resto de su filmografía en TMDB ({directorTmdb.external.length})
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Títulos dirigidos por {selectedDirector} que no están en el archivo personal.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {directorTmdb.external.map((movie) => (
                  <button
                    key={`ext-${movie.tmdb_id}`}
                    type="button"
                    onClick={() => onPickExternal(movie)}
                    aria-label={`Ver ficha de ${movie.title}`}
                    className="group flex flex-col items-center text-center focus-ring-cinematic rounded-xl p-1.5 hover:bg-white/[0.03] transition-colors opacity-85 hover:opacity-100"
                  >
                    <MoviePosterCard movie={movie} size="sm" showBadge={false} />
                    <span className="mt-2 line-clamp-1 max-w-[120px] text-xs font-medium text-neutral-200 group-hover:text-white transition-colors">
                      {movie.title}
                    </span>
                    <span className="mt-0.5 text-[11px] font-mono text-neutral-400">
                      {movie.release_year || "Sin año"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 4. Si no hay director seleccionado: Sorpréndeme y ¿Qué veo hoy? */}
      {status === "idle" && !selectedDirector && (
        <>
          <SurprisePick onPick={onPick} onPickExternal={onPickExternal} onMore={onShowNextUp} />
          <NextUpBanner onOpen={() => onShowNextUp()} />
        </>
      )}

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
          <button type="button" onClick={onShowHowItWorks} className="uppercase tracking-[0.14em] hover:text-white transition-colors focus-ring-cinematic">
            Cómo funciona
          </button>
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
