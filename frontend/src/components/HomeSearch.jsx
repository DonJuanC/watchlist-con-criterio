// src/components/HomeSearch.jsx
// CINE-09: pantallas 1 y 2 del flujo nuevo. Inicio con una sola pregunta (una película que
// te gustó, o una sensación/tema), sugerencias en vivo mientras escribes (títulos del
// catálogo), chips de ideas y un botón "Sorpréndeme" que elige un tema al azar; luego, los
// resultados como 6 pósters. Al tocar uno, el padre abre EgoView con esa película.

import { useCallback, useMemo, useRef, useState } from "react";
import { Search, Loader2, Dices, Sparkles, Popcorn, Film, X, Compass, Network } from "lucide-react";
import { semanticSearch } from "../services/api";
import useCineStore from "../store/useCineStore";
import useTmdbSuggestions from "../hooks/useTmdbSuggestions";
import MoviePosterCard, { MovieCardSkeleton } from "./MoviePosterCard";

const RESULTS_LIMIT = 6;
const SURPRISE_MAX_TRIES = 3;
const SUGGESTIONS_LIMIT = 5;
const SUGGESTIONS_MIN_CHARS = 2;
const EXTERNAL_LIMIT = 4; // sugerencias de TMDB fuera de lo ya listado del catálogo

// label: lo que ve la persona. query: el texto real que se manda a la búsqueda semántica
// (más rico que el label, para mejorar el recall del embedding).
const THEMES = [
  {
    label: "Melancolía y neón",
    query: "melancolía nocturna y luces de neón",
  },
  {
    label: "Paranoia y laberintos mentales",
    query: "thriller psicológico paranoia identidad",
  },
  {
    label: "Venganza estilizada",
    query: "venganza fría estilizada violencia",
  },
  {
    label: "Ciencia ficción reflexiva",
    query: "ciencia ficción existencial soledad",
  },
  {
    label: "Nostalgia y memoria",
    query: "nostalgia memoria pérdida recuerdos del pasado",
  },
  {
    label: "Soledad en la ciudad",
    query: "soledad en la ciudad aislamiento urbano",
  },
  {
    label: "Identidad y dobles",
    query: "identidad doble personalidad espejo",
  },
  {
    label: "Amor imposible",
    query: "amor imposible deseo contenido melancolía",
  },
  {
    label: "Terror atmosférico",
    query: "terror atmosférico inquietante sin sangre",
  },
  {
    label: "Culpa y dilemas morales",
    query: "culpa dilema moral crimen consecuencias",
  },
  {
    label: "Realidad onírica",
    query: "realidad ambigua sueños confusión onírico",
  },
  {
    label: "Secretos familiares",
    query: "secretos familiares tensión doméstica",
  },
];

const HOME_CHIPS = THEMES.slice(0, 4);

function pickRandomTheme(excludedLabels) {
  const candidates = THEMES.filter((t) => !excludedLabels.has(t.label));
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Para comparar sin importar mayúsculas ni tildes ("pelicula" encuentra "Película").
function normalizeText(text) {
  return (text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Títulos del catálogo que coinciden con lo escrito: primero los que empiezan igual.
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
 * @param {{ onPick: (id: number) => void, onPickExternal: (movie: object) => void,
 *           onShowNextUp: () => void, onShowMap: () => void }} props
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
  const [suggestOpen, setSuggestOpen] = useState(false); // solo se abre al escribir a mano
  const [activeIndex, setActiveIndex] = useState(-1); // fila resaltada con el teclado
  const requestIdRef = useRef(0); // descarta respuestas viejas si se lanza otra búsqueda
  const lastThemeRef = useRef(null);

  const suggestions = useMemo(
    () => (suggestOpen ? findTitleSuggestions(catalog, inputValue) : []),
    [catalog, inputValue, suggestOpen],
  );
  const showDropdown = suggestOpen && inputValue.trim().length >= 1;

  // CINE-10: además del catálogo, cualquier película de TMDB. Las vistas que ya aparecen
  // arriba (match por título) no se repiten.
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
  // Orden de filas para el teclado: catálogo, luego TMDB, luego "Buscar por sensación".
  const semanticIndex = suggestions.length + externalSuggestions.length;

  // Selección diversa de películas destacadas del catálogo para inspirar la exploración inicial
  const featuredMovies = useMemo(() => {
    if (!catalog || catalog.length === 0) return [];
    const withPoster = catalog.filter((m) => m.poster_path && m.director);
    const seenDirectors = new Set();
    const diverse = [];
    for (const m of withPoster) {
      if (!seenDirectors.has(m.director)) {
        seenDirectors.add(m.director);
        diverse.push(m);
        if (diverse.length >= 6) break;
      }
    }
    return diverse.length > 0 ? diverse : withPoster.slice(0, 6);
  }, [catalog]);

  // Devuelve las filas, o null si falló o quedó obsoleta (otra búsqueda la reemplazó).
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
      // Si ya la vi (aunque el título escrito no coincidiera con el del catálogo), su EgoView.
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
      // La última fila del menú es siempre "Buscar por sensación" (índice = semanticIndex).
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
      // En cualquier otro Enter, el formulario hace la búsqueda por sensación.
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

  const handleChip = useCallback(
    (theme) => {
      setInputValue(theme.query);
      search(theme.query, theme.label);
    },
    [search],
  );

  // Elige un tema al azar (distinto al anterior). Si un tema no devuelve nada, prueba otro.
  const handleSurprise = useCallback(async () => {
    const tried = new Set([lastThemeRef.current]);
    for (let i = 0; i < SURPRISE_MAX_TRIES; i++) {
      const theme = pickRandomTheme(tried);
      tried.add(theme.label);
      lastThemeRef.current = theme.label;
      setInputValue("");
      const rows = await search(theme.query, `Sorpresa: ${theme.label}`);
      if (rows === null || rows.length > 0) return;
    }
  }, [search]);

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
    <main className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 pb-16 pt-8 text-center sm:pt-14">
      {status === "idle" && (
        <div className="space-y-3 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-950/40 px-3.5 py-1 text-xs text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.15)] backdrop-blur-md">
            <Sparkles size={12} className="text-cyan-400" />
            <span>Curaduría personal conectada por atmósfera y autoría</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl font-semibold tracking-tight text-white leading-tight">
            Descubre cine por <span className="italic bg-gradient-to-r from-cyan-300 via-white to-blue-300 bg-clip-text text-transparent">sensación</span> y <span className="italic bg-gradient-to-r from-amber-200 via-white to-amber-400 bg-clip-text text-transparent">visión</span>
          </h1>
          <p className="mx-auto max-w-md text-xs sm:text-sm text-neutral-300 leading-relaxed font-normal">
            Escribe una película o cuéntame una atmósfera:{" "}
            <span className="text-cyan-200 italic">melancolía nocturna</span>,{" "}
            <span className="text-amber-200 italic">paranoia psicológica</span>,{" "}
            <span className="text-neutral-200 italic">existencialismo sci-fi</span>...
          </p>
        </div>
      )}

      <div
        className="relative mt-6 w-full max-w-xl"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setSuggestOpen(false);
            setActiveIndex(-1);
          }
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="flex w-full items-center gap-3 rounded-2xl border border-white/20 bg-neutral-900/80 px-4 py-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-all duration-300 focus-within:border-cyan-400/70 focus-within:ring-4 focus-within:ring-cyan-500/15"
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin text-cyan-400" />
          ) : (
            <Search size={18} className="text-neutral-400" />
          )}
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Una película, o cómo quieres sentirte"
            aria-label="Escribe una película o describe qué quieres ver"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="home-suggestions"
            aria-autocomplete="list"
            autoComplete="off"
            className="flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-500"
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
            // Evita que el clic quite el foco del input antes de registrarse (pasa en Safari).
            onMouseDown={(e) => e.preventDefault()}
            className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 text-left shadow-2xl"
          >
            {suggestions.length > 0 && (
              <li
                role="presentation"
                className="px-4 pb-1 pt-3 text-[11px] text-neutral-500"
              >
                En el catálogo
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
                  <span className="block truncate text-sm font-medium text-neutral-100 group-hover:text-cyan-300">
                    {movie.title}
                  </span>
                  <span className="block truncate text-xs text-neutral-400">
                    {[movie.release_year, movie.director]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </li>
            ))}
            {(externalSuggestions.length > 0 || tmdbLoading) && (
              <li
                role="presentation"
                className={`flex items-center gap-2 px-4 pb-1 pt-3 text-[11px] font-medium tracking-wide uppercase text-neutral-500 ${
                  suggestions.length > 0 ? "mt-1 border-t border-white/10" : ""
                }`}
              >
                Otras películas
                {tmdbLoading && <Loader2 size={12} className="animate-spin text-cyan-400" />}
              </li>
            )}
            {externalSuggestions.map((movie, j) => {
              const i = suggestions.length + j;
              const badge =
                movie.in_catalog?.status === "seen"
                  ? "Vista"
                  : movie.in_catalog?.status === "pending"
                    ? "Pendiente"
                    : null;
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
                    <span className="block truncate text-sm font-medium text-neutral-100 group-hover:text-cyan-300">
                      {movie.title}
                    </span>
                    <span className="block truncate text-xs text-neutral-400">
                      {[movie.release_year, badge].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </li>
              );
            })}
            <li
              role="option"
              aria-selected={activeIndex === semanticIndex}
              onClick={() =>
                search(inputValue.trim(), `“${inputValue.trim()}”`)
              }
              onMouseMove={() => setActiveIndex(semanticIndex)}
              className={`flex cursor-pointer items-center gap-3 px-4 py-3 ${
                semanticIndex > 0 || tmdbLoading ? "mt-1 border-t border-white/10" : ""
              } ${activeIndex === semanticIndex ? "bg-white/10" : ""}`}
            >
              <Sparkles size={18} className="shrink-0 text-cyan-300" />
              <span className="min-w-0">
                <span className="block truncate text-sm text-neutral-100">
                  Buscar por sensación: “{inputValue.trim()}”
                </span>
                <span className="block text-xs text-neutral-500">
                  Presiona Enter
                </span>
              </span>
            </li>
          </ul>
        )}
      </div>

      {status === "idle" && (
        <div className="mt-3.5 flex flex-wrap justify-center gap-2">
          {HOME_CHIPS.map((theme) => (
            <button
              key={theme.label}
              type="button"
              onClick={() => handleChip(theme)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-neutral-300 backdrop-blur-md transition-all duration-200 hover:border-cyan-400/40 hover:bg-white/[0.08] hover:text-white hover:scale-105 hover:shadow-[0_0_12px_rgba(34,211,238,0.2)] active:scale-95"
            >
              {theme.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={handleSurprise}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-full border border-cyan-400/50 bg-gradient-to-r from-cyan-950/70 to-blue-950/70 px-5 py-2.5 text-xs sm:text-sm font-medium text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.18)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-cyan-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.35)] active:scale-95 disabled:opacity-50"
        >
          <Dices size={16} />
          Sorpréndeme
        </button>
        <button
          type="button"
          onClick={onShowNextUp}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-gradient-to-r from-emerald-950/70 to-teal-950/70 px-5 py-2.5 text-xs sm:text-sm font-medium text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.18)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-emerald-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.35)] active:scale-95"
        >
          <Popcorn size={16} />
          ¿Qué veo hoy?
        </button>
      </div>

      {/* Escaparate de obras destacadas del catálogo (Alma cinematográfica en la landing) */}
      {status === "idle" && featuredMovies.length > 0 && (
        <section className="mt-14 w-full" aria-label="Obras para empezar a explorar">
          <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between border-b border-white/10 pb-3 text-left">
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-medium text-white flex items-center gap-2">
                <Film size={17} className="text-cyan-400" />
                Obras para empezar a explorar
              </h2>
              <p className="mt-0.5 text-xs text-neutral-400">
                Toca cualquier película para abrir su universo de 6 conexiones
              </p>
            </div>
            <span className="hidden sm:inline-block text-[11px] text-cyan-400/80 font-medium">
              Vistas en el catálogo
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
            {featuredMovies.map((movie) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => onPick(movie.id)}
                aria-label={`Explorar conexiones de ${movie.title}`}
                className="group flex flex-col items-center text-center focus:outline-none"
              >
                <div className="transition-all duration-300 group-hover:-translate-y-1.5 group-hover:scale-105">
                  <MoviePosterCard
                    movie={movie}
                    size="sm"
                    accentColor="cyan"
                  />
                </div>
                <span className="mt-2 line-clamp-1 max-w-[100px] text-xs font-medium text-neutral-200 group-hover:text-cyan-300 transition-colors">
                  {movie.title}
                </span>
                <span className="text-[10px] text-neutral-500 truncate max-w-[100px]">
                  {[movie.release_year, movie.director].filter(Boolean).join(" · ")}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Explicación de la curaduría y cómo funciona el grafo */}
      {status === "idle" && (
        <section className="mt-14 w-full border-t border-white/10 pt-10" aria-label="Cómo funciona">
          <h3 className="font-serif text-base sm:text-lg font-medium text-neutral-200 mb-6 text-left">
            ¿Cómo se conecta este catálogo?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4.5 backdrop-blur-md transition-all hover:border-cyan-400/30 hover:bg-white/[0.04]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-950/60 border border-cyan-400/30 text-cyan-300 mb-3">
                <Film size={15} />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-1">
                1. Autoría Cinematográfica
              </h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Vínculos directos por realizador y época. La mirada de un autor es el primer puente natural entre películas.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4.5 backdrop-blur-md transition-all hover:border-blue-400/30 hover:bg-white/[0.04]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-950/60 border border-blue-400/30 text-blue-300 mb-3">
                <Network size={15} />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-1">
                2. Atmósfera y Tono (IA)
              </h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Embeddings de 768 dimensiones que calculan afinidad de sensaciones (paranoia, melancolía, estética) más allá de géneros planos.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4.5 backdrop-blur-md transition-all hover:border-emerald-400/30 hover:bg-white/[0.04]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-950/60 border border-emerald-400/30 text-emerald-300 mb-3">
                <Compass size={15} />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-1">
                3. Criterio y Crítica
              </h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Registro personal en Notion con calificación de estrellas, sello de recomendación y reseñas honestas, con notas de crítica y dónde verlas.
              </p>
            </div>
          </div>
        </section>
      )}

      {status === "error" && (
        <p className="mt-6 max-w-sm text-sm text-red-400">
          No pudimos buscar ahora mismo. Intenta de nuevo en unos segundos.
          <span className="mt-1 block text-xs text-neutral-500">
            {errorMsg}
          </span>
        </p>
      )}

      {isLoading && (
        <section className="mt-8 w-full" aria-label="Buscando películas">
          <p className="font-serif text-lg font-medium text-neutral-200">{heading || "Buscando en el catálogo..."}</p>
          <p className="mb-6 text-xs text-neutral-400">
            Comparando atmósferas y temáticas...
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
        <section className="mt-8 w-full" aria-label="Resultados">
          <p className="font-serif text-xl font-medium text-neutral-200">{heading}</p>
          <p className="mb-6 text-xs text-neutral-400">
            Elige una película para explorar sus conexiones
          </p>
          <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:gap-x-4">
            {results.map((movie) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => onPick(movie.id)}
                aria-label={`Abrir ${movie.title}`}
                className="group flex flex-col items-center focus:outline-none"
              >
                <div className="transition-transform duration-300 group-hover:-translate-y-1">
                  <MoviePosterCard
                    movie={movie}
                    size="md"
                    accentColor="cyan"
                  />
                </div>
                <span className="mt-2.5 line-clamp-2 max-w-[120px] text-xs font-medium leading-snug text-neutral-200 group-hover:text-cyan-300 transition-colors">
                  {movie.title}
                </span>
                {movie.release_year && (
                  <span className="mt-0.5 text-[11px] text-neutral-500">
                    {movie.release_year}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-neutral-300 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
          >
            Probar otra idea
          </button>
        </section>
      )}

      {showResults && results.length === 0 && (
        <p className="mt-8 max-w-sm text-sm text-neutral-400">
          No encontré nada con esa idea. Prueba con otras palabras o pulsa
          Sorpréndeme.
        </p>
      )}

      <button
        type="button"
        onClick={onShowMap}
        className="mt-12 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-neutral-400 backdrop-blur-md transition-all duration-200 hover:border-white/25 hover:bg-white/10 hover:text-neutral-200 hover:shadow-lg active:scale-95"
      >
        <Film size={13} className="text-neutral-400" />
        Ver todo el mapa del catálogo
      </button>
    </main>
  );
}
