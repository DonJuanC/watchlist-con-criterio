// src/components/EgoView.jsx
// Vista principal "una película y sus vecinas" con estética cinematográfica de autor:
// Pósters en proporción real vertical 2:3, líneas con brillo y filamentos de neón,
// microinteracción de resplandor en hover y fondo ambiental inmersivo.

import { useMemo, useState } from "react";
import { ChevronDown, Sparkles, User, Info } from "lucide-react";
import { useEgoGraph } from "../store/useCineStore";
import MovieInfo from "./MovieInfo";
import useNeighbors from "../hooks/useNeighbors";
import MoviePosterCard from "./MoviePosterCard";

const RING_RADIUS = 38; // % del radio orbital
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
  const { data: remoteNeighbors, loading, error } = useNeighbors(centerId);
  const neighbors = remoteNeighbors ?? (error ? localNeighbors : NO_NEIGHBORS);

  const [showInfo, setShowInfo] = useState(false);
  const [hoveredNeighborId, setHoveredNeighborId] = useState(null);

  // Posiciones orbitales en círculo
  const placed = useMemo(
    () =>
      neighbors.map((entry, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / neighbors.length;
        return {
          ...entry,
          x: 50 + RING_RADIUS * Math.cos(angle),
          y: 50 + RING_RADIUS * Math.sin(angle),
        };
      }),
    [neighbors],
  );

  if (!center) return null;

  return (
    <section
      className="relative mx-auto flex w-full max-w-xl flex-col items-center px-4 pb-12"
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
      <div key={center.id} className="relative aspect-square w-full max-w-[480px]">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-blue" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {placed.map((p) => {
            const isHovered = hoveredNeighborId === p.node.id;
            const isAnyHovered = hoveredNeighborId !== null;
            const isDirector = p.type === "same_director";

            const strokeColor = isDirector
              ? isHovered
                ? "#60a5fa"
                : "rgba(59, 130, 246, 0.45)"
              : isHovered
                ? "#22d3ee"
                : "rgba(34, 211, 238, 0.45)";

            return (
              <line
                key={p.node.id}
                x1="50"
                y1="50"
                x2={p.x}
                y2={p.y}
                stroke={strokeColor}
                strokeWidth={isHovered ? "2" : "1.2"}
                strokeDasharray={isDirector ? undefined : "1.5 1"}
                filter={isHovered ? (isDirector ? "url(#glow-blue)" : "url(#glow-cyan)") : undefined}
                className="transition-all duration-300"
                style={{
                  opacity: isAnyHovered && !isHovered ? 0.2 : 1,
                }}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {/* Película central: afiche vertical con resplandor */}
        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          aria-expanded={showInfo}
          aria-controls="ego-movie-info"
          aria-label={`${showInfo ? "Ocultar" : "Ver"} ficha de ${center.title}`}
          className="group absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 focus:outline-none z-10 transition-transform duration-300 hover:scale-105 active:scale-95"
        >
          <MoviePosterCard
            movie={center}
            size="lg"
            isCenter={true}
            accentColor="cyan"
          />
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-neutral-900/90 px-2.5 py-0.5 text-[11px] font-medium text-cyan-300 border border-cyan-400/30 backdrop-blur-md shadow-lg transition-opacity duration-200">
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
              onClick={() => onSelect(p.node.id)}
              onMouseEnter={() => setHoveredNeighborId(p.node.id)}
              onMouseLeave={() => setHoveredNeighborId(null)}
              onFocus={() => setHoveredNeighborId(p.node.id)}
              onBlur={() => setHoveredNeighborId(null)}
              aria-label={`Ir a ${p.node.title}. ${REASON_LABEL[p.type] ?? "Conectada"}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              className="group absolute flex w-24 sm:w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center focus:outline-none z-20"
            >
              <div
                className={`transition-all duration-300 ${
                  isHovered ? "scale-110 -translate-y-1" : "hover:scale-105"
                }`}
              >
                <MoviePosterCard
                  movie={p.node}
                  size="sm"
                  selected={isHovered}
                  accentColor={isDirector ? "amber" : "cyan"}
                />
              </div>

              {/* Etiqueta flotante con estilo glassmorphic */}
              <div className="mt-1 flex flex-col items-center max-w-[100px] sm:max-w-[110px]">
                <span className="line-clamp-2 rounded bg-neutral-950/90 px-1.5 py-0.5 text-[11px] font-medium leading-tight text-neutral-200 border border-white/5 backdrop-blur-sm group-hover:text-cyan-300 transition-colors">
                  {p.node.title}
                </span>
                <span
                  className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none backdrop-blur-sm border ${
                    isDirector
                      ? "bg-blue-950/80 text-blue-300 border-blue-400/30"
                      : "bg-cyan-950/80 text-cyan-300 border-cyan-400/30"
                  }`}
                >
                  {isDirector ? <User size={9} /> : <Sparkles size={9} />}
                  {REASON_LABEL[p.type] ?? "Conectada"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="mt-8 text-center text-xs font-medium text-neutral-400">
          Descubriendo afinidades y conexiones...
        </p>
      ) : placed.length === 0 ? (
        <p className="mt-8 text-center text-xs text-neutral-400">
          Esta película todavía no tiene conexiones en el catálogo. Prueba con otra.
        </p>
      ) : (
        <p className="mt-10 text-center text-xs text-neutral-400">
          Toca cualquier vecina para moverla al centro y seguir navegando
        </p>
      )}

      {/* Botón de ficha completa */}
      <button
        type="button"
        onClick={() => setShowInfo((v) => !v)}
        aria-expanded={showInfo}
        aria-controls="ego-movie-info"
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-xs font-medium text-neutral-200 backdrop-blur-md transition-all duration-200 hover:border-cyan-400/40 hover:bg-white/10 hover:text-white"
      >
        <Info size={14} className="text-cyan-400" />
        Sobre esta película
        <ChevronDown
          size={14}
          className={`transition-transform duration-300 ${showInfo ? "rotate-180" : ""}`}
        />
      </button>

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
