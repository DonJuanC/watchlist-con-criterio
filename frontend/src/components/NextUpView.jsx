// src/components/NextUpView.jsx
// Fase 2: "¿Qué veo hoy?" — recomendador cinéfilo sobre la lista de pendientes:
// Formato vertical 2:3, razones de afinidad destacadas como sellos de recomendación,
// esqueletos de carga animados y filtros en vivo por plataforma de streaming (JustWatch vía TMDB).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search, X, Popcorn, Tv, Globe, Filter, Sparkles, User, Check } from "lucide-react";
import { fetchNextUp, semanticSearch, fetchWatchProviders } from "../services/api";
import useCountry from "../hooks/useCountry";
import MovieInfo from "./MovieInfo";
import MoviePosterCard, { MovieCardSkeleton } from "./MoviePosterCard";

const LIMIT = 12; // 12 opciones para dar suficiente variedad al filtrar por plataforma
const LOGO_BASE = "https://image.tmdb.org/t/p/w45";
const COUNTRIES = ["CO", "MX", "AR", "CL", "PE", "EC", "VE", "UY", "ES", "US", "CA", "GB", "BR"];

let regionNames = null;
function countryName(code) {
  try {
    regionNames ??= new Intl.DisplayNames(["es"], { type: "region" });
    return regionNames.of(code) || code;
  } catch {
    return code;
  }
}

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
  const [selectedProviders, setSelectedProviders] = useState(() => {
    try {
      const saved = localStorage.getItem("watchlist_selected_providers");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [streamOnly, setStreamOnly] = useState(false);
  const [providersMap, setProvidersMap] = useState({});
  const [providersLoading, setProvidersLoading] = useState(false);

  const country = useCountry((s) => s.country);
  const setCountry = useCountry((s) => s.setCountry);

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

  // Obtener plataformas de streaming disponibles en el lote actual
  const availablePlatforms = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const provs = providersMap[it.node.tmdb_id]?.stream;
      if (Array.isArray(provs)) {
        for (const p of provs) {
          const cleanName = p.name.replace(/ Amazon Channel$/, "").replace(/ with Ads$/, "");
          if (!map.has(cleanName)) {
            map.set(cleanName, {
              id: p.id,
              name: cleanName,
              logo_path: p.logo_path,
            });
          }
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, providersMap]);

  // Alternar selección de una plataforma (selección múltiple / OR lógico)
  const handleToggleProvider = useCallback((name) => {
    setStreamOnly(false);
    setSelectedProviders((prev) => {
      const exists = prev.some((p) => p.toLowerCase() === name.toLowerCase());
      const next = exists
        ? prev.filter((p) => p.toLowerCase() !== name.toLowerCase())
        : [...prev, name];
      try {
        localStorage.setItem("watchlist_selected_providers", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Seleccionar todas (sin filtro por plataforma específica)
  const handleSelectAll = useCallback(() => {
    setSelectedProviders([]);
    setStreamOnly(false);
    try {
      localStorage.removeItem("watchlist_selected_providers");
    } catch {}
  }, []);

  // Filtrar por cualquier servicio de suscripción
  const handleSelectStreamOnly = useCallback(() => {
    setSelectedProviders([]);
    setStreamOnly(true);
    try {
      localStorage.removeItem("watchlist_selected_providers");
    } catch {}
  }, []);

  // Filtrado de las películas según una o varias plataformas seleccionadas
  const filteredItems = useMemo(() => {
    // Si no hay plataformas seleccionadas ni filtro global, mostrar todas
    if (!streamOnly && selectedProviders.length === 0) return items;

    // Si se activa "Cualquier suscripción" sin plataformas específicas
    if (streamOnly && selectedProviders.length === 0) {
      return items.filter((it) => {
        const streamList = providersMap[it.node.tmdb_id]?.stream;
        return Array.isArray(streamList) && streamList.length > 0;
      });
    }

    // Filtrar por una o varias plataformas (disponible en CUALQUIERA de las elegidas)
    return items.filter((it) => {
      const streamList = providersMap[it.node.tmdb_id]?.stream;
      if (!Array.isArray(streamList) || streamList.length === 0) return false;

      return streamList.some((p) => {
        const clean = p.name.replace(/ Amazon Channel$/, "").replace(/ with Ads$/, "").toLowerCase();
        return selectedProviders.some(
          (sp) => clean.includes(sp.toLowerCase()) || sp.toLowerCase().includes(clean)
        );
      });
    });
  }, [items, providersMap, selectedProviders, streamOnly]);

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
          <User size={13} className="text-amber-400" />
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

      {/* Barra de Filtros de Streaming y Selector de País */}
      {status === "done" && items.length > 0 && (
        <div className="mt-5 w-full max-w-xl flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2 mb-1 text-xs text-neutral-400 px-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Filter size={12} className="text-emerald-400" />
                Filtrar por streaming:
                {providersLoading && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" title="Cargando plataformas..." />
                )}
              </span>

              {selectedProviders.length > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                  <span>
                    {selectedProviders.length} seleccionada{selectedProviders.length > 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    title="Quitar filtros"
                    className="hover:text-white transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>

            {/* Selector de País */}
            <div className="flex items-center gap-1">
              <Globe size={11} className="text-neutral-400" />
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                aria-label="Cambiar país para disponibilidad de streaming"
                className="bg-transparent text-[11px] font-medium text-emerald-300 outline-none cursor-pointer hover:text-emerald-200"
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c} className="bg-neutral-900 text-white">
                    {countryName(c)} ({c})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Chips de plataformas con selección múltiple */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={handleSelectAll}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                !streamOnly && selectedProviders.length === 0
                  ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 ring-1 ring-emerald-500/20"
                  : "bg-white/5 text-neutral-400 hover:text-white border border-white/5 hover:bg-white/10"
              }`}
            >
              Todas ({items.length})
            </button>

            <button
              type="button"
              onClick={handleSelectStreamOnly}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                streamOnly
                  ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 ring-1 ring-emerald-500/20"
                  : "bg-white/5 text-neutral-400 hover:text-white border border-white/5 hover:bg-white/10"
              }`}
            >
              <Tv size={11} />
              Cualquier suscripción
            </button>

            {availablePlatforms.map((p) => {
              const isSelected = selectedProviders.some(
                (sp) => sp.toLowerCase() === p.name.toLowerCase()
              );
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleToggleProvider(p.name)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                    isSelected
                      ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/70 ring-1 ring-emerald-500/30 shadow-sm font-semibold"
                      : "bg-white/5 text-neutral-300 hover:text-white border border-white/10 hover:bg-white/10"
                  }`}
                >
                  {p.logo_path && (
                    <img
                      src={`${LOGO_BASE}${p.logo_path}`}
                      alt=""
                      className="h-3.5 w-3.5 rounded object-cover"
                    />
                  )}
                  <span>{p.name}</span>
                  {isSelected && <Check size={11} className="text-emerald-400 shrink-0 font-bold" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
            {selectedProviders.length > 0
              ? `Ninguna de estas recomendaciones está disponible en ${selectedProviders.join(", ")} en ${countryName(country)}.`
              : `Ninguna de estas recomendaciones está disponible en suscripción en ${countryName(country)}.`}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
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
            const streamList = watchInfo?.stream || [];

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
                    accentColor={recommendMode === "director" && !activeMood ? "amber" : "emerald"}
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
                        className="inline-flex items-center gap-1 rounded bg-neutral-900/90 border border-white/10 px-1.5 py-0.5 text-[9px] font-medium text-neutral-300"
                      >
                        {p.logo_path && (
                          <img
                            src={`${LOGO_BASE}${p.logo_path}`}
                            alt=""
                            className="h-2.5 w-2.5 rounded-xs object-cover"
                          />
                        )}
                        <span className="truncate max-w-[50px]">{p.name.replace(/ Amazon Channel$/, "")}</span>
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
                        ? "bg-amber-950/70 border border-amber-500/30 text-amber-300"
                        : "bg-emerald-950/70 border border-emerald-500/30 text-emerald-300"
                    }`}
                  >
                    {recommendMode === "director" && !activeMood ? (
                      <User size={9} className="shrink-0 text-amber-400" />
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
