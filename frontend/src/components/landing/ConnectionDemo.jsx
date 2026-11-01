// src/components/landing/ConnectionDemo.jsx
// «Así funciona»: muestra el producto con un ejemplo real en vez de explicarlo.
// Toma una película destacada y 4 de sus vecinas del grafo ya cargado en el cliente.

import { useMemo } from "react";
import { ArrowRight, Sparkles, User } from "lucide-react";
import useCineStore, { buildEgoGraph } from "../../store/useCineStore";
import MoviePosterCard from "../MoviePosterCard";

// Se usa la primera que exista en el catálogo con al menos 4 vecinas.
const FEATURED_TITLES = ["Interstellar", "Parasite", "Coherence"];
const DEMO_NEIGHBORS = 4;

function Neighbor({ entry, onPick }) {
  const isDirector = entry.type === "same_director";
  return (
    <button
      type="button"
      onClick={() => onPick(entry.node.id)}
      aria-label={`Ir a ${entry.node.title}. ${isDirector ? "Mismo director" : "Se siente parecida"}`}
      className="group flex w-28 flex-col items-center gap-1.5 rounded-lg p-1 text-center focus-ring-cinematic"
    >
      <MoviePosterCard movie={entry.node} size="sm" showBadge={false} />
      <span className="line-clamp-1 text-xs font-medium text-neutral-200 group-hover:text-white">{entry.node.title}</span>
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] leading-none ${
          isDirector ? "border-accent-500/40 text-accent-300" : "border-white/15 text-neutral-400"
        }`}
      >
        {isDirector ? <User size={9} /> : <Sparkles size={9} />}
        {isDirector ? "Mismo director" : "Se siente parecida"}
      </span>
    </button>
  );
}

/** @param {{ onPick: (id: number) => void }} props */
export default function ConnectionDemo({ onPick }) {
  const rawGraph = useCineStore((s) => s.rawGraph);

  const ego = useMemo(() => {
    for (const title of FEATURED_TITLES) {
      const node = rawGraph.nodes.find((n) => n.title === title);
      if (!node) continue;
      const graph = buildEgoGraph(rawGraph, node.id, DEMO_NEIGHBORS);
      if (graph.neighbors.length >= DEMO_NEIGHBORS) return graph;
    }
    return null;
  }, [rawGraph]);

  const left = ego?.neighbors.slice(0, 2) ?? [];
  const right = ego?.neighbors.slice(2, 4) ?? [];

  return (
    <section className="mt-16 w-full text-left" aria-label="Así funciona">
      <div className="mb-6 flex flex-col gap-1 border-b border-white/[0.08] pb-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Así funciona</span>
        <h2 className="font-serif text-2xl sm:text-3xl font-normal text-white">Una película lleva a la otra</h2>
      </div>

      {ego ? (
        <div className="flex flex-col items-center gap-6 rounded-2xl border border-white/[0.08] bg-surface/50 px-4 py-6 sm:px-6">
          <div className="flex w-full flex-col items-center gap-6 md:flex-row md:justify-center md:gap-8">
            <div className="order-2 flex gap-3 md:order-1">
              {left.map((entry) => <Neighbor key={entry.node.id} entry={entry} onPick={onPick} />)}
            </div>

            <div className="order-1 flex flex-col items-center gap-2 md:order-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-400">Si te gustó</span>
              <button
                type="button"
                onClick={() => onPick(ego.center.id)}
                aria-label={`Explorar desde ${ego.center.title}`}
                className="group rounded-xl focus-ring-cinematic"
              >
                <MoviePosterCard movie={ego.center} size="md" isCenter showBadge={false} />
              </button>
              <span className="font-serif text-lg text-white">{ego.center.title}</span>
            </div>

            <div className="order-3 flex gap-3">
              {right.map((entry) => <Neighbor key={entry.node.id} entry={entry} onPick={onPick} />)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onPick(ego.center.id)}
            className="inline-flex items-center gap-2 text-sm font-medium text-accent-400 transition-colors hover:text-accent-300 focus-ring-cinematic rounded"
          >
            Ver sus 6 vecinas
            <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="h-[260px] rounded-2xl border border-white/[0.08] bg-white/[0.03] animate-shimmer" aria-label="Cargando ejemplo" />
      )}
    </section>
  );
}
