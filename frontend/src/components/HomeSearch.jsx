// src/components/HomeSearch.jsx
// Archivo cinematográfico personal con diseño editorial cinéfilo:
// Presenta el objetivo con total claridad, destaca obras en foco con reseñas y
// calificaciones reales de Notion, organiza ciclos por directores clave y
// permite explorar por sensaciones y atmósferas sin clichés de IA.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Loader2,
  Dices,
  Film,
  X,
  ChevronRight,
  ChevronLeft,
  Star,
  Popcorn,
  Sparkles,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { semanticSearch, fetchNextUp } from "../services/api";
import useCineStore from "../store/useCineStore";
import useTmdbSuggestions from "../hooks/useTmdbSuggestions";
import MoviePosterCard, { MovieCardSkeleton } from "./MoviePosterCard";
import LegalModal from "./LegalModal";
import ConnectionDemo from "./landing/ConnectionDemo";
import CriterioSection from "./landing/CriterioSection";

const RESULTS_LIMIT = 6;
const SUGGESTIONS_LIMIT = 5;
const SUGGESTIONS_MIN_CHARS = 2;
const EXTERNAL_LIMIT = 4;

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Atmósferas cinéfilas reales para búsqueda semántica por sensación
// El carrusel de spotlight sale de la landing v2: competía con el H1 y empujaba la
// búsqueda bajo el fold. Se conserva el código detrás de esta bandera.
const SHOW_SPOTLIGHT = false;

// Ejemplos clicables bajo el buscador: dos títulos del archivo y una sensación.
const SEARCH_EXAMPLES = [
  { label: "Parasite", title: "Parasite" },
  { label: "Interstellar", title: "Interstellar" },
  { label: "algo nostálgico", query: "nostalgia memoria pérdida recuerdos del pasado tiempo" },
];

const CINEMATIC_MOODS = [
  {
    label: "Paranoia y laberintos",
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
    label: "Secretos familiares",
    query: "secretos familiares tensión doméstica drama culpa",
  },
  {
    label: "Realidad onírica y dobles",
    query: "realidad ambigua sueños confusión identidad espejo doble",
  },
  {
    label: "Terror psicológico",
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
 *   onShowMap: () => void,
 *   onSpotlightPosterChange?: (posterPath: string | null) => void
 * }} props
 */
export default function HomeSearch({
  onPick,
  onPickExternal,
  onShowNextUp,
  onShowMap,
  onSpotlightPosterChange,
  onShowSelector,
}) {
  const catalog = useCineStore((s) => s.rawGraph.nodes);
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [results, setResults] = useState([]);
  const [heading, setHeading] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [spotlightIndex, setSpotlightIndex] = useState(() => Math.floor(Math.random() * 5));
  const [heroHovered, setHeroHovered] = useState(false);
  const [heroFocused, setHeroFocused] = useState(false);
  const [selectedDirector, setSelectedDirector] = useState(null);
  const [showLegal, setShowLegal] = useState(false);
  const [pendingGems, setPendingGems] = useState([]);
  const requestIdRef = useRef(0);

  // Consultar recomendaciones de películas pendientes afines al gusto marcado con 🟢
  useEffect(() => {
    let cancelled = false;
    fetchNextUp(10, 0, "affinity")
      .then((data) => {
        if (cancelled) return;
        const valid = (data.results || [])
          .filter((r) => r.node && r.node.poster_path)
          .map((r) => ({
            ...r.node,
            isPending: true,
            score: r.score,
            because: r.because,
            anchorMovieId: r.because?.[0]?.id,
          }));
        setPendingGems(valid);
      })
      .catch(() => {
        // En caso de cold start o error de red, fallback transparente a joyas vistas
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Selección viva y dinámica de cabecera:
  // Combina obras maestras del archivo y descubrimientos pendientes en sintonía con el criterio,
  // barajados aleatoriamente en cada recarga para que la sala nunca se sienta estática.
  const spotlightGems = useMemo(() => {
    const seenWithPoster = curatedGems
      .filter((m) => m.poster_path)
      .map((m) => ({ ...m, isPending: false }));

    if (seenWithPoster.length === 0 && pendingGems.length === 0) return [];

    // Muestra aleatoria barajada de obras vistas (4 a 5)
    const shuffledSeen = shuffleArray(seenWithPoster).slice(0, 5);

    // Muestra aleatoria barajada de descubrimientos pendientes afines (3 a 4)
    const shuffledPending = shuffleArray(pendingGems).slice(0, 4);

    // Intercalar orgánicamente: joya vista -> pendiente afin -> joya vista...
    const combined = [];
    const maxLen = Math.max(shuffledSeen.length, shuffledPending.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < shuffledSeen.length) combined.push(shuffledSeen[i]);
      if (i < shuffledPending.length) combined.push(shuffledPending[i]);
    }

    return combined.length > 0 ? combined : seenWithPoster.slice(0, 5);
  }, [curatedGems, pendingGems]);

  const currentSpotlight = spotlightGems[spotlightIndex % Math.max(1, spotlightGems.length)];

  // Saltar de inmediato a otra obra recomendada al azar
  const handleRandomSpotlight = useCallback(() => {
    if (spotlightGems.length <= 1) return;
    setSpotlightIndex((prev) => {
      let next = Math.floor(Math.random() * spotlightGems.length);
      if (next === prev) next = (prev + 1) % spotlightGems.length;
      return next;
    });
  }, [spotlightGems.length]);

  // Sincronizar el afiche de la obra en foco con la atmósfera ambiental de la sala
  useEffect(() => {
    if (SHOW_SPOTLIGHT && onSpotlightPosterChange && currentSpotlight?.poster_path) {
      onSpotlightPosterChange(currentSpotlight.poster_path);
    }
  }, [currentSpotlight, onSpotlightPosterChange]);

  // Precargar los afiches de la selección de foco para transiciones cinematográficas instantáneas
  useEffect(() => {
    for (const gem of spotlightGems) {
      if (gem.poster_path) {
        const img = new Image();
        img.src = `https://image.tmdb.org/t/p/w780${gem.poster_path}`;
      }
    }
  }, [spotlightGems]);

  // Rotación orgánica de la proyección en cabecera (cada 9s, pausada al interactuar con el cursor,
  // tener foco de teclado o si el usuario prefiere movimiento reducido según WCAG 2.2.2)
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (
      prefersReducedMotion ||
      heroHovered ||
      heroFocused ||
      spotlightGems.length <= 1 ||
      status !== "idle"
    ) {
      return;
    }

    const interval = setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % spotlightGems.length);
    }, 9000);
    return () => clearInterval(interval);
  }, [heroHovered, heroFocused, spotlightGems.length, status]);

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
    <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-24 pt-6 sm:pt-10 text-center">
      {/* 1. Hero: la tesis del producto y la acción principal arriba del fold */}
      {status === "idle" && (
        <header className="flex max-w-4xl flex-col items-center gap-4">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
            Una selección de{" "}
            <button
              type="button"
              onClick={onShowSelector}
              className="uppercase tracking-[0.14em] text-amber-400 underline decoration-amber-400/30 underline-offset-4 transition-colors hover:decoration-amber-400 focus-ring-cinematic rounded"
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
            Cada película está conectada con otras por su director o por cómo se siente.
            Y cuando tengo algo que decir, va mi nota y mi reseña.
          </p>
        </header>
      )}

      {/* 2. LA GRAN PANTALLA: Selección Dinámica de Cabecera (Editorial Stage) */}
      {SHOW_SPOTLIGHT && status === "idle" && currentSpotlight && (
        <section
          onMouseEnter={() => setHeroHovered(true)}
          onMouseLeave={() => setHeroHovered(false)}
          onFocus={() => setHeroFocused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setHeroFocused(false);
            }
          }}
          className="relative mt-8 sm:mt-10 w-full text-left border-y border-white/[0.06] py-8 sm:py-10"
          aria-label="Obra en foco del archivo"
        >
          <div
            key={`${currentSpotlight.id}-${currentSpotlight.isPending ? "pending" : "seen"}`}
            className="flex flex-col md:flex-row items-center md:items-start gap-7 sm:gap-10 animate-view-enter"
          >
            {/* Afiche cinematográfico 2:3 */}
            <div className="shrink-0 flex flex-col items-center">
              <button
                type="button"
                className="relative group cursor-pointer focus-ring-cinematic rounded-xl text-left"
                aria-label={`Ver detalles de ${currentSpotlight.title}`}
                onClick={() => {
                  if (currentSpotlight.isPending) {
                    onPickExternal(currentSpotlight);
                  } else {
                    onPick(currentSpotlight.id);
                  }
                }}
              >
                <MoviePosterCard
                  movie={currentSpotlight}
                  size="xl"
                  showBadge={false}
                />
              </button>
              <div className="mt-2.5 text-center">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-400">
                  {currentSpotlight.isPending ? "Por ver · Afinidad" : "Palma del Archivo"}
                </span>
              </div>
            </div>

            {/* Metadatos editoriales y Reseña o Afinidades */}
            <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
              <div>
                {/* Cabecera técnica y control de reel */}
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-2.5">
                  <div className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400/90" />
                    <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.16em] text-neutral-400 font-medium">
                      {currentSpotlight.isPending
                        ? "Descubrimiento Pendiente · En tu Sintonía"
                        : "Selección Oficial · Recomendación de Autor"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <button
                      type="button"
                      onClick={handleRandomSpotlight}
                      title="Explorar otra recomendación al azar"
                      className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 text-[10px] font-mono text-neutral-300 hover:border-white/20 hover:text-white transition-all active:scale-95"
                    >
                      <Dices size={11} className="text-amber-400" />
                      <span className="hidden sm:inline">Al azar</span>
                    </button>

                    {spotlightGems.length > 1 && (
                      <div className="flex items-center gap-1 font-mono text-[10px] text-neutral-400">
                        <button
                          type="button"
                          onClick={prevSpotlight}
                          aria-label="Obra anterior en foco"
                          className="rounded p-1 hover:bg-white/[0.06] hover:text-white transition-colors"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span className="tabular-nums min-w-[40px] text-center">
                          {String((spotlightIndex % spotlightGems.length) + 1).padStart(2, "0")} / {String(spotlightGems.length).padStart(2, "0")}
                        </span>
                        <button
                          type="button"
                          onClick={nextSpotlight}
                          aria-label="Siguiente obra en foco"
                          className="rounded p-1 hover:bg-white/[0.06] hover:text-white transition-colors"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadatos técnicos */}
                <p className="mt-3 font-mono text-[10px] tracking-[0.14em] text-neutral-400 uppercase">
                  {[
                    currentSpotlight.director ? `Dir. ${currentSpotlight.director}` : null,
                    currentSpotlight.release_year,
                    currentSpotlight.main_genre,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

                {/* Título Display de escala cinematográfica */}
                <h2 className="mt-1 font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-white tracking-tight leading-[1.08]">
                  {currentSpotlight.title}
                </h2>

                {/* Calificación de autor o Porcentaje de afinidad cinéfila */}
                {!currentSpotlight.isPending && currentSpotlight.rating && (
                  <div className="mt-2.5 flex items-center gap-2" aria-label={`${currentSpotlight.rating} de 5 estrellas`}>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          size={12}
                          className={
                            i < currentSpotlight.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-neutral-700"
                          }
                        />
                      ))}
                    </div>
                    <span className="font-mono text-[11px] text-neutral-400">
                      {currentSpotlight.rating} / 5 · Calificación del autor
                    </span>
                  </div>
                )}

                {currentSpotlight.isPending && (
                  <div className="mt-2.5 flex items-center gap-2 text-xs font-mono text-neutral-300">
                    <span className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-neutral-200">
                      <Sparkles size={11} className="text-amber-400" />
                      {Math.round((currentSpotlight.score || 0.85) * 100)}% afinidad estética
                    </span>
                    <span className="text-neutral-500 text-[10px]">con tu canon personal</span>
                  </div>
                )}

                {/* Crítica personal editorial (sin caja envolvente pesada) */}
                {!currentSpotlight.isPending && currentSpotlight.review && (
                  <div className="my-4 border-l border-amber-500/40 pl-4 py-0.5 text-left">
                    <p className="font-serif text-sm sm:text-base italic leading-relaxed text-neutral-200">
                      “{currentSpotlight.review}”
                    </p>
                    <span className="mt-2 block font-mono text-[10px] tracking-[0.14em] text-neutral-400 uppercase">
                      — El Selector · Cuaderno de notas
                    </span>
                  </div>
                )}

                {currentSpotlight.isPending && (
                  <div className="my-4 border-l border-white/20 pl-4 py-0.5 text-left">
                    <p className="font-serif text-sm sm:text-base italic leading-relaxed text-neutral-300">
                      “Aún no la has visto, pero su atmósfera y autoría conectan directamente con{" "}
                      <span className="text-white font-medium">
                        {currentSpotlight.because?.map((b) => b.title).join(" y ") || "obras de tu archivo"}
                      </span>
                      , títulos que forman parte de tu registro personal.”
                    </p>
                    <span className="mt-2 block font-mono text-[10px] tracking-[0.14em] text-neutral-400 uppercase">
                      — Afinidad semántica vectorial
                    </span>
                  </div>
                )}
              </div>

              {/* Botones de acción jerarquizados: 1 Primario + Secundarios limpios */}
              <div className="mt-5 pt-2 flex flex-wrap items-center gap-2.5">
                {!currentSpotlight.isPending ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onPick(currentSpotlight.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs sm:text-sm font-medium text-neutral-950 transition-all hover:bg-neutral-200 active:scale-95 shadow-sm"
                    >
                      <span>Explorar constelación (6 conexiones)</span>
                      <ArrowRight size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={onShowNextUp}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-neutral-300 transition-all hover:border-white/20 hover:bg-white/[0.07] hover:text-white active:scale-95"
                    >
                      <Popcorn size={14} className="text-neutral-400" />
                      <span>¿Qué veo hoy?</span>
                    </button>
                  </>
                ) : (
                  <>
                    {currentSpotlight.anchorMovieId && (
                      <button
                        type="button"
                        onClick={() => onPick(currentSpotlight.anchorMovieId)}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs sm:text-sm font-medium text-neutral-950 transition-all hover:bg-neutral-200 active:scale-95 shadow-sm"
                      >
                        <span>Ver constelación de {currentSpotlight.because?.[0]?.title || "tu archivo"}</span>
                        <ArrowRight size={14} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onPickExternal(currentSpotlight)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-neutral-300 transition-all hover:border-white/20 hover:bg-white/[0.07] hover:text-white active:scale-95"
                    >
                      <Film size={14} className="text-neutral-400" />
                      <span>Ficha de la obra</span>
                    </button>

                    <button
                      type="button"
                      onClick={onShowNextUp}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-neutral-300 transition-all hover:border-white/20 hover:bg-white/[0.07] hover:text-white active:scale-95"
                    >
                      <Popcorn size={14} className="text-neutral-400" />
                      <span>Dónde verla</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={nextSpotlight}
                  className="text-xs text-neutral-400 hover:text-white transition-colors ml-auto sm:ml-2 font-mono text-[11px]"
                >
                  Siguiente obra →
                </button>
              </div>
            </div>
          </div>
        </section>
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
          className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.12] bg-surface/90 px-5 py-4 shadow-surface-elevated transition-all duration-200 focus-within:border-amber-400/60"
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
                  <span className="text-[11px] text-amber-400/90 font-mono">
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
              <Sparkles size={15} className="shrink-0 text-amber-400/80" />
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

      {/* Chips de Atmósferas Cinéfilas Reales */}
      {status === "idle" && (
        <div className="mt-4 -mx-4 flex w-[calc(100%+2rem)] flex-nowrap items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:max-w-3xl sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:pb-0">
          {CINEMATIC_MOODS.map((mood) => (
            <button
              key={mood.label}
              type="button"
              onClick={() => handleMoodClick(mood)}
              className="shrink-0 whitespace-nowrap rounded-full border border-white/[0.07] bg-white/[0.02] px-3 py-1 text-xs text-neutral-400 hover:border-white/20 hover:bg-white/[0.05] hover:text-neutral-200 transition-all duration-150 active:scale-95"
            >
              {mood.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleSurprise}
            disabled={isLoading}
            className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-950/20 px-3 py-1 text-xs font-mono text-amber-300 hover:border-amber-500/50 hover:bg-amber-950/30 transition-all duration-150 active:scale-95 disabled:opacity-50"
          >
            <Dices size={12} className="text-amber-400" />
            <span>Sorpréndeme</span>
          </button>
        </div>
      )}

      {status === "idle" && (
        <p className="mt-4 text-xs text-neutral-400">
          Prueba con{" "}
          {SEARCH_EXAMPLES.map((ex, i) => (
            <span key={ex.label}>
              {i > 0 && <span aria-hidden="true"> · </span>}
              <button
                type="button"
                onClick={() => handleExample(ex)}
                className="text-neutral-300 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-amber-400/60 focus-ring-cinematic rounded"
              >
                {ex.label}
              </button>
            </span>
          ))}
        </p>
      )}

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
                      ? "border-amber-400/60 bg-amber-950/30"
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
                Películas de {selectedDirector} en el archivo:
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

      {/* 5b. Salida alternativa: sin película en mente */}
      {status === "idle" && (
        <section className="mt-14 w-full" aria-label="¿Qué veo hoy?">
          <div className="flex flex-col items-start gap-4 rounded-2xl border border-white/[0.08] bg-surface/60 px-5 py-5 text-left sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="min-w-0">
              <h3 className="font-serif text-xl text-white">¿Sin una película en mente?</h3>
              <p className="mt-1 text-sm text-neutral-400">Elige tus plataformas y te sugiero qué ver hoy.</p>
            </div>
            <button
              type="button"
              onClick={onShowNextUp}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-medium text-neutral-950 transition-all hover:bg-amber-300 active:scale-95 focus-ring-cinematic"
            >
              <Popcorn size={15} />
              ¿Qué veo hoy?
            </button>
          </div>
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
          <div className="mb-6 text-center border-b border-white/[0.06] pb-4">
            <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-400">
              Conexiones del archivo
            </span>
            <h2 className="font-serif text-2xl font-normal text-white mt-1">{heading}</h2>
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

          <button
            type="button"
            onClick={handleReset}
            className="mt-10 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs text-neutral-300 transition-colors hover:border-white/20 hover:text-white focus-ring-cinematic"
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
          <p className="text-xs text-neutral-400 mt-1">
            Prueba con otra sensación o selecciona una obra del archivo.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs text-neutral-300 transition-colors hover:border-white/20 hover:text-white focus-ring-cinematic"
          >
            Volver
          </button>
        </div>
      )}

      {status === "error" && (
        <p className="mt-6 max-w-sm text-sm text-red-400">
          No pudimos buscar en este momento. Intenta de nuevo en unos segundos.
          <span className="mt-1 block text-xs text-neutral-400">{errorMsg}</span>
        </p>
      )}

      {/* 7. Mapa global y Sello de Sala del Archivo */}
      <footer className="mt-20 pt-8 border-t border-white/[0.06] w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400 font-mono">
        <button
          type="button"
          onClick={onShowMap}
          className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 text-xs font-medium text-neutral-300 hover:border-white/20 hover:text-white active:scale-95 focus-ring-cinematic transition-all"
        >
          <Film size={13} className="text-amber-400" />
          <span>Ver mapa de conexiones completo</span>
        </button>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-neutral-400 sm:justify-end">
          <button type="button" onClick={onShowSelector} className="uppercase tracking-[0.14em] hover:text-white transition-colors focus-ring-cinematic rounded">
            Quién elige
          </button>
          <button type="button" onClick={() => setShowLegal(true)} className="uppercase tracking-[0.14em] hover:text-white transition-colors focus-ring-cinematic rounded">
            Aviso legal y atribución
          </button>
          <span>Datos de TMDB</span>
        </div>
        <LegalModal isOpen={showLegal} onClose={() => setShowLegal(false)} />
      </footer>
    </main>
  );
}
