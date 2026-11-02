// src/components/NextUpView.jsx
// Fase 2: "¿Qué veo hoy?" — recomendador cinéfilo sobre la lista de pendientes:
// Formato vertical 2:3, razones de afinidad destacadas como sellos de recomendación,
// esqueletos de carga animados y filtro por las plataformas del visitante (JustWatch vía TMDB).
// País y plataformas son los de "Cómo ves cine" (useCountry): los mismos de la ficha.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search, X, Popcorn, Tv, Filter, Sparkles, User } from "lucide-react";
import { fetchNextUp, semanticSearch, fetchWatchProviders } from "../services/api";
import useCountry, { useMyPlatforms } from "../hooks/useCountry";
import useRegionPlatforms from "../hooks/useRegionPlatforms";
import { countryName } from "../lib/countries";
import { isMine, LOGO_BASE, normalizePlatformName } from "../lib/platforms";
import CountrySelect from "./CountrySelect";
import PlatformPicker from "./PlatformPicker";
import MovieInfo from "./MovieInfo";
import MoviePosterCard, { MovieCardSkeleton } from "./MoviePosterCard";

const LIMIT = 12; // 12 opciones para dar suficiente variedad al filtrar por plataforma
// Filtro de disponibilidad: todo, solo en mis plataformas, o en cualquier suscripción.
const FILTERS = { ALL: "all", MINE: "mine", ANY: "any" };

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
  const [recommendMode, setRecommendMode] = useState("affinity"); // "affinity" | "director"
  const [selectedId, setSelectedId] = useState(null);
  const mine = useMyPlatforms();
  // Con plataformas elegidas, la vista arranca filtrando por ellas.
  const [filter, setFilter] = useState(() => (mine.length ? FILTERS.MINE : FILTERS.ALL));
  const [pickerOpen, setPickerOpen] = useState(() => mine.length === 0);
  const [providersMap, setProvidersMap] = useState({});
  const [providersLoading, setProvidersLoading] = useState(false);

  const country = useCountry((s) => s.country);
  const { platforms: regionPlatforms } = useRegionPlatforms(country);
  const mineNames = useMemo(
    () => mine.map((k) => regionPlatforms.find((p) => p.key === k)?.name ?? k),
    [mine, regionPlatforms],
  );

  const requestIdRef = useRef(0);
  const infoRef = useRef(null);

  const load = useCallback(async (moodText, offset = 0, overrideMode = null) => {
    const requestId = ++requestIdRef.current;
    setState((s) => ({ ...s, status: "loading", error: "" }));
    setSelectedId(null);
    setActiveMood(moodText);
    const targetMode = overrideMode || recommendMode;
    try {
      let items;
      let data;
      if (moodText) {
        data = await semanticSearch(moodText, LIMIT, "pending", offset);
        items = (data.results ?? []).map((node) => ({ node }));
      } else {
        data = await fetchNextUp(LIMIT, offset, targetMode);
        items = data.results ?? [];
      }
      if (requestId !== requestIdRef.current) return;
      setState({ status: "done", items, error: "", offset, hasMore: Boolean(data.hasMore) });
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setState({ status: "error", items: [], error: err.message, offset, hasMore: false });
    }
  }, [recommendMode]);

  useEffect(() => {
    load("");
  }, [load]);

  useEffect(() => {
    if (selectedId != null) {
      infoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedId]);

  // Consultar disponibilidad de streaming en paralelo para las películas cargadas
  useEffect(() => {
    const tmdbIds = state.items.map((it) => it.node.tmdb_id).filter(Boolean);
    if (!tmdbIds.length) {
      setProvidersMap({});
      return;
    }

    let cancelled = false;
    setProvidersLoading(true);

    Promise.allSettled(
      tmdbIds.map((id) =>
        fetchWatchProviders(id, country).then((data) => ({ id, data }))
      )
    ).then((results) => {
      if (cancelled) return;
      const map = {};
      for (const res of results) {
        if (res.status === "fulfilled" && res.value) {
          map[res.value.id] = res.value.data;
        }
      }
      setProvidersMap(map);
      setProvidersLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [state.items, country]);

  const handleSubmit = (e) => {
    e.preventDefault();
    load(mood.trim());
  };

  const handleClearMood = () => {
    setMood("");
    load("");
  };

  const handleModeChange = (newMode) => {
    setRecommendMode(newMode);
    setMood("");
    setActiveMood("");
    load("", 0, newMode);
  };

  const { status, items, error, offset, hasMore } = state;

  const handleMore = () => load(activeMood, hasMore ? offset + LIMIT : 0);

  // Si quita todas sus plataformas, el filtro "las mías" deja de tener sentido.
  useEffect(() => {
    if (!mine.length && filter === FILTERS.MINE) setFilter(FILTERS.ALL);
  }, [mine.length, filter]);

  // Elegir la primera plataforma activa el filtro: es lo que el visitante vino a hacer.
  const prevMineCount = useRef(mine.length);
  useEffect(() => {
    if (prevMineCount.current === 0 && mine.length > 0) setFilter(FILTERS.MINE);
    prevMineCount.current = mine.length;
  }, [mine.length]);

  const filteredItems = useMemo(() => {
    if (filter === FILTERS.ALL) return items;
    return items.filter((it) => {
      const streamList = providersMap[it.node.tmdb_id]?.stream;
      if (!Array.isArray(streamList) || streamList.length === 0) return false;
      return filter === FILTERS.ANY || streamList.some((p) => isMine(p, mine));
    });
  }, [items, providersMap, filter, mine]);

  const filterChip = (active) =>
    `inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
      active
        ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 ring-1 ring-emerald-500/20"
        : "bg-white/5 text-neutral-400 hover:text-white border border-white/5 hover:bg-white/10"
    }`;

  return (
    <section
      className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 pb-16 pt-4 text-center"
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
            : recommendMode === "director"
              ? "Obras pendientes dirigidas por los mismos autores presentes en tu catálogo."
              : "Pendientes que mejor encajan con tus películas mejor valoradas del catálogo."}
        </p>
      </div>

      {/* Selector de modo de recomendación */}
      <div className="mt-3 flex items-center justify-center gap-1.5 p-1 rounded-full border border-white/10 bg-neutral-900/60 backdrop-blur-md">
        <button
          type="button"
          onClick={() => handleModeChange("affinity")}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
            recommendMode === "affinity" && !activeMood
              ? "bg-white/15 text-white shadow-sm border border-white/20"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <Sparkles size={13} className="text-emerald-400" />
          <span>Por afinidad estética</span>
        </button>

        <button
          type="button"
          onClick={() => handleModeChange("director")}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
            recommendMode === "director" && !activeMood
              ? "bg-white/15 text-white shadow-sm border border-white/20"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <User size={13} className="text-accent-400" />
          <span>De autores en tu archivo</span>
        </button>
      </div>

      {/* Barra de búsqueda por sensación */}
      <form
        onSubmit={handleSubmit}
        className="mt-4 flex w-full max-w-xl items-center gap-2 rounded-full border border-white/15 bg-neutral-900/90 px-4 py-2.5 shadow-xl backdrop-blur-md transition-all focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20"
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

      {/* Disponibilidad: país, mis plataformas y filtro */}
      <div className="mt-5 w-full max-w-xl flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-left backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-neutral-400">
          <span className="flex items-center gap-1.5 font-medium">
            <Filter size={12} className="text-emerald-400" />
            Dónde verlas
            {providersLoading && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" title="Cargando plataformas..." />
            )}
          </span>
          <CountrySelect />
        </div>

        {status === "done" && items.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <button type="button" onClick={() => setFilter(FILTERS.ALL)} className={filterChip(filter === FILTERS.ALL)}>
              Todas ({items.length})
            </button>
            {mine.length > 0 && (
              <button type="button" onClick={() => setFilter(FILTERS.MINE)} className={filterChip(filter === FILTERS.MINE)}>
                En mis plataformas
              </button>
            )}
            <button type="button" onClick={() => setFilter(FILTERS.ANY)} className={filterChip(filter === FILTERS.ANY)}>
              <Tv size={11} />
              Cualquier suscripción
            </button>
          </div>
        )}

        <div className="border-t border-white/10 px-1 pt-2">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            className="text-[11px] text-neutral-400 hover:text-white focus-ring-cinematic rounded"
          >
            {mine.length
              ? `Mis plataformas en ${countryName(country)}: ${mineNames.join(", ")} · ${pickerOpen ? "Listo" : "Editar"}`
              : `¿Qué plataformas tienes en ${countryName(country)}?`}
          </button>
          {pickerOpen && (
            <div className="mt-2">
              <PlatformPicker />
            </div>
          )}
        </div>
      </div>

      {status === "loading" && (
        <div className="mt-8 grid w-full grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4" aria-label="Cargando recomendaciones">
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
          <span className="mt-1 block text-xs text-neutral-400">{error}</span>
        </p>
      )}

      {status === "done" && items.length === 0 && (
        <p className="mt-8 max-w-sm text-sm text-neutral-400">
          No encontré películas en tu lista con esa atmósfera. Prueba con otras palabras.
        </p>
      )}

      {status === "done" && items.length > 0 && filteredItems.length === 0 && (
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center max-w-md">
          <Tv size={24} className="mx-auto text-neutral-400 mb-2" />
          <p className="text-sm font-medium text-neutral-300">
            {filter === FILTERS.MINE
              ? `Ninguna de estas está en ${mineNames.join(", ")} en ${countryName(country)}.`
              : `Ninguna de estas está en suscripción en ${countryName(country)}.`}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setFilter(FILTERS.ALL)}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs text-white hover:bg-white/20 transition-all focus-ring-cinematic"
            >
              Ver todas ({items.length})
            </button>
            {hasMore && (
              <button
                type="button"
                onClick={handleMore}
                className="rounded-full border border-emerald-500/40 bg-emerald-950/60 px-4 py-1.5 text-xs text-emerald-300 hover:bg-emerald-950 transition-all focus-ring-cinematic"
              >
                Cargar otras opciones
              </button>
            )}
          </div>
        </div>
      )}

      {status === "done" && filteredItems.length > 0 && (
        <div className="mt-8 grid w-full grid-cols-3 gap-x-3 gap-y-7 sm:grid-cols-4 sm:gap-x-4">
          {filteredItems.map(({ node, because }) => {
            const isSelected = selectedId === node.id;
            const watchInfo = providersMap[node.tmdb_id];
            // Las plataformas del visitante primero.
            const streamList = [...(watchInfo?.stream || [])].sort(
              (a, b) => isMine(b, mine) - isMine(a, mine),
            );

            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedId((id) => (id === node.id ? null : node.id))}
                aria-pressed={isSelected}
                aria-label={`Ver ficha de ${node.title}`}
                className="group flex flex-col items-center focus-ring-cinematic rounded-xl p-1"
              >
                <div className={`transition-all duration-300 ${isSelected ? "scale-105" : "group-hover:-translate-y-1"}`}>
                  <MoviePosterCard
                    movie={node}
                    size="md"
                    selected={isSelected}
                    accentColor={recommendMode === "director" && !activeMood ? "accent" : "emerald"}
                  />
                </div>
                <span className="mt-2.5 line-clamp-2 max-w-[125px] text-xs font-medium leading-snug text-neutral-200 group-hover:text-white transition-colors">
                  {node.title}
                </span>
                <span className="mt-0.5 text-[11px] text-neutral-400">
                  {[node.release_year, recommendMode === "director" && !activeMood ? node.director : null].filter(Boolean).join(" · ")}
                </span>

                {/* Plataformas de Streaming disponibles */}
                {streamList.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1 max-w-[120px]">
                    {streamList.slice(0, 2).map((p) => (
                      <span
                        key={p.id}
                        title={`En suscripción: ${p.name}`}
                        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium ${
                          isMine(p, mine)
                            ? "border-emerald-500/40 bg-emerald-950/70 text-emerald-200"
                            : "border-white/10 bg-neutral-900/90 text-neutral-300"
                        }`}
                      >
                        {p.logo_path && (
                          <img
                            src={`${LOGO_BASE}${p.logo_path}`}
                            alt=""
                            className="h-2.5 w-2.5 rounded-xs object-cover"
                          />
                        )}
                        <span className="truncate max-w-[50px]">{normalizePlatformName(p.name)}</span>
                      </span>
                    ))}
                    {streamList.length > 2 && (
                      <span className="text-[9px] text-neutral-400 font-medium">
                        +{streamList.length - 2}
                      </span>
                    )}
                  </div>
                )}

                {because?.length > 0 && (
                  <span
                    title={
                      recommendMode === "director" && !activeMood
                        ? `Del realizador de ${because[0].title} (${node.director})`
                        : `Afinidad con ${because[0].title}`
                    }
                    className={`mt-1.5 flex items-center justify-center gap-1 max-w-[125px] rounded-full px-2 py-0.5 text-[9px] font-medium leading-tight ${
                      recommendMode === "director" && !activeMood
                        ? "bg-accent-950/70 border border-accent-500/30 text-accent-300"
                        : "bg-emerald-950/70 border border-emerald-500/30 text-emerald-300"
                    }`}
                  >
                    {recommendMode === "director" && !activeMood ? (
                      <User size={9} className="shrink-0 text-accent-400" />
                    ) : (
                      <span className="block h-1 w-1 rounded-full bg-emerald-400 shrink-0" />
                    )}
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
          className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs font-medium text-neutral-200 backdrop-blur-md transition-all hover:border-emerald-500/40 hover:bg-white/10 hover:text-white"
        >
          <RefreshCw size={13} className="text-emerald-400" />
          {hasMore ? "Ver otras opciones" : "Volver a las primeras"}
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
