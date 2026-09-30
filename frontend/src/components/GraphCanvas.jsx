// src/components/GraphCanvas.jsx
// CINE-04: Render del grafo con ForceGraph2D. Pintado custom de nodos para atenuar
// los que no coinciden con una búsqueda activa, sin nunca reiniciar la simulación
// física (no se remonta el componente al buscar; solo cambia matchedMovieIds).

import { forwardRef, useImperativeHandle, useRef, useCallback, useMemo, useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import useCineStore, { useFilteredLinks } from '../store/useCineStore';

const BASE_NODE_COLOR = '#8b8b8b';
const MATCH_RING_COLOR = '#22d3ee'; // cyan brillante para nodos que matchean la búsqueda
const DIRECTOR_LINK_COLOR = 'rgba(59, 130, 246, 0.55)'; // azul sólido — CINE-07
const SEMANTIC_LINK_COLOR = 'rgba(34, 211, 238, 0.55)'; // cian punteado/brillante — CINE-07
const DIMMED_ALPHA = 0.15;
const FULL_ALPHA = 1.0;
const CENTER_ZOOM = 4;
const CENTER_DURATION_MS = 600;
const CAMERA_ANIMATION_MS = 400;
const ZOOM_STEP_FACTOR = 1.5;

const GraphCanvas = forwardRef(function GraphCanvas(props, forwardedRef) {
    const internalRef = useRef(null);
    const containerRef = useRef(null);
    // CINE-05 (fix en vivo): react-force-graph-2d mide el tamaño de su contenedor
    // vía getBoundingClientRect al montar. El div padre (sin height explícito,
    // solo heredando de .h-screen sin flex/h-full) resolvía a height:0 en el
    // primer render, así que el canvas quedaba en 0x0 y el grafo era invisible
    // aunque los datos sí llegaban. Se mide explícitamente con ResizeObserver y
    // se le pasan width/height al componente en vez de dejarlo auto-detectar.
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const rawNodes = useCineStore((s) => s.rawGraph.nodes);
    const filteredLinks = useFilteredLinks(); // CINE-04B: subset en memoria según los controles
    const matchedMovieIds = useCineStore((s) => s.matchedMovieIds);
    const setSelectedMovie = useCineStore((s) => s.setSelectedMovie);
    const focusNodeId = useCineStore((s) => s.focusNodeId); // CINE-07
    const clearFocusNode = useCineStore((s) => s.clearFocusNode);

    // Expone el ref interno de ForceGraph2D hacia el padre si lo necesita.
    useImperativeHandle(forwardedRef, () => internalRef.current);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const updateSize = () => {
            const { width, height } = el.getBoundingClientRect();
            setDimensions({ width, height });
        };

        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // CINE-07: reacciona a una petición de foco externa (ej. clic en "Conexiones
    // directas" del MovieDetailDrawer) centrando la cámara en el nodo pedido.
    useEffect(() => {
        if (focusNodeId == null) return;
        const fg = internalRef.current;
        const node = rawNodes.find((n) => n.id === focusNodeId);
        if (fg && node && typeof node.x === 'number' && typeof node.y === 'number') {
            fg.centerAt(node.x, node.y, CENTER_DURATION_MS);
            fg.zoom(CENTER_ZOOM, CENTER_DURATION_MS);
        }
        clearFocusNode();
    }, [focusNodeId, rawNodes, clearFocusNode]);

    // `rawNodes` mantiene siempre la misma referencia de array/objetos entre
    // renders (solo cambia al llegar un grafo nuevo de la API), así que filtrar
    // `links` en useFilteredLinks NUNCA le da a ForceGraph2D un set de nodos
    // "nuevo" — es lo que le permite conservar las posiciones (x, y) ya
    // calculadas en vez de reiniciar la simulación física al mover un control.
    const graphData = useMemo(
        () => ({ nodes: rawNodes, links: filteredLinks }),
        [rawNodes, filteredLinks]
    );

    const nodeCanvasObject = useCallback(
        (node, ctx, globalScale) => {
            const radius = 4;
            const hasActiveSearch = matchedMovieIds.size > 0;
            const isMatch = matchedMovieIds.has(node.id);

            ctx.globalAlpha = hasActiveSearch && !isMatch ? DIMMED_ALPHA : FULL_ALPHA;

            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = BASE_NODE_COLOR;
            ctx.fill();

            if (hasActiveSearch && isMatch) {
                // Anillo exterior brillante proporcional a la similitud.
                const similarity = matchedMovieIds.get(node.id) ?? 0;
                ctx.lineWidth = 1.5 / globalScale;
                ctx.strokeStyle = MATCH_RING_COLOR;
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius + 2 + similarity * 2, 0, 2 * Math.PI, false);
                ctx.stroke();
            }

            // Etiqueta del título, solo visible con zoom suficiente para no saturar.
            if (globalScale > 2) {
                ctx.font = `${10 / globalScale}px Sans-Serif`;
                ctx.fillStyle = 'rgba(255,255,255,0.85)';
                ctx.textAlign = 'center';
                ctx.fillText(node.title, node.x, node.y + radius + 8 / globalScale);
            }

            ctx.globalAlpha = 1.0;
        },
        [matchedMovieIds]
    );

    const handleNodeClick = useCallback(
        (node) => {
            setSelectedMovie(node);
            const fg = internalRef.current;
            if (fg && typeof node.x === 'number' && typeof node.y === 'number') {
                fg.centerAt(node.x, node.y, CENTER_DURATION_MS);
                fg.zoom(CENTER_ZOOM, CENTER_DURATION_MS);
            }
        },
        [setSelectedMovie]
    );

    // CINE-07: controles de cámara flotantes — el usuario del portafolio no tiene por
    // qué saber que puede hacer scroll/drag para navegar el grafo si no se lo decimos.
    const handleZoomIn = useCallback(() => {
        const fg = internalRef.current;
        if (!fg) return;
        fg.zoom(fg.zoom() * ZOOM_STEP_FACTOR, CAMERA_ANIMATION_MS);
    }, []);

    const handleZoomOut = useCallback(() => {
        const fg = internalRef.current;
        if (!fg) return;
        fg.zoom(fg.zoom() / ZOOM_STEP_FACTOR, CAMERA_ANIMATION_MS);
    }, []);

    const handleResetView = useCallback(() => {
        const fg = internalRef.current;
        if (!fg) return;
        // zoomToFit encuadra y centra todos los nodos visibles — es el "home" de la cámara.
        fg.zoomToFit(600, 60);
    }, []);

    return (
        <div ref={containerRef} className="absolute inset-0">
        <ForceGraph2D
            ref={internalRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            backgroundColor="#0a0a0a"
            nodeId="id"
            nodeLabel="title"
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={(node, color, ctx) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
                ctx.fill();
            }}
            linkColor={(link) => (link.type === 'same_director' ? DIRECTOR_LINK_COLOR : SEMANTIC_LINK_COLOR)}
            linkWidth={(link) => (link.type === 'same_director' ? 1.5 : 1)}
            linkLineDash={(link) => (link.type === 'semantic_similarity' ? [3, 2] : null)}
            onNodeClick={handleNodeClick}
            cooldownTicks={100}
        />

        {/* CINE-07: controles de cámara flotantes (esquina inferior derecha). */}
        <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-3">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-xs text-neutral-300 shadow-2xl backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: DIRECTOR_LINK_COLOR }} />
                    Mismo director
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                    <span
                        className="h-0.5 w-4"
                        style={{
                            backgroundImage: `repeating-linear-gradient(to right, ${SEMANTIC_LINK_COLOR} 0 3px, transparent 3px 5px)`,
                        }}
                    />
                    Afinidad semántica
                </div>
            </div>

            <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/80 shadow-2xl backdrop-blur-md">
                <button
                    type="button"
                    onClick={handleZoomIn}
                    aria-label="Acercar"
                    className="p-2 text-neutral-300 hover:bg-white/10 hover:text-white"
                >
                    <ZoomIn size={16} />
                </button>
                <button
                    type="button"
                    onClick={handleZoomOut}
                    aria-label="Alejar"
                    className="border-t border-neutral-800 p-2 text-neutral-300 hover:bg-white/10 hover:text-white"
                >
                    <ZoomOut size={16} />
                </button>
                <button
                    type="button"
                    onClick={handleResetView}
                    aria-label="Restablecer vista"
                    className="border-t border-neutral-800 p-2 text-neutral-300 hover:bg-white/10 hover:text-white"
                >
                    <Maximize2 size={16} />
                </button>
            </div>
        </div>
        </div>
    );
});

export default GraphCanvas;
