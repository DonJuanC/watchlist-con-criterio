// src/components/EgoView.jsx
// Vista principal "una película y sus vecinas" con estética cinematográfica de autor:
// Pósters en proporción real vertical 2:3, líneas con brillo y filamentos de neón,
// microinteracción de resplandor en hover y fondo ambiental inmersivo.

import { useMemo, useState } from "react";
import { ChevronDown, Sparkles, User, Info, Check, RefreshCw, Eye, RotateCcw } from "lucide-react";
import { useEgoGraph } from "../store/useCineStore";
import MovieInfo from "./MovieInfo";
import useNeighbors from "../hooks/useNeighbors";
import useVisitorSeen, { markSeen, clearSeen } from "../hooks/useVisitorSeen";
import MoviePosterCard from "./MoviePosterCard";
import ShareMovieButton from "./ShareMovieButton";

// Órbita elíptica: más radio vertical que horizontal porque los pósters son 2:3.
// Con radio igual, la vecina de arriba tapaba el título y el borde del póster central.
const RING_RADIUS_X = 38; // % del ancho
const RING_RADIUS_Y = 42; // % del alto (contenedor 3:4 en móvil, 5:6 en desktop)
const NO_NEIGHBORS = []; // referencia estable

const REASON_LABEL = {
  same_director: "Mismo director",
  semantic_similarity: "Se siente parecida",
};

/**
 * @param {{ centerId: number|null, onSelect: (id: number) => void }} props
 */
export default function EgoView({ centerId, onSelect }) {
  const { center, neighbors: localNeighbors } = useEgoGraph(centerId);

  // "Otras opciones": ids ya mostrados en páginas anteriores de ESTA película.
  const [pager, setPager] = useState({ center: centerId, shown: [] });
  const shown = pager.center === centerId ? pager.shown : NO_NEIGHBORS;
  const seen = useVisitorSeen(); // "Ya la vi" del visitante (localStorage)
  const [mark, setMark] = useState({ center: centerId, on: false });
  const markMode = mark.center === centerId && mark.on; // se apaga solo al cambiar de película
  const setMarkMode = (v) =>
    setMark({ center: centerId, on: typeof v === "function" ? v(markMode) : v });
  const exclude = useMemo(() => [...new Set([...seen, ...shown])], [seen, shown]);

  const { data: remoteNeighbors, hasMore, loading, error } = useNeighbors(centerId, exclude);
  const neighbors = useMemo(
    () =>
      remoteNeighbors ??
      (error ? localNeighbors.filter((n) => !exclude.includes(n.node.id)) : NO_NEIGHBORS),
    [remoteNeighbors, error, localNeighbors, exclude],
  );
  const exhausted = !loading && !error && neighbors.length === 0 && exclude.length > 0;

  const showMore = () => {
    setMarkMode(false);
    setPager({ center: centerId, shown: [...shown, ...neighbors.map((n) => n.node.id)] });
  };
  const restart = () => {
    setMarkMode(false);
    setPager({ center: centerId, shown: [] });
  };

  const [showInfo, setShowInfo] = useState(false);
  const [hoveredNeighborId, setHoveredNeighborId] = useState(null);

  // Posiciones orbitales en círculo
  const placed = useMemo(
    () =>
      neighbors.map((entry, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / neighbors.length;
        return {
          ...entry,
          x: 50 + RING_RADIUS_X * Math.cos(angle),
          y: 50 + RING_RADIUS_Y * Math.sin(angle),
        };
      }),
    [neighbors],
  );

  if (!center) return null;

  return (
    <section
      className="relative mx-auto flex w-full max-w-xl flex-col items-center px-4 pb-24"
      aria-label={`Películas conectadas con ${center.title}`}
    >
      {/* Cabecera elegante de la película central */}
      <header className="mb-4 mt-2 text-center">
        <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-white drop-shadow-md">
          {center.title}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-neutral-300">
          {[center.release_year, center.director ? `Dir. ${center.director}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      {/* Lienzo orbital con conexiones SVG */}
      <div key={center.id} className="relative mt-10 aspect-[3/4] w-full max-w-[480px] sm:aspect-[5/6]">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {placed.map((p) => {
            const isHovered = hoveredNeighborId === p.node.id;
            const isAnyHovered = hoveredNeighborId !== null;
            const isDirector = p.type === "same_director";

            const strokeColor = isDirector
              ? isHovered
                ? "var(--color-accent-600)"
                : "color-mix(in oklab, var(--color-accent-600) 35%, transparent)"
              : isHovered
                ? "var(--color-white)"
                : "color-mix(in oklab, var(--color-white) 14%, transparent)";

            return (
              <line
                key={p.node.id}
                x1="50"
                y1="50"
                x2={p.x}
                y2={p.y}
                style={{ stroke: strokeColor }}
                strokeWidth={isHovered ? "1.4" : "0.75"}
                strokeDasharray={isDirector ? undefined : "1.5 1"}
                className="transition-all duration-300"
                style={{
                  opacity: isAnyHovered && !isHovered ? 0.15 : 1,
                }}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {/* Película central: afiche vertical */}
        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          aria-expanded={showInfo}
          aria-controls="ego-movie-info"
          aria-label={`${showInfo ? "Ocultar" : "Ver"} ficha de ${center.title}`}
          className="group absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 focus-ring-cinematic rounded-xl z-10 transition-transform duration-300 hover:scale-[1.02] active:scale-98"
        >
          <MoviePosterCard
            movie={center}
            size="lg"
            isCenter={true}
            showBadge={false}
          />
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface/90 px-2.5 py-0.5 text-[10px] font-mono tracking-wider uppercase text-neutral-300 border border-white/10 shadow-lg transition-opacity duration-200">
            {showInfo ? "Cerrar ficha" : "Ver ficha"}
          </div>
        </button>

        {/* Vecinas satélite en proporción 2:3 */}
        {placed.map((p) => {
          const isHovered = hoveredNeighborId === p.node.id;
          const isDirector = p.type === "same_director";

          return (
            <button
              key={p.node.id}
              type="button"
              onClick={() => (markMode ? markSeen(p.node.id) : onSelect(p.node.id))}
              onMouseEnter={() => setHoveredNeighborId(p.node.id)}
              onMouseLeave={() => setHoveredNeighborId(null)}
              onFocus={() => setHoveredNeighborId(p.node.id)}
              onBlur={() => setHoveredNeighborId(null)}
              aria-label={
                markMode
                  ? `Marcar ${p.node.title} como vista`
                  : `Ir a ${p.node.title}. ${REASON_LABEL[p.type] ?? "Conectada"}`
              }
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              className="group absolute flex w-24 sm:w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center focus-ring-cinematic rounded-lg z-20 p-1"
            >
              <div
                className={`relative transition-all duration-300 ${
                  isHovered ? "-translate-y-1" : ""
                }`}
              >
                <MoviePosterCard
                  movie={p.node}
                  size="sm"
                  selected={isHovered || markMode}
                  showBadge={false}
                />
                {markMode && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-canvas/55">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-canvas/90 px-2 py-1 text-[10px] font-semibold text-neutral-100 shadow-lg">
                      <Eye size={11} /> ¿Ya la viste?
                    </span>
                  </span>
                )}
              </div>

              {/* Etiqueta flotante con estilo editorial */}
              <div className="mt-1 flex flex-col items-center max-w-[100px] sm:max-w-[110px]">
                <span className="line-clamp-2 rounded bg-canvas/85 px-1.5 py-0.5 text-[11px] font-medium leading-tight text-neutral-200 group-hover:text-white transition-colors">
                  {p.node.title}
                </span>
                <span
                  className={`mt-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-mono leading-none border ${
                    isDirector
                      ? "bg-accent-950/40 text-accent-300/90 border-accent-500/30"
                      : "bg-surface/80 text-neutral-400 border-white/10"
                  }`}
                >
                  {isDirector ? <User size={8} /> : <Sparkles size={8} />}
                  {REASON_LABEL[p.type] ?? "Conectada"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {loading && placed.length === 0 ? (
        <p className="mt-8 text-center text-xs font-medium text-neutral-400">
          Descubriendo afinidades y conexiones...
        </p>
      ) : exhausted ? (
        <div className="mt-8 max-w-xs text-center">
          <p className="font-serif text-base text-neutral-200">
            Ya recorriste todo lo que tengo parecido a{" "}
            <span className="italic">{center.title}</span>.
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Busca otra película que te haya gustado o vuelve a ver las opciones.
          </p>
        </div>
      ) : placed.length === 0 ? (
        <p className="mt-8 text-center text-xs text-neutral-400">
          Esta película todavía no tiene conexiones en el catálogo. Prueba con otra.
        </p>
      ) : (
        <p className="mt-14 text-center text-xs text-neutral-400">
          {markMode
            ? "Toca las que ya viste: salen y entra otra en su lugar"
            : !hasMore && shown.length > 0 && !loading
              ? `Son las últimas que tengo parecidas a ${center.title}`
              : "Toca cualquier vecina para moverla al centro y seguir navegando"}
        </p>
      )}

      {/* Recargar: "Ya la vi" por película y "Otras opciones" por página */}
      {!error && (placed.length > 0 || exhausted) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {placed.length > 0 && (
            <button
              type="button"
              onClick={() => setMarkMode((v) => !v)}
              aria-pressed={markMode}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition-all duration-200 focus-ring-cinematic ${
                markMode
                  ? "border-white bg-white text-neutral-900"
                  : "border-white/15 bg-white/5 text-neutral-200 hover:border-white/30 hover:bg-white/10"
              }`}
            >
              {markMode ? <Check size={14} /> : <Eye size={14} />}
              {markMode ? "Listo" : "Ya vi algunas"}
            </button>
          )}
          {hasMore && placed.length > 0 && (
            <button
              type="button"
              onClick={showMore}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-neutral-200 transition-all duration-200 hover:border-white/30 hover:bg-white/10 focus-ring-cinematic disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Otras opciones
            </button>
          )}
          {!hasMore && shown.length > 0 && !loading && (
            <button
              type="button"
              onClick={restart}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-neutral-200 transition-all duration-200 hover:border-white/30 hover:bg-white/10 focus-ring-cinematic"
            >
              <RotateCcw size={14} />
              Volver a empezar
            </button>
          )}
          {exhausted && seen.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearSeen();
                restart();
              }}
              className="text-xs text-neutral-400 underline underline-offset-4 hover:text-neutral-200"
            >
              Desmarcar las que ya vi ({seen.length})
            </button>
          )}
        </div>
      )}

      {/* Botones de acción central */}
      <div className="mt-5 flex items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          aria-expanded={showInfo}
          aria-controls="ego-movie-info"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 sm:px-5 py-2 text-xs font-medium text-neutral-200 backdrop-blur-md transition-all duration-200 hover:border-white/30 hover:bg-white/10 hover:text-white focus-ring-cinematic"
        >
          <Info size={14} className="text-neutral-400" />
          Sobre esta película
          <ChevronDown
            size={14}
            className={`transition-transform duration-300 ${showInfo ? "rotate-180" : ""}`}
          />
        </button>

        <ShareMovieButton movie={center} />
      </div>

      {/* Ficha técnica y Criterio personal */}
      {showInfo && (
        <div
          id="ego-movie-info"
          className="mb-10 mt-5 w-full rounded-2xl border border-white/10 bg-neutral-900/80 p-5 backdrop-blur-xl shadow-2xl transition-all duration-300"
        >
          <MovieInfo movieId={center.id} />
        </div>
      )}
    </section>
  );
}
