// src/components/HomeSearch.jsx
// CINE-09: pantallas 1 y 2 del flujo nuevo. Inicio con una sola pregunta (una película que
// te gustó, o una sensación/tema), sugerencias en vivo mientras escribes (títulos del
// catálogo), chips de ideas y un botón "Sorpréndeme" que elige un tema al azar; luego, los
// resultados como 6 pósters. Al tocar uno, el padre abre EgoView con esa película.

import { useCallback, useMemo, useRef, useState } from "react";
import { Search, Loader2, Dices, Sparkles } from "lucide-react";
import { semanticSearch } from "../services/api";
import useCineStore from "../store/useCineStore";
import useTmdbSuggestions from "../hooks/useTmdbSuggestions";

const POSTER_BASE = "https://image.tmdb.org/t/p/w185";
const RESULTS_LIMIT = 6;
const SURPRISE_MAX_TRIES = 3;
const SUGGESTIONS_LIMIT = 5;
const SUGGESTIONS_MIN_CHARS = 2;
const EXTERNAL_LIMIT = 4; // sugerencias de TMDB fuera de lo ya listado del catálogo

// label: lo que ve la persona. query: el texto real que se manda a la búsqueda semántica
// (más rico que el label, para mejorar el recall del embedding).
const THEMES = [
  {
    label: "🌧️ Melancolía y luces de neón",
    query: "melancolía nocturna y luces de neón",
  },
  {
    label: "🧠 Paranoia y laberintos mentales",
    query: "thriller psicológico paranoia identidad",
  },
  {
    label: "🔪 Venganza estilizada y silenciosa",
    query: "venganza fría estilizada violencia",
  },
  {
    label: "🌌 Ciencia ficción reflexiva",
    query: "ciencia ficción existencial soledad",
  },
  {
    label: "🕰️ Nostalgia y recuerdos",
    query: "nostalgia memoria pérdida recuerdos del pasado",
  },
  {
    label: "🏙️ Soledad en la ciudad",
    query: "soledad en la ciudad aislamiento urbano",
  },
  {
    label: "🎭 Identidad y dobles",
    query: "identidad doble personalidad espejo",
  },
  {
    label: "💔 Amor que no puede ser",
    query: "amor imposible deseo contenido melancolía",
  },
  {
    label: "🏚️ Terror que se siente",
    query: "terror atmosférico inquietante sin sangre",
  },
  {
    label: "⚖️ Culpa y dilemas morales",
    query: "culpa dilema moral crimen consecuencias",
  },
  {
    label: "🌀 Cuando la realidad se rompe",
    query: "realidad ambigua sueños confusión onírico",
  },
  {
    label: "🏠 Secretos de familia",
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

function PosterThumb({ movie, className = "h-20 w-20" }) {
  const initial = (movie.title || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-neutral-800 ring-1 ring-white/20 transition group-hover:ring-cyan-400 group-focus-visible:ring-2 group-focus-visible:ring-cyan-400 ${className}`}
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

/**
 * @param {{ onPick: (id: number) => void, onPickExternal: (movie: object) => void,
 *           onShowMap: () => void }} props
 */
export default function HomeSearch({ onPick, onPickExternal, onShowMap }) {
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
    <main className="mx-auto flex w-full max-w-xl flex-col items-center px-4 pb-8 pt-12 text-center sm:pt-20">
      {status === "idle" && (
        <>
          <h1 className="text-2xl font-semibold text-white">
            ¿Qué quieres ver hoy?
          </h1>
          <p className="mt-2 max-w-sm text-sm text-neutral-400">
            Escribe una película que te gustó, o cuéntame cómo te quieres
            sentir: algo oscuro, nostálgico, con giros…
          </p>
        </>
      )}

      <div
        className="relative mt-6 w-full"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setSuggestOpen(false);
            setActiveIndex(-1);
          }
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="flex w-full items-center gap-2 rounded-full border border-white/15 bg-neutral-900 px-4 py-3"
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin text-neutral-400" />
          ) : (
            <Search size={18} className="text-neutral-400" />
          )}
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Una película que te gustó, o cómo quieres sentirte"
            aria-label="Escribe una película o describe qué quieres ver"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="home-suggestions"
            aria-autocomplete="list"
            autoComplete="off"
            className="flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-500"
          />
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
                className={`group flex cursor-pointer items-center gap-3 px-4 py-2 ${
                  activeIndex === i ? "bg-white/10" : ""
                }`}
              >
                <PosterThumb movie={movie} className="h-8 w-8" />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-neutral-100">
                    {movie.title}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
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
                className={`flex items-center gap-2 px-4 pb-1 pt-3 text-[11px] text-neutral-500 ${
                  suggestions.length > 0 ? "mt-1 border-t border-white/10" : ""
                }`}
              >
                Otras películas
                {tmdbLoading && <Loader2 size={12} className="animate-spin" />}
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
                  className={`group flex cursor-pointer items-center gap-3 px-4 py-2 ${
                    activeIndex === i ? "bg-white/10" : ""
                  }`}
                >
                  <PosterThumb movie={movie} className="h-8 w-8" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-neutral-100">
                      {movie.title}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">
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
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {HOME_CHIPS.map((theme) => (
            <button
              key={theme.label}
              type="button"
              onClick={() => handleChip(theme)}
              className="rounded-full border border-white/10 bg-neutral-900/70 px-3 py-1 text-xs text-neutral-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              {theme.label}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleSurprise}
        disabled={isLoading}
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/40 px-4 py-2 text-sm text-cyan-300 transition-colors hover:bg-cyan-400/10 disabled:opacity-50"
      >
        <Dices size={16} />
        Sorpréndeme
      </button>

      {status === "error" && (
        <p className="mt-6 max-w-sm text-sm text-red-400">
          No pudimos buscar ahora mismo. Intenta de nuevo en unos segundos.
          <span className="mt-1 block text-xs text-neutral-500">
            {errorMsg}
          </span>
        </p>
      )}

      {showResults && results.length > 0 && (
        <section className="mt-8 w-full" aria-label="Resultados">
          <p className="text-sm text-neutral-300">{heading}</p>
          <p className="mb-4 text-xs text-neutral-500">
            Elige una para empezar
          </p>
          <div className="grid grid-cols-3 gap-x-2 gap-y-5">
            {results.map((movie) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => onPick(movie.id)}
                aria-label={`Abrir ${movie.title}`}
                className="group flex flex-col items-center focus:outline-none"
              >
                <PosterThumb
                  movie={movie}
                  className="h-20 w-20 group-hover:scale-105"
                />
                <span className="mt-2 line-clamp-2 text-xs leading-tight text-neutral-100">
                  {movie.title}
                </span>
                {movie.release_year && (
                  <span className="mt-0.5 text-[10px] text-neutral-500">
                    {movie.release_year}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="mt-6 text-xs text-neutral-400 underline-offset-2 hover:text-white hover:underline"
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
        className="mt-10 text-xs text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline"
      >
        Ver todo el mapa
      </button>
    </main>
  );
}
