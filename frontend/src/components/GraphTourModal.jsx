// src/components/GraphTourModal.jsx
// Recorrido cinemático guiado y guía completa del mapa interactivo.
// Controla la cámara de ForceGraph2D en 4 paradas visuales inmersivas,
// y ofrece una guía anatómica completa de referencia bajo demanda.

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Sparkles,
  Compass,
  ArrowRight,
  ArrowLeft,
  X,
  Eye,
  SlidersHorizontal,
  Film,
  Cpu,
  BookOpen,
  RotateCcw,
} from "lucide-react";
import useCineStore from "../store/useCineStore";

const TOUR_STEPS = [
  {
    id: "cosmos",
    title: "El Cosmos Cinematográfico",
    eyebrow: "Paso 1 de 4 · Visión Panorámica",
    description:
      "Estás viendo casi 300 películas proyectadas en el espacio según su ADN temático y emocional. Las distancias no son casualidad: una simulación de fuerzas físicas atrae a las películas que comparten tono, época, ritmo y dilemas, formando cúmulos naturales.",
    badge: "Grafo k-NN & Simulación Física",
  },
  {
    id: "atmosphere",
    title: "Líneas Blancas: Afinidad de Atmósfera",
    eyebrow: "Paso 2 de 4 · Conexiones Semánticas",
    description:
      "Cada película pasó por un modelo de lenguaje que generó un vector matemático de 768 dimensiones capturando su atmósfera, ritmo y estética. Las líneas punteadas blancas unen obras cuya afinidad supera el 65% de similitud coseno.",
    badge: "Líneas Punteadas Blancas",
  },
  {
    id: "director",
    title: "Líneas Doradas: La Mirada del Autor",
    eyebrow: "Paso 3 de 4 · Puentes de Autoría",
    description:
      "Las líneas sólidas doradas conectan películas dirigidas por el mismo realizador. Te permiten seguir la huella y evolución formal de una misma voz a través de los años, uniendo universos creativos afines.",
    badge: "Líneas Sólidas Doradas",
  },
  {
    id: "controls",
    title: "Filtros y Exploración Libre",
    eyebrow: "Paso 4 de 4 · Tu Criterio",
    description:
      "Ajusta el slider de afinidad (abajo a la izquierda) para variar la tolerancia: súbelo al 80% para ver solo obras hermanas, o bájalo para descubrir puentes insospechados. Haz clic en cualquier película para abrir su constelación y ficha con veredictos.",
    badge: "Control de Afinidad & Criterio",
  },
];

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {React.RefObject<any>} props.fgRef   Referencia a ForceGraph2D
 * @param {string} [props.initialMode]        "tour" | "guide"
 */
export default function GraphTourModal({
  isOpen,
  onClose,
  fgRef,
  initialMode = "tour",
}) {
  const [mode, setMode] = useState(initialMode);
  const [stepIndex, setStepIndex] = useState(0);

  const rawGraph = useCineStore((s) => s.rawGraph);
  const setMatchedMovieIds = useCineStore((s) => s.setMatchedMovieIds);
  const clearSearch = useCineStore((s) => s.clearSearch);

  // Seleccionar nodos representativos para las paradas del tour
  const landmarkNodes = useMemo(() => {
    if (!rawGraph || !rawGraph.nodes || rawGraph.nodes.length === 0) {
      return { atmosphereNode: null, atmosphereNeighbors: [], directorNode: null, directorNeighbors: [] };
    }

    // 1. Nodo semántico con múltiples enlaces de afinidad
    const semanticCounts = new Map();
    for (const link of rawGraph.links) {
      if (link.type === "semantic_similarity") {
        const sId = typeof link.source === "object" ? link.source.id : link.source;
        const tId = typeof link.target === "object" ? link.target.id : link.target;
        semanticCounts.set(sId, (semanticCounts.get(sId) || 0) + 1);
        semanticCounts.set(tId, (semanticCounts.get(tId) || 0) + 1);
      }
    }

    // Priorizar alguna película icónica si existe
    const preferredAtmosphere = rawGraph.nodes.find(
      (n) =>
        (n.title === "Blade Runner 2049" ||
          n.title === "Arrival" ||
          n.title === "Interstellar" ||
          n.title === "Parasite") &&
        semanticCounts.get(n.id) > 2,
    );

    const atmosphereNode =
      preferredAtmosphere ||
      [...rawGraph.nodes].sort(
        (a, b) => (semanticCounts.get(b.id) || 0) - (semanticCounts.get(a.id) || 0),
      )[0];

    const atmosphereNeighbors = [];
    if (atmosphereNode) {
      for (const link of rawGraph.links) {
        if (link.type === "semantic_similarity") {
          const sId = typeof link.source === "object" ? link.source.id : link.source;
          const tId = typeof link.target === "object" ? link.target.id : link.target;
          if (sId === atmosphereNode.id) atmosphereNeighbors.push({ id: tId, similarity: link.weight ?? 0.75 });
          else if (tId === atmosphereNode.id) atmosphereNeighbors.push({ id: sId, similarity: link.weight ?? 0.75 });
        }
      }
    }

    // 2. Nodo con enlaces de mismo director
    const directorCounts = new Map();
    for (const link of rawGraph.links) {
      if (link.type === "same_director") {
        const sId = typeof link.source === "object" ? link.source.id : link.source;
        const tId = typeof link.target === "object" ? link.target.id : link.target;
        directorCounts.set(sId, (directorCounts.get(sId) || 0) + 1);
        directorCounts.set(tId, (directorCounts.get(tId) || 0) + 1);
      }
    }

    const directorNode = [...rawGraph.nodes].sort(
      (a, b) => (directorCounts.get(b.id) || 0) - (directorCounts.get(a.id) || 0),
    )[0];

    const directorNeighbors = [];
    if (directorNode) {
      for (const link of rawGraph.links) {
        if (link.type === "same_director") {
          const sId = typeof link.source === "object" ? link.source.id : link.source;
          const tId = typeof link.target === "object" ? link.target.id : link.target;
          if (sId === directorNode.id) directorNeighbors.push({ id: tId, similarity: 1 });
          else if (tId === directorNode.id) directorNeighbors.push({ id: sId, similarity: 1 });
        }
      }
    }

    return { atmosphereNode, atmosphereNeighbors, directorNode, directorNeighbors };
  }, [rawGraph]);

  // Ejecutar movimiento cinemático de cámara según el paso actual
  const executeStepAnimation = useCallback(
    (step) => {
      const fg = fgRef?.current;
      if (!fg) return;

      if (step === 0) {
        // Paso 1: Visión panorámica del cosmos
        clearSearch();
        fg.zoomToFit(1100, 80);
      } else if (step === 1) {
        // Paso 2: Cúmulo de atmósfera
        const node = landmarkNodes.atmosphereNode;
        if (node && typeof node.x === "number" && typeof node.y === "number") {
          fg.centerAt(node.x, node.y, 900);
          fg.zoom(2.6, 900);
          setMatchedMovieIds([
            { id: node.id, similarity: 1 },
            ...landmarkNodes.atmosphereNeighbors.slice(0, 6),
          ]);
        }
      } else if (step === 2) {
        // Paso 3: Hilo del autor
        const node = landmarkNodes.directorNode;
        if (node && typeof node.x === "number" && typeof node.y === "number") {
          fg.centerAt(node.x, node.y, 900);
          fg.zoom(3.0, 900);
          setMatchedMovieIds([
            { id: node.id, similarity: 1 },
            ...landmarkNodes.directorNeighbors,
          ]);
        }
      } else if (step === 3) {
        // Paso 4: Criterio y controles
        clearSearch();
        fg.zoomToFit(900, 70);
      }
    },
    [fgRef, landmarkNodes, clearSearch, setMatchedMovieIds],
  );

  // Sincronizar paso al abrir o cambiar de paso
  useEffect(() => {
    if (isOpen && mode === "tour") {
      executeStepAnimation(stepIndex);
    }
  }, [isOpen, mode, stepIndex, executeStepAnimation]);

  const handleNext = () => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  };

  const handleFinish = () => {
    clearSearch();
    const fg = fgRef?.current;
    if (fg) fg.zoomToFit(800, 60);
    onClose();
  };

  // Teclado: Escape cierra, flechas navegan
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleFinish();
      } else if (mode === "tour") {
        if (e.key === "ArrowRight") handleNext();
        else if (e.key === "ArrowLeft") handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[stepIndex];

  return (
    <>
      {/* MODO TOUR: Superposición cinematográfica flotante (no tapa el grafo) */}
      {mode === "tour" && (
        <div className="fixed inset-x-0 bottom-4 sm:bottom-8 z-40 flex justify-center px-4 pointer-events-none animate-view-enter">
          <div className="pointer-events-auto flex w-full max-w-xl flex-col gap-3 rounded-2xl border border-white/15 bg-neutral-900/90 p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
            {/* Cabecera del paso */}
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-500/20 text-accent-300">
                  <Sparkles size={13} />
                </span>
                <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-accent-300">
                  {currentStep.eyebrow}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode("guide")}
                  className="text-xs font-mono text-neutral-400 hover:text-white transition-colors underline decoration-white/20 underline-offset-2"
                >
                  Ver guía escrita
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  aria-label="Cerrar tour"
                  className="rounded-full p-1 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Contenido narrativo */}
            <div className="flex flex-col gap-1.5 pt-1">
              <h3 className="font-serif text-lg sm:text-xl font-medium text-white">
                {currentStep.title}
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-neutral-300">
                {currentStep.description}
              </p>
            </div>

            {/* Puntos de progreso y botones de acción */}
            <div className="mt-2 flex items-center justify-between pt-2 border-t border-white/[0.06]">
              {/* Indicadores de paso */}
              <div className="flex items-center gap-1.5" aria-label="Progreso del tour">
                {TOUR_STEPS.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStepIndex(idx)}
                    aria-label={`Ir al paso ${idx + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      stepIndex === idx
                        ? "w-6 bg-accent-400"
                        : "w-1.5 bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
              </div>

              {/* Botones de navegación */}
              <div className="flex items-center gap-2">
                {stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/10 hover:text-white transition-colors focus-ring-cinematic"
                  >
                    <ArrowLeft size={13} />
                    Anterior
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-1 rounded-full border border-accent-400/50 bg-accent-500/20 px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-500/30 transition-all focus-ring-cinematic"
                >
                  <span>{stepIndex === TOUR_STEPS.length - 1 ? "Comenzar" : "Siguiente"}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODO GUÍA: Modal completo de referencia y anatomía técnica */}
      {mode === "guide" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-view-enter">
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-neutral-950 p-6 sm:p-8 text-left shadow-2xl">
            {/* Encabezado */}
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-accent-400">
                  Manual del Navegante
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-normal text-white">
                  Cómo leer el Mapa de Conexiones
                </h2>
              </div>
              <button
                type="button"
                onClick={handleFinish}
                aria-label="Cerrar modal"
                className="rounded-full p-1 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contenido en scroll */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 pt-4 text-neutral-300 text-sm leading-relaxed [scrollbar-width:thin]">
              {/* Sección 1: Anatomía */}
              <section className="space-y-3">
                <h4 className="flex items-center gap-2 font-serif text-lg text-white">
                  <Film size={16} className="text-accent-400" />
                  1. Anatomía Visual del Espacio
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.08] bg-surface/60 p-3.5">
                    <span className="flex items-center gap-2 text-xs font-mono font-medium text-white">
                      <span className="h-2.5 w-2.5 rounded-full bg-accent-400" />
                      Los Nodos (Películas)
                    </span>
                    <p className="mt-1.5 text-xs text-neutral-400">
                      Cada punto es una película del archivo. Su posición responde a una simulación de física gravitacional: las obras que comparten atmósfera se atraen mutuamente.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-surface/60 p-3.5">
                    <span className="flex items-center gap-2 text-xs font-mono font-medium text-white">
                      <span className="h-0.5 w-4 border-b border-dashed border-white/80" />
                      Líneas Punteadas (Atmósfera)
                    </span>
                    <p className="mt-1.5 text-xs text-neutral-400">
                      Parentescos de tono, ritmo y dilemas morales extraídos mediante embeddings semánticos vectoriales (≥ 65% de afinidad coseno).
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-surface/60 p-3.5">
                    <span className="flex items-center gap-2 text-xs font-mono font-medium text-white">
                      <span className="h-0.5 w-4 bg-accent-400 rounded-full" />
                      Líneas Doradas (Autoría)
                    </span>
                    <p className="mt-1.5 text-xs text-neutral-400">
                      Puentes directos entre obras dirigidas por el mismo realizador, mostrando la evolución y constantes de su filmografía.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-surface/60 p-3.5">
                    <span className="flex items-center gap-2 text-xs font-mono font-medium text-white">
                      <SlidersHorizontal size={13} className="text-accent-400" />
                      Nivel de Afinidad (Slider)
                    </span>
                    <p className="mt-1.5 text-xs text-neutral-400">
                      Filtra la densidad del mapa: súbelo hacia el 80% para ver solo obras hermanas, o bájalo al 60% para ver puentes sutiles.
                    </p>
                  </div>
                </div>
              </section>

              {/* Sección 2: Navegación */}
              <section className="space-y-3 border-t border-white/[0.08] pt-4">
                <h4 className="flex items-center gap-2 font-serif text-lg text-white">
                  <Compass size={16} className="text-accent-400" />
                  2. Atajos de Exploración
                </h4>
                <ul className="space-y-2 text-xs text-neutral-400">
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-white">· Arrastrar:</span> Desplaza la vista por el cosmos.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-white">· Rueda / Botones + -:</span> Zoom in / zoom out. Al acercarte se revelan los títulos de cada obra.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-white">· Clic en un nodo:</span> Centra la cámara, abre la ficha completa con veredictos y resalta su constelación vecina.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono text-white">· Buscador Spotlight:</span> Escribe sensaciones (ej. <em>«paranoia y neón»</em>) para encender los nodos afines en el mapa.
                  </li>
                </ul>
              </section>
            </div>

            {/* Pie con botones de acción */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
              <button
                type="button"
                onClick={() => {
                  setStepIndex(0);
                  setMode("tour");
                }}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-accent-400 hover:text-accent-300 transition-colors"
              >
                <Sparkles size={13} />
                <span>Reiniciar recorrido cinemático</span>
              </button>

              <div className="flex items-center gap-2">
                <a
                  href="#/como-funciona"
                  onClick={onClose}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-neutral-300 hover:border-white/30 hover:text-white transition-colors"
                >
                  Tesis técnica completa
                </a>
                <button
                  type="button"
                  onClick={handleFinish}
                  className="rounded-full bg-white px-5 py-2 text-xs font-medium text-black hover:bg-neutral-200 transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
