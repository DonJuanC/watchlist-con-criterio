// src/components/HomeSearch.jsx
// Archivo cinematográfico personal con diseño editorial cinéfilo:
// Presenta el objetivo con total claridad, destaca obras en foco con reseñas y
// calificaciones reales de Notion, organiza ciclos por directores clave y
// permite explorar por sensaciones y atmósferas sin clichés de IA.

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Search,
  Loader2,
  Dices,
  Film,
  X,
  ChevronRight,
  ChevronLeft,
  Star,
  User,
  Popcorn,
  Sparkles,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { semanticSearch } from "../services/api";
import useCineStore from "../store/useCineStore";
import useTmdbSuggestions from "../hooks/useTmdbSuggestions";
import MoviePosterCard, { MovieCardSkeleton } from "./MoviePosterCard";

const RESULTS_LIMIT = 6;
const SUGGESTIONS_LIMIT = 5;
const SUGGESTIONS_MIN_CHARS = 2;
const EXTERNAL_LIMIT = 4;

// Atmósferas cinéfilas reales para búsqueda semántica por sensación
const CINEMATIC_MOODS = [
  {
    label: "Paranoia y laberintos mentales",
    query: "thriller psicológico paranoia identidad mente confusión",
  },
  {
    label: "Ciencia ficción existencial",
    query: "ciencia ficción existencial soledad universo trascendencia",
  },
  {
    label: "Melancolía y neón",
    query: "melancolía nocturna y luces de neón soledad urbana",
  },
  {
    label: "Venganza estilizada",
    query: "venganza fría estilizada violencia estética justicia",
  },
  {
    label: "Nostalgia y memoria",
    query: "nostalgia memoria pérdida recuerdos del pasado tiempo",
  },
  {
    label: "Secretos familiares y tensión",
    query: "secretos familiares tensión doméstica drama culpa",
  },
  {
    label: "Realidad onírica y dobles",
    query: "realidad ambigua sueños confusión identidad espejo doble",
  },
  {
    label: "Terror atmosférico e inquietante",
    query: "terror atmosférico psicológico inquietante sin sangre",
  },
];

function normalizeText(text) {
  return (text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function findTitleSuggestions(nodes, rawQuery) {
  const q = normalizeText(rawQuery);
  if (q.length < SUGGESTIONS_MIN_CHARS) return [];
  const starts = [];
  const contains = [];
  for (const node of nodes) {
    const title = normalizeText(node.title);
    if (title.startsWith(q)) starts.push(node);
    else if (title.includes(q)) contains.push(node);
  }
  return [...starts, ...contains].slice(0, SUGGESTIONS_LIMIT);
}

/**
 * @param {{
 *   onPick: (id: number) => void,
 *   onPickExternal: (movie: object) => void,
 *   onShowNextUp: () => void,
 *   onShowMap: () => void
 * }} props
 */
export default function HomeSearch({
  onPick,
  onPickExternal,
  onShowNextUp,
  onShowMap,
}) {
  const catalog = useCineStore((s) => s.rawGraph.nodes);
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [results, setResults] = useState([]);
  const [heading, setHeading] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [selectedDirector, setSelectedDirector] = useState(null);
  const requestIdRef = useRef(0);

  // Obras maestras del archivo con calificación máxima o reseña personal escrita
  const curatedGems = useMemo(() => {
    if (!catalog || catalog.length === 0) return [];
    return catalog
      .filter((m) => m.rating >= 4 || m.review)
      .sort((a, b) => {
        // Primero por rating descendente
        const rA = a.rating || 0;
        const rB = b.rating || 0;
        if (rB !== rA) return rB - rA;
        // Si empatan, primero las que tienen reseña escrita
        const revA = a.review ? 1 : 0;
        const revB = b.review ? 1 : 0;
        if (revB !== revA) return revB - revA;
        // Finalmente por año más reciente
        return (b.release_year || 0) - (a.release_year || 0);
      });
  }, [catalog]);

  // Selección de obras para el carrusel de Obra en Foco (las que tienen reseña de autor)
  const spotlightGems = useMemo(() => {
    const withReview = curatedGems.filter((m) => m.review && m.poster_path);
    return withReview.length > 0 ? withReview : curatedGems.slice(0, 5);
  }, [curatedGems]);

  const currentSpotlight = spotlightGems[spotlightIndex % Math.max(1, spotlightGems.length)];

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

  // Sugerencias de títulos en vivo del catálogo
  const suggestions = useMemo(
    () => (suggestOpen ? findTitleSuggestions(catalog, inputValue) : []),
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
      setStatus("done");
      return rows;
    } catch (err) {
      if (requestId !== requestIdRef.current) return null;
      setErrorMsg(err.message);
      setStatus("error");
      return null;
    }
  }, []);

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

  const handleSurprise = useCallback(async () => {
    const randomMood = CINEMATIC_MOODS[Math.floor(Math.random() * CINEMATIC_MOODS.length)];
    setInputValue(randomMood.label);
    search(randomMood.query, `Atmósfera al azar: ${randomMood.label}`);
  }, [search]);

  const handleReset = useCallback(() => {
    requestIdRef.current += 1;
    setInputValue("");
    setResults([]);
    setErrorMsg("");
    setSuggestOpen(false);
    setStatus("idle");
  }, []);

  const nextSpotlight = () => {
    setSpotlightIndex((i) => (i + 1) % spotlightGems.length);
  };

  const prevSpotlight = () => {
    setSpotlightIndex((i) => (i - 1 + spotlightGems.length) % spotlightGems.length);
  };

  const isLoading = status === "loading";
  const showResults = status === "done";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 pb-20 pt-6 sm:pt-10 text-center">
      {/* 1. Manifiesto y Encabezado Editorial */}
      {status === "idle" && (
        <header className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1 text-[11px] font-medium uppercase tracking-widest text-neutral-400 backdrop-blur-md">
            <span>Archivo Cinematográfico Personal</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-white leading-[1.15]">
            Watchlist con Criterio
          </h1>

          <p className="mx-auto max-w-xl text-xs sm:text-sm text-neutral-300 leading-relaxed font-normal">
            Una cartografía de cine conectada por autoría, atmósfera y obsesiones compartidas.
            Cada película es una puerta de entrada: selecciona una obra para abrir su constelación de{" "}
            <span className="text-white font-medium">6 conexiones directas</span>, o navega por sensaciones y ciclos de autor.
          </p>

          {/* Guía en 3 Pasos de Navegación Clara */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left text-xs">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur-sm">
              <span className="block font-mono text-[10px] text-neutral-500 uppercase">Paso 1</span>
              <span className="font-medium text-neutral-200">Elige una obra o sensación</span>
              <span className="block text-[11px] text-neutral-400 mt-0.5">
                En el buscador, en los ciclos o en la obra en foco.
              </span>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur-sm">
              <span className="block font-mono text-[10px] text-neutral-500 uppercase">Paso 2</span>
              <span className="font-medium text-neutral-200">Despliega sus 6 conexiones</span>
              <span className="block text-[11px] text-neutral-400 mt-0.5">
                Afinidad temática, estética y directores compartidos.
              </span>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur-sm">
              <span className="block font-mono text-[10px] text-neutral-500 uppercase">Paso 3</span>
              <span className="font-medium text-neutral-200">Lee mi criterio y dónde verla</span>
              <span className="block text-[11px] text-neutral-400 mt-0.5">
                Reseña personal, estrellas, notas de crítica y streaming.
              </span>
            </div>
          </div>
        </header>
      )}

      {/* 2. Buscador Cinéfilo y Selector de Atmósfera */}
      <div
        className="relative mt-8 w-full max-w-xl"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setSuggestOpen(false);
            setActiveIndex(-1);
          }
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-neutral-900/90 px-4 py-3.5 shadow-2xl backdrop-blur-xl transition-all duration-300 focus-within:border-white/40 focus-within:ring-1 focus-within:ring-white/20"
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin text-neutral-300" />
          ) : (
            <Search size={18} className="text-neutral-400" />
          )}
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Escribe una película o una atmósfera (ej: paranoia, soledad urbana)..."
            aria-label="Buscar película o atmósfera"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="home-suggestions"
            aria-autocomplete="list"
            autoComplete="off"
            className="flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-500 font-sans"
          />
          {inputValue && (
            <button
              type="button"
              onClick={handleReset}
              aria-label="Limpiar búsqueda"
              className="rounded-full p-1 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </form>

        {showDropdown && (
          <ul
            id="home-suggestions"
            role="listbox"
            onMouseDown={(e) => e.preventDefault()}
            className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-white/15 bg-neutral-900 text-left shadow-2xl"
          >
            {suggestions.length > 0 && (
              <li role="presentation" className="px-4 pb-1 pt-3 text-[11px] font-mono uppercase tracking-wider text-neutral-500">
                En el archivo ({suggestions.length})
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
                  activeIndex === i ? "bg-white/10" : ""
                }`}
              >
                <MoviePosterCard movie={movie} size="xs" showBadge={false} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-100 group-hover:text-white">
                    {movie.title}
                  </span>
                  <span className="block truncate text-xs text-neutral-400">
                    {[movie.release_year, movie.director].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {movie.rating && (
                  <span className="text-[11px] text-amber-400/90 font-medium">
                    ⭐ {movie.rating}
                  </span>
                )}
              </li>
            ))}

            {(externalSuggestions.length > 0 || tmdbLoading) && (
              <li
                role="presentation"
                className={`flex items-center gap-2 px-4 pb-1 pt-3 text-[11px] font-mono uppercase tracking-wider text-neutral-500 ${
                  suggestions.length > 0 ? "mt-1 border-t border-white/10" : ""
                }`}
              >
                Fuera del archivo (TMDB)
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
                    activeIndex === i ? "bg-white/10" : ""
                  }`}
                >
                  <MoviePosterCard movie={movie} size="xs" showBadge={false} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-neutral-100 group-hover:text-white">
                      {movie.title}
                    </span>
                    <span className="block truncate text-xs text-neutral-400">
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
                semanticIndex > 0 || tmdbLoading ? "mt-1 border-t border-white/10" : ""
              } ${activeIndex === semanticIndex ? "bg-white/10" : ""}`}
            >
              <Sparkles size={16} className="shrink-0 text-neutral-300" />
              <span className="min-w-0">
                <span className="block truncate text-sm text-neutral-100 font-medium">
                  Buscar por afinidad de atmósfera: “{inputValue.trim()}”
                </span>
                <span className="block text-xs text-neutral-500">
                  Presiona Enter para calcular conexiones
                </span>
              </span>
            </li>
          </ul>
        )}
      </div>

      {/* Chips de Atmósferas Cinéfilas Reales */}
      {status === "idle" && (
        <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-2xl">
          {CINEMATIC_MOODS.slice(0, 5).map((mood) => (
            <button
              key={mood.label}
              type="button"
              onClick={() => handleMoodClick(mood)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-neutral-300 backdrop-blur-md transition-all duration-200 hover:border-white/30 hover:bg-white/[0.08] hover:text-white active:scale-95"
            >
              {mood.label}
            </button>
          ))}
        </div>
      )}

      {/* Botones de Exploración Rápida */}
      {status === "idle" && (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={handleSurprise}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-xs sm:text-sm font-medium text-neutral-200 backdrop-blur-md transition-all duration-200 hover:border-white/35 hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-50"
          >
            <Dices size={15} />
            Atmósfera al azar
          </button>

          <button
            type="button"
            onClick={onShowNextUp}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-4 py-2 text-xs sm:text-sm font-medium text-emerald-200 backdrop-blur-md transition-all duration-200 hover:border-emerald-500/70 hover:bg-emerald-950/60 active:scale-95"
          >
            <Popcorn size={15} className="text-emerald-400" />
            ¿Qué veo hoy? (Streaming)
          </button>
        </div>
      )}

      {/* 3. OBRA EN FOCO (Spotlight Editorial con Reseña Real de Juan Camilo) */}
      {status === "idle" && currentSpotlight && (
        <section
          className="mt-12 w-full text-left rounded-3xl border border-white/15 bg-neutral-900/60 backdrop-blur-xl p-5 sm:p-7 shadow-2xl transition-all"
          aria-label="Obra en foco del archivo"
        >
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Afiche en proporción 2:3 */}
            <div className="shrink-0 transition-transform duration-300 hover:scale-102">
              <MoviePosterCard movie={currentSpotlight} size="lg" />
            </div>

            {/* Metadatos y Crítica de Autor */}
            <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
              <div>
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-amber-400/90 font-medium">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    Obra en Foco · Recomendación del Archivo
                  </span>

                  {spotlightGems.length > 1 && (
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <button
                        type="button"
                        onClick={prevSpotlight}
                        aria-label="Obra anterior en foco"
                        className="rounded-full p-1 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <span className="font-mono text-[11px] text-neutral-400">
                        {((spotlightIndex % spotlightGems.length) + 1)} / {spotlightGems.length}
                      </span>
                      <button
                        type="button"
                        onClick={nextSpotlight}
                        aria-label="Siguiente obra en foco"
                        className="rounded-full p-1 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  )}
                </div>

                <h2 className="mt-3 font-serif text-2xl sm:text-3xl font-medium text-white tracking-tight leading-snug">
                  {currentSpotlight.title}
                </h2>

                <p className="mt-1 text-xs text-neutral-400">
                  {[
                    currentSpotlight.release_year,
                    currentSpotlight.director ? `Dir. ${currentSpotlight.director}` : null,
                    currentSpotlight.main_genre,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

                {currentSpotlight.rating && (
                  <div className="mt-2.5 flex items-center gap-1" aria-label={`${currentSpotlight.rating} de 5 estrellas`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={13}
                        className={
                          i < currentSpotlight.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-neutral-700"
                        }
                      />
                    ))}
                    <span className="ml-1.5 text-xs text-neutral-400 font-medium">
                      {currentSpotlight.rating} / 5
                    </span>
                  </div>
                )}

                {currentSpotlight.review && (
                  <blockquote className="mt-4 rounded-xl border-l-2 border-amber-500/60 bg-amber-950/10 p-3.5 font-serif text-xs sm:text-sm italic leading-relaxed text-neutral-200">
                    “{currentSpotlight.review}”
                  </blockquote>
                )}
              </div>

              {/* Botón de Entrada Directa a la Constelación */}
              <div className="mt-6 pt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onPick(currentSpotlight.id)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-neutral-950 transition-all hover:bg-neutral-200 active:scale-95"
                >
                  <span>Explorar constelación (6 conexiones directas)</span>
                  <ArrowRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={nextSpotlight}
                  className="text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  Ver otra obra recomendada →
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. SECCIÓN EDITORIAL: JOYAS DEL ARCHIVO (Con Criterio y Reseña) */}
      {status === "idle" && curatedGems.length > 0 && (
        <section className="mt-14 w-full text-left" aria-label="Joyas del archivo">
          <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="font-serif text-lg sm:text-xl font-medium text-white flex items-center gap-2">
                <Star size={16} className="text-amber-400" />
                Joyas del Archivo · Calificación y Criterio
              </h3>
              <p className="mt-0.5 text-xs text-neutral-400">
                Obras con máxima puntuación y reseñas personales en el catálogo
              </p>
            </div>
            <span className="text-[11px] font-mono text-neutral-500 mt-1 sm:mt-0">
              Toca una para abrir su constelación
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4">
            {curatedGems.slice(0, 6).map((movie) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => onPick(movie.id)}
                aria-label={`Abrir constelación de ${movie.title}`}
                className="group flex flex-col items-center text-center focus:outline-none"
              >
                <div className="transition-all duration-300 group-hover:-translate-y-1.5 group-hover:scale-103">
                  <MoviePosterCard movie={movie} size="sm" />
                </div>
                <span className="mt-2 line-clamp-1 max-w-[110px] text-xs font-medium text-neutral-200 group-hover:text-white transition-colors">
                  {movie.title}
                </span>
                <span className="text-[10px] text-neutral-400 truncate max-w-[110px]">
                  {[movie.release_year, movie.director].filter(Boolean).join(" · ")}
                </span>
                {movie.rating && (
                  <span className="mt-0.5 text-[10px] text-amber-400/90 font-medium">
                    ⭐ {movie.rating}/5
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 5. SECCIÓN EDITORIAL: CICLOS DE DIRECTORES CLAVE */}
      {status === "idle" && keyDirectors.length > 0 && (
        <section className="mt-14 w-full text-left" aria-label="Ciclos de directores clave">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-end justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="font-serif text-lg sm:text-xl font-medium text-white flex items-center gap-2">
                <User size={16} className="text-neutral-400" />
                Directores de Cabecera
              </h3>
              <p className="mt-0.5 text-xs text-neutral-400">
                Auteurs con mayor presencia y constelaciones conectadas en la curaduría
              </p>
            </div>
            {selectedDirector && (
              <button
                type="button"
                onClick={() => setSelectedDirector(null)}
                className="text-[11px] text-neutral-400 hover:text-white transition-colors mt-1 sm:mt-0"
              >
                Cerrar ciclo de {selectedDirector}
              </button>
            )}
          </div>

          {/* Filtros de Directores */}
          <div className="flex flex-wrap gap-2 mb-5">
            {keyDirectors.slice(0, 6).map(({ name, count }) => {
              const isSelected = selectedDirector === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedDirector(isSelected ? null : name)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-white text-neutral-950 font-semibold"
                      : "border border-white/10 bg-white/[0.03] text-neutral-300 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <span>{name}</span>
                  <span className={`text-[10px] ${isSelected ? "text-neutral-700" : "text-neutral-500"}`}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Shelf de Películas del Director Seleccionado */}
          {selectedDirector && directorMovies.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4 mb-6">
              <p className="text-xs font-mono uppercase tracking-wider text-neutral-400 mb-3">
                Películas de {selectedDirector} en el archivo:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {directorMovies.map((movie) => (
                  <button
                    key={movie.id}
                    type="button"
                    onClick={() => onPick(movie.id)}
                    aria-label={`Abrir constelación de ${movie.title}`}
                    className="group flex flex-col items-center text-center focus:outline-none"
                  >
                    <MoviePosterCard movie={movie} size="sm" />
                    <span className="mt-1.5 line-clamp-1 max-w-[100px] text-xs font-medium text-neutral-200 group-hover:text-white transition-colors">
                      {movie.title}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      {movie.release_year}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 6. ESTADO DE RESULTADOS DE BÚSQUEDA */}
      {isLoading && (
        <section className="mt-10 w-full" aria-label="Buscando conexiones">
          <p className="font-serif text-lg font-medium text-neutral-200">{heading || "Buscando en el archivo..."}</p>
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
          <div className="mb-6 text-center border-b border-white/10 pb-4">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
              Conexiones del archivo
            </span>
            <h2 className="font-serif text-2xl font-medium text-white mt-1">{heading}</h2>
            <p className="mt-1 text-xs text-neutral-400">
              6 obras conectadas por atmósfera y temática. Selecciona una para abrir su constelación completa.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:gap-x-4">
            {results.map((movie) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => onPick(movie.id)}
                aria-label={`Abrir constelación de ${movie.title}`}
                className="group flex flex-col items-center focus:outline-none"
              >
                <div className="transition-transform duration-300 group-hover:-translate-y-1">
                  <MoviePosterCard movie={movie} size="md" />
                </div>
                <span className="mt-2.5 line-clamp-2 max-w-[120px] text-xs font-medium leading-snug text-neutral-200 group-hover:text-white transition-colors">
                  {movie.title}
                </span>
                <span className="mt-0.5 text-[11px] text-neutral-500">
                  {[movie.release_year, movie.director].filter(Boolean).join(" · ")}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="mt-10 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs text-neutral-300 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
          >
            <RotateCcw size={13} />
            <span>Volver al inicio del archivo</span>
          </button>
        </section>
      )}

      {showResults && results.length === 0 && (
        <div className="mt-10 max-w-sm text-center">
          <p className="text-sm text-neutral-300 font-medium">
            No encontré conexiones directas para esa búsqueda.
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Prueba con otra sensación o selecciona una obra del archivo.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            Volver
          </button>
        </div>
      )}

      {status === "error" && (
        <p className="mt-6 max-w-sm text-sm text-red-400">
          No pudimos buscar en este momento. Intenta de nuevo en unos segundos.
          <span className="mt-1 block text-xs text-neutral-500">{errorMsg}</span>
        </p>
      )}

      {/* 7. Mapa global como opción secundaria */}
      <button
        type="button"
        onClick={onShowMap}
        className="mt-16 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-xs font-medium text-neutral-400 backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:bg-white/[0.06] hover:text-neutral-200 active:scale-95"
      >
        <Film size={13} className="text-neutral-400" />
        Ver el mapa completo del archivo
      </button>
    </main>
  );
}
