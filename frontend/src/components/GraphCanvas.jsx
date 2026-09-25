// src/components/GraphCanvas.jsx
// CINE-04: Render del grafo con ForceGraph2D. Pintado custom de nodos para atenuar
// los que no coinciden con una búsqueda activa, sin nunca reiniciar la simulación
// física (no se remonta el componente al buscar; solo cambia matchedMovieIds).

import { forwardRef, useImperativeHandle, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import useCineStore, { useFilteredLinks } from '../store/useCineStore';

const BASE_NODE_COLOR = '#8b8b8b';
const MATCH_RING_COLOR = '#22d3ee'; // cyan brillante para nodos que matchean la búsqueda
const DIMMED_ALPHA = 0.15;
const FULL_ALPHA = 1.0;
const CENTER_ZOOM = 4;
const CENTER_DURATION_MS = 600;

const GraphCanvas = forwardRef(function GraphCanvas(props, forwardedRef) {
    const internalRef = useRef(null);
    const rawNodes = useCineStore((s) => s.rawGraph.nodes);
    const filteredLinks = useFilteredLinks(); // CINE-04B: subset en memoria según los controles
    const matchedMovieIds = useCineStore((s) => s.matchedMovieIds);
    const setSelectedMovie = useCineStore((s) => s.setSelectedMovie);

    // Expone el ref interno de ForceGraph2D hacia el padre si lo necesita.
    useImperativeHandle(forwardedRef, () => internalRef.current);

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

    return (
        <ForceGraph2D
            ref={internalRef}
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
            linkColor={(link) => (link.type === 'same_director' ? 'rgba(250,204,21,0.35)' : 'rgba(34,211,238,0.35)')}
            linkWidth={(link) => (link.type === 'same_director' ? 1.5 : 1)}
            onNodeClick={handleNodeClick}
            cooldownTicks={100}
        />
    );
});

export default GraphCanvas;
