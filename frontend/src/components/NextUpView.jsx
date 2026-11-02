// src/components/NextUpView.jsx
// "¿Qué veo hoy?": la versión amplia de "Sorpréndeme". Los mismos 6 ánimos y las mismas
// fuentes, pero en lista y filtrable por las plataformas del visitante (país y plataformas
// de "Cómo ves cine", compartidos con la ficha). El filtro corre en el servidor sobre toda
// la lista, así que "Ver otras opciones" sigue filtrado.
//
// Fuentes: Las recomiendo (vistas 🟢/🟡, con mi nota) · En mi radar (mis pendientes) ·
// Más allá (TMDB a partir de las mías; no las he visto).
// La URL guarda ánimo y fuente (#/que-veo-hoy?animo=reir&fuente=radar): se puede compartir y
// "Sorpréndeme → Ver más opciones" llega con lo que el visitante ya eligió.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Tv, Filter, Star, Compass, Popcorn } from "lucide-react";
import { fetchNextUp } from "../services/api";
import useCountry, { useMyPlatforms } from "../hooks/useCountry";
import useRegionPlatforms from "../hooks/useRegionPlatforms";
import useVisitorSeen, { useVisitorSeenExternal } from "../hooks/useVisitorSeen";
import { countryName } from "../lib/countries";
import { isMine, LOGO_BASE, normalizePlatformName } from "../lib/platforms";
import { MOODS, MOOD_LABEL, SOURCES, isMood, sourceFromSlug, nextUpQuery } from "../lib/moods";
import CountrySelect from "./CountrySelect";
import PlatformPicker from "./PlatformPicker";
import MovieInfo from "./MovieInfo";
import MoviePosterCard, { MovieCardSkeleton } from "./MoviePosterCard";

const LIMIT = 12;
const FILTERS = { ALL: "all", MINE: "mine", ANY: "any" };

const INTRO = {
  archive: "Películas destacadas y recomendadas. Rotan cada día.",
  radar: "Títulos pendientes en lista de espera, ordenados por cercanía con las películas recomendadas.",
  beyond:
    "Sugerencias por afinidad temática con la colección. Solo entran títulos con 50% o más en Rotten Tomatoes.",
};
// Con ánimo, catálogo: qué son y el orden (por cercanía al ánimo).
const WITH_MOOD = {
  archive: "las películas recomendadas de la colección",
  radar: "las que están en la mira para ver próximamente",
};

function readHash() {
  const q = new URLSearchParams((window.location.hash.split("?")[1] || ""));
  return {
    mood: isMood(q.get("animo")) ? q.get("animo") : null,
    source: sourceFromSlug(q.get("fuente")) ?? "archive",
  };
}

/** Línea de razón bajo el título, según de dónde sale la película. */
function Reason({ node, because, source }) {
  const base =
    "mt-1.5 flex max-w-[130px] items-center justify-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium leading-tight";
  if (source === "archive") {
    if (!node.rating && node.recommend == null) return null;
    return (
      <span className={`${base} border border-accent-500/30 bg-accent-950/60 text-accent-300`}>
        {node.rating ? (
          <>
            <Star size={9} className="shrink-0 fill-current" /> {node.rating}/5 ·{" "}
          </>
        ) : null}
        {node.recommend === 1 ? "Recomendada" : "Con reservas"}
      </span>
    );
  }
  if (!because?.length) return null;
  const text =
    source === "beyond" ? `Por afinidad con ${because[0].title}` : `Conectada con ${because[0].title}`;
  return (
    <span
      title={text}
      className={`${base} border border-emerald-500/30 bg-emerald-950/70 text-emerald-300`}
    >
      <span className="block h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
      <span className="truncate">{text}</span>
    </span>
  );
}

/** @param {{ onPickExternal?: (movie: object, opts?: object) => void }} props */
export default function NextUpView({ onPickExternal }) {
  const initial = useRef(readHash()).current;
  const [mood, setMood] = useState(initial.mood);
  const [source, setSource] = useState(initial.source);
  const [state, setState] = useState({ status: "loading", items: [], error: "", offset: 0, hasMore: false });
  const [selectedId, setSelectedId] = useState(null);

  const country = useCountry((s) => s.country);
  const mine = useMyPlatforms();
  const { platforms: regionPlatforms } = useRegionPlatforms(country);
  const [filter, setFilter] = useState(() => (mine.length ? FILTERS.MINE : FILTERS.ALL));
  const [pickerOpen, setPickerOpen] = useState(false);
  const seen = useVisitorSeen();
  const seenExt = useVisitorSeenExternal();
  const seenRef = useRef({ seen, seenExt });
  seenRef.current = { seen, seenExt };

  const mineNames = useMemo(
    () => mine.map((k) => regionPlatforms.find((p) => p.key === k)?.name ?? k),
    [mine, regionPlatforms],
  );

  // Si quita todas sus plataformas, "En mis plataformas" deja de tener sentido; si elige la
  // primera, se activa: es lo que vino a hacer.
  const prevMineCount = useRef(mine.length);
  useEffect(() => {
    if (!mine.length && filter === FILTERS.MINE) setFilter(FILTERS.ALL);
    if (prevMineCount.current === 0 && mine.length > 0) setFilter(FILTERS.MINE);
    prevMineCount.current = mine.length;
  }, [mine.length, filter]);

  // La URL refleja ánimo y fuente (replaceState: no dispara hashchange ni llena el historial).
  useEffect(() => {
    const qs = nextUpQuery({ mood, source });
    const next = `#/que-veo-hoy${qs ? `?${qs}` : ""}`;
    if (window.location.hash !== next) window.history.replaceState(null, "", next);
  }, [mood, source]);

  const requestIdRef = useRef(0);
  const infoRef = useRef(null);
  const moodsRef = useRef(null);
  useEffect(() => {
    moodsRef.current
      ?.querySelector("[aria-pressed=true]")
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [mood]);
  const avail = filter === FILTERS.MINE && mine.length ? "mine" : filter === FILTERS.ANY ? "any" : undefined;
  const mineKey = mine.join(",");

  const load = useCallback(
    async (offset = 0) => {
      const requestId = ++requestIdRef.current;
      setState((s) => ({ ...s, status: "loading", error: "" }));
      setSelectedId(null);
      try {
        const { seen: ex, seenExt: exExt } = seenRef.current;
        const data = await fetchNextUp({
          source,
          mood,
          limit: LIMIT,
          offset,
          country,
          avail,
          providers: mineKey ? mineKey.split(",") : [],
          exclude: ex,
          excludeExt: exExt,
        });
        if (requestId !== requestIdRef.current) return;
        setState({
          status: "done",
          items: data.results ?? [],
          error: "",
          offset,
          hasMore: Boolean(data.hasMore),
        });
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setState({ status: "error", items: [], error: err.message, offset, hasMore: false });
      }
    },
    [source, mood, country, avail, mineKey],
  );

  useEffect(() => {
    load(0);
  }, [load]);

  useEffect(() => {
    if (selectedId != null) infoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedId]);

  const { status, items, error, offset, hasMore } = state;
  const handleMore = () => load(hasMore ? offset + LIMIT : 0);

  const openItem = (node) => {
    if (node.external) onPickExternal?.(node, { openInfo: true });
    else setSelectedId((id) => (id === node.id ? null : node.id));
  };

  const chip = (active) =>
    `shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-all duration-150 active:scale-95 focus-ring-cinematic ${
      active
        ? "border-accent-400/70 bg-accent-950/40 text-accent-300"
        : "border-white/[0.1] bg-white/[0.03] text-neutral-300 hover:border-white/25 hover:text-white"
    }`;
  const filterChip = (active) =>
    `inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
      active
        ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 ring-1 ring-emerald-500/20"
        : "bg-white/5 text-neutral-400 hover:text-white border border-white/5 hover:bg-white/10"
    }`;

  const sourceLabel = SOURCES.find((s) => s.key === source)?.label;
  const where = filter === FILTERS.MINE ? mineNames.join(", ") : "suscripción";

  return (
    <section
      className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 pb-16 pt-4 text-center"
      aria-label="Qué ver hoy"
    >
      <header className="mb-2 space-y-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
          Una selección de <span className="text-accent-400">El Selector</span>
        </span>
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-white">¿Qué veo hoy?</h2>
        <p className="mx-auto max-w-md text-xs text-neutral-400 sm:text-sm">
          {mood && WITH_MOOD[source]
            ? `${MOOD_LABEL[mood]}: ${WITH_MOOD[source]}, de la más cercana a ese ánimo a la menos.`
            : `${mood ? `${MOOD_LABEL[mood]}. ` : ""}${INTRO[source]}`}
        </p>
      </header>

      {/* Ánimo: los mismos de Sorpréndeme */}
      <div
        ref={moodsRef}
        role="group"
        aria-label="Ánimo"
        className="-mx-4 mt-3 flex w-[calc(100%+2rem)] flex-nowrap items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
      >
        <button type="button" onClick={() => setMood(null)} aria-pressed={!mood} className={chip(!mood)}>
          Lo que sea
        </button>
        {MOODS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMood((cur) => (cur === m.key ? null : m.key))}
            aria-pressed={mood === m.key}
            className={chip(mood === m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Fuente */}
      <div
        role="radiogroup"
        aria-label="De dónde salen"
        className="mt-3 inline-flex rounded-full border border-white/[0.1] bg-white/[0.03] p-0.5 text-[11px]"
      >
        {SOURCES.map((s) => (
          <button
            key={s.key}
            type="button"
            role="radio"
            aria-checked={source === s.key}
            onClick={() => setSource(s.key)}
            className={`rounded-full px-3 py-1 font-medium transition-all ${
              source === s.key ? "bg-white/[0.12] text-white" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {s.key === "beyond" && <Compass size={11} className="mr-1 inline" />}
            {s.label}
          </button>
        ))}
      </div>

      {/* Disponibilidad: país, mis plataformas y filtro */}
      <div className="mt-5 flex w-full max-w-xl flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-left backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-neutral-400">
          <span className="flex items-center gap-1.5 font-medium">
            <Filter size={12} className="text-emerald-400" />
            Dónde verlas
          </span>
          <CountrySelect />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <button type="button" onClick={() => setFilter(FILTERS.ALL)} className={filterChip(filter === FILTERS.ALL)}>
            Todas
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

        <div className="border-t border-white/10 px-1 pt-2">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            className="rounded text-[11px] text-neutral-400 hover:text-white focus-ring-cinematic"
          >
            {mine.length
              ? `Mis plataformas en ${countryName(country)}: ${mineNames.join(", ")} · ${pickerOpen ? "Listo" : "Editar"}`
              : `¿Qué plataformas tienes en ${countryName(country)}? ${pickerOpen ? "· Listo" : "Elegirlas"}`}
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
          {Array.from({ length: 8 }).map((_, idx) => (
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
        <div className="mt-10 max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <Tv size={24} className="mx-auto mb-2 text-neutral-400" />
          <p className="text-sm font-medium text-neutral-300">
            {filter === FILTERS.ALL
              ? `No encontré nada en «${sourceLabel}»${mood ? ` para «${MOOD_LABEL[mood]}»` : ""}.`
              : `En «${sourceLabel}»${mood ? ` para «${MOOD_LABEL[mood]}»` : ""} no hay nada en ${where} en ${countryName(country)}.`}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {filter !== FILTERS.ALL && (
              <button
                type="button"
                onClick={() => setFilter(FILTERS.ALL)}
                className="rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs text-white transition-all hover:bg-white/20 focus-ring-cinematic"
              >
                Ver todas
              </button>
            )}
            {SOURCES.filter((s) => s.key !== source).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSource(s.key)}
                className="rounded-full border border-emerald-500/40 bg-emerald-950/60 px-4 py-1.5 text-xs text-emerald-300 transition-all hover:bg-emerald-950 focus-ring-cinematic"
              >
                Probar «{s.label}»
              </button>
            ))}
          </div>
        </div>
      )}

      {status === "done" && items.length > 0 && (
        <div className="mt-8 grid w-full grid-cols-3 gap-x-3 gap-y-7 sm:grid-cols-4 sm:gap-x-4">
          {items.map(({ node, because }) => {
            const isSelected = !node.external && selectedId === node.id;
            // Las plataformas del visitante primero.
            const streamList = [...(node.stream || [])].sort((a, b) => isMine(b, mine) - isMine(a, mine));
            return (
              <button
                key={node.external ? `ext-${node.tmdb_id}` : node.id}
                type="button"
                onClick={() => openItem(node)}
                aria-pressed={node.external ? undefined : isSelected}
                aria-label={`Ver ficha de ${node.title}`}
                className="group flex flex-col items-center rounded-xl p-1 focus-ring-cinematic"
              >
                <div className={`transition-all duration-300 ${isSelected ? "scale-105" : "group-hover:-translate-y-1"}`}>
                  <MoviePosterCard movie={node} size="md" selected={isSelected} showBadge={false} />
                </div>
                <span className="mt-2.5 line-clamp-2 max-w-[125px] text-xs font-medium leading-snug text-neutral-200 transition-colors group-hover:text-white">
                  {node.title}
                </span>
                <span className="mt-0.5 max-w-[125px] truncate text-[11px] text-neutral-400">
                  {[node.release_year, node.director].filter(Boolean).join(" · ")}
                </span>

                {streamList.length > 0 && (
                  <div className="mt-1.5 flex max-w-[120px] flex-wrap items-center justify-center gap-1">
                    {streamList.slice(0, 2).map((p) => (
                      <span
                        key={p.key || p.id}
                        title={`En suscripción: ${p.name}`}
                        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium ${
                          isMine(p, mine)
                            ? "border-emerald-500/40 bg-emerald-950/70 text-emerald-200"
                            : "border-white/10 bg-neutral-900/90 text-neutral-300"
                        }`}
                      >
                        {p.logo_path && (
                          <img src={`${LOGO_BASE}${p.logo_path}`} alt="" className="h-2.5 w-2.5 rounded-xs object-cover" />
                        )}
                        <span className="max-w-[50px] truncate">{normalizePlatformName(p.name)}</span>
                      </span>
                    ))}
                    {streamList.length > 2 && (
                      <span className="text-[9px] font-medium text-neutral-400">+{streamList.length - 2}</span>
                    )}
                  </div>
                )}

                <Reason node={node} because={because} source={source} />
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

      {status === "done" && source !== "beyond" && items.length > 0 && !hasMore && (
        <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-neutral-400">
          <Popcorn size={12} /> ¿Ya las viste todas?{" "}
          <button type="button" onClick={() => setSource("beyond")} className="text-accent-400 hover:underline">
            Explora más allá de la colección
          </button>
        </p>
      )}
    </section>
  );
}
