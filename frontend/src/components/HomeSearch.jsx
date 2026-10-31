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
    if (onSpotlightPosterChange && currentSpotlight?.poster_path) {
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
      {/* 1. Manifiesto y Encabezado Editorial */}
      {status === "idle" && (
        <header className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-0.5 text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-400">
            <span>Archivo Cinematográfico · Curaduría de Autor</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-white leading-[1.1]">
            Watchlist con Criterio
          </h1>

          <p className="mx-auto max-w-lg text-xs sm:text-sm text-neutral-400 leading-relaxed font-normal">
            Una cartografía viva del cine conectada por autoría, atmósfera y obsesiones compartidas.
            Selecciona una obra para desplegar su constelación de{" "}
            <span className="text-neutral-200 font-medium">6 conexiones directas</span>.
          </p>
        </header>
      )}

      {/* 2. LA GRAN PANTALLA: Selección Dinámica de Cabecera (Editorial Stage) */}
      {status === "idle" && currentSpotlight && (
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
                      — Juan Camilo · Cuaderno de notas
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
        className="relative mt-8 sm:mt-10 w-full max-w-2xl"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setSuggestOpen(false);
            setActiveIndex(-1);
          }
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-[#121215]/90 px-4 py-3 shadow-surface-elevated transition-all duration-200 focus-within:border-amber-400/50"
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
            placeholder="Busca una película, director o atmósfera (ej: paranoia nocturna, laberintos mentales)..."
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
            className="flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-500 font-sans"
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
            className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-white/[0.08] bg-[#121215] text-left shadow-2xl"
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
                  Buscar por afinidad de atmósfera: “{inputValue.trim()}”
                </span>
                <span className="block text-xs text-neutral-400">
                  Presiona Enter para calcular conexiones
                </span>
              </span>
            </li>
          </ul>
        )}
      </div>

      {/* Chips de Atmósferas Cinéfilas Reales */}
      {status === "idle" && (
        <div className="mt-3.5 flex flex-wrap justify-center items-center gap-1.5 max-w-3xl">
          {CINEMATIC_MOODS.map((mood) => (
            <button
              key={mood.label}
              type="button"
              onClick={() => handleMoodClick(mood)}
              className="rounded-full border border-white/[0.07] bg-white/[0.02] px-3 py-1 text-xs text-neutral-400 hover:border-white/20 hover:bg-white/[0.05] hover:text-neutral-200 transition-all duration-150 active:scale-95"
            >
              {mood.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleSurprise}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-950/20 px-3 py-1 text-xs font-mono text-amber-300 hover:border-amber-500/50 hover:bg-amber-950/30 transition-all duration-150 active:scale-95 disabled:opacity-50"
          >
            <Dices size={12} className="text-amber-400" />
            <span>Al azar</span>
          </button>
        </div>
      )}

      {/* 4. SECCIÓN EDITORIAL: JOYAS DEL ARCHIVO */}
      {status === "idle" && curatedGems.length > 0 && (
        <section className="mt-14 w-full text-left" aria-label="Joyas del archivo">
          <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between border-b border-white/[0.06] pb-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-400">
                № · Selección Oficial
              </span>
              <h3 className="font-serif text-xl sm:text-2xl font-normal text-white mt-0.5">
                Joyas del Archivo
              </h3>
            </div>
            <span className="text-[10px] font-mono text-neutral-400 mt-1 sm:mt-0">
              Obras de máxima calificación · Toca para abrir constelación
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5 sm:gap-4">
            {curatedGems.slice(0, 6).map((movie, idx) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => onPick(movie.id)}
                aria-label={`Abrir constelación de ${movie.title}`}
                className="group flex flex-col items-center text-center focus-ring-cinematic rounded-lg p-1"
              >
                <div className="relative">
                  <div className="absolute -top-2 left-1 z-20 rounded bg-neutral-950/90 px-1 py-0.2 border border-white/10 text-[8px] font-mono font-medium text-neutral-400 tracking-wider">
                    № {String(idx + 1).padStart(2, "0")}
                  </div>
                  <MoviePosterCard movie={movie} size="sm" showBadge={false} />
                </div>
                <span className="mt-2 line-clamp-1 max-w-[110px] text-xs font-medium text-neutral-200 group-hover:text-white transition-colors">
                  {movie.title}
                </span>
                <span className="text-[10px] font-mono text-neutral-400 truncate max-w-[110px]">
                  {[movie.release_year, movie.director].filter(Boolean).join(" · ")}
                </span>
                {movie.rating && (
                  <span className="mt-0.5 text-[10px] font-mono text-amber-400/80">
                    ★ {movie.rating}
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

          {/* Filtros de Directores */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {keyDirectors.slice(0, 6).map(({ name, count }) => {
              const isSelected = selectedDirector === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedDirector(isSelected ? null : name)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all focus-ring-cinematic ${
                    isSelected
                      ? "bg-white text-neutral-950 font-medium"
                      : "border border-white/[0.08] bg-white/[0.02] text-neutral-400 hover:border-white/20 hover:text-neutral-200"
                  }`}
                >
                  <span>{name}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? "text-neutral-700" : "text-neutral-400"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Shelf de Películas del Director Seleccionado */}
          {selectedDirector && directorMovies.length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-[#121215]/60 p-4 mb-6">
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

        <span className="text-[10px] text-neutral-400 uppercase tracking-[0.14em] text-center sm:text-right">
          Watchlist con Criterio · Notion & Neon · Curaduría de Juan Camilo
        </span>
      </footer>
    </main>
  );
}
