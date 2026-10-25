// src/components/EgoView.jsx
// CINE-09: vista principal "una película y sus vecinas". Sin física, sin zoom, sin arrastre: la película elegida va al centro y, alrededor, hasta 6 películas conectadas. Tocar una vecina la pasa al centro. Cada vecina dice en palabras simples por qué está ahí. El mapa completo (GraphCanvas) queda como vista secundaria.

import { useMemo } from "react";
import { useEgoGraph } from "../store/useCineStore";

const POSTER_BASE = "https://image.tmdb.org/t/p/w185";
const RING_RADIUS = 37; // % del lado del contenedor cuadrado

// Lenguaje cotidiano: nada de "afinidad semántica" ni "arista".
const REASON_LABEL = {
  same_director: "Mismo director",
  semantic_similarity: "Se siente parecida",
};

function Poster({ movie, className }) {
  const initial = (movie.title || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className={`relative overflow-hidden rounded-full bg-neutral-800 ${className}`}
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
 * @param {{ centerId: number|null, onSelect: (id: number) => void }} props
 */

export default function EgoView({ centerId, onSelect }) {
  const { center, neighbors } = useEgoGraph(centerId);

  // Posiciones en círculo, repartidas parejo según cuántas vecinas haya (1 a 6).
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
      className="mx-auto flex w-full max-w-xl flex-col items-center px-4"
      aria-label={`Películas conectadas con ${center.title}`}
    >
      <header className="mb-2 text-center">
        <h2 className="text-lg font-semibold leading-tight text-white">
          {center.title}
        </h2>
        <p className="text-xs text-neutral-400">
          {[center.release_year, center.director].filter(Boolean).join(" · ")}
        </p>
      </header>

      <div key={center.id} className="relative aspect-square w-full">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {placed.map((p) => (
            <line
              key={p.node.id}
              x1="50"
              y1="50"
              x2={p.x}
              y2={p.y}
              stroke={
                p.type === "same_director"
                  ? "rgba(59,130,246,0.55)"
                  : "rgba(34,211,238,0.55)"
              }
              strokeWidth="1.2"
              strokeDasharray={p.type === "same_director" ? undefined : "1.5 1"}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {/* Centro: solo el póster; el título va en el encabezado para no chocar con las vecinas */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Poster
            movie={center}
            className="h-24 w-24 ring-2 ring-cyan-400/70 sm:h-28 sm:w-28"
          />
        </div>

        {/* Vecinas */}
        {placed.map((p) => (
          <button
            key={p.node.id}
            type="button"
            onClick={() => onSelect(p.node.id)}
            aria-label={`Ir a ${p.node.title}. ${REASON_LABEL[p.type] ?? "Conectada"}`}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            className="group absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center focus:outline-none"
          >
            <Poster
              movie={p.node}
              className="h-16 w-16 ring-1 ring-white/20 transition group-hover:scale-110 group-hover:ring-cyan-400 group-focus-visible:ring-2 group-focus-visible:ring-cyan-400 sm:h-[72px] sm:w-[72px]"
            />
            <span className="mt-1 line-clamp-2 text-xs leading-tight text-neutral-100">
              {p.node.title}
            </span>
            <span className="mt-0.5 text-[10px] leading-none text-neutral-500">
              {REASON_LABEL[p.type] ?? "Conectada"}
            </span>
          </button>
        ))}
      </div>

      {placed.length === 0 ? (
        <p className="mt-4 text-center text-sm text-neutral-400">
          Esta película todavía no tiene conexiones. Prueba con otra.
        </p>
      ) : (
        <p className="mt-2 text-center text-sm text-neutral-400">
          Toca una película para seguir explorando
        </p>
      )}
    </section>
  );
}
