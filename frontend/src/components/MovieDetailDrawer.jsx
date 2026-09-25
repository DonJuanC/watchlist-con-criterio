// src/components/MovieDetailDrawer.jsx
// CINE-04: Panel lateral con el detalle del nodo seleccionado y sus conexiones directas.

import { useMemo, useCallback } from 'react';
import { X, Network } from 'lucide-react';
import useCineStore from '../store/useCineStore';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

/** Normaliza source/target de un link: puede ser un id crudo o el nodo ya resuelto por la simulación. */
function linkEndpointId(endpoint) {
    return typeof endpoint === 'object' && endpoint !== null ? endpoint.id : endpoint;
}

export default function MovieDetailDrawer() {
    const selectedMovie = useCineStore((s) => s.selectedMovie);
    const rawGraph = useCineStore((s) => s.rawGraph);
    const clearSelectedMovie = useCineStore((s) => s.clearSelectedMovie);
    const setMatchedMovieIds = useCineStore((s) => s.setMatchedMovieIds);
    const setSelectedMovie = useCineStore((s) => s.setSelectedMovie);

    const connections = useMemo(() => {
        if (!selectedMovie) return [];
        const nodesById = new Map(rawGraph.nodes.map((n) => [n.id, n]));

        return rawGraph.links
            .filter((link) => {
                const sourceId = linkEndpointId(link.source);
                const targetId = linkEndpointId(link.target);
                return sourceId === selectedMovie.id || targetId === selectedMovie.id;
            })
            .map((link) => {
                const sourceId = linkEndpointId(link.source);
                const targetId = linkEndpointId(link.target);
                const otherId = sourceId === selectedMovie.id ? targetId : sourceId;
                return { node: nodesById.get(otherId), type: link.type, weight: link.weight };
            })
            .filter((c) => c.node);
    }, [selectedMovie, rawGraph]);

    const handleExploreConnections = useCallback(() => {
        // Resalta en el grafo (vía matchedMovieIds) los nodos conectados directamente,
        // reutilizando el mismo mecanismo de atenuación que usa la búsqueda semántica.
        const results = connections.map((c) => ({
            id: c.node.id,
            similarity: c.type === 'semantic_similarity' ? c.weight ?? 0.65 : 1,
        }));
        setMatchedMovieIds(results);
    }, [connections, setMatchedMovieIds]);

    if (!selectedMovie) return null;

    const { title, release_year, director, cinematographer, genres, overview, poster_path } = selectedMovie;

    return (
        <aside className="fixed right-0 top-0 z-30 h-full w-96 overflow-y-auto border-l border-white/10 bg-neutral-900/95 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Detalle</h2>
                <button
                    onClick={clearSelectedMovie}
                    aria-label="Cerrar panel"
                    className="rounded-full p-1 text-neutral-400 hover:bg-white/10 hover:text-white"
                >
                    <X size={18} />
                </button>
            </div>

            {poster_path && (
                <img
                    src={`${TMDB_IMAGE_BASE}${poster_path}`}
                    alt={title}
                    className="h-72 w-full object-cover"
                />
            )}

            <div className="space-y-3 p-4">
                <h3 className="text-lg font-bold text-white">
                    {title} {release_year ? <span className="text-neutral-400">({release_year})</span> : null}
                </h3>

                {director && <p className="text-sm text-neutral-300">Dir. {director}</p>}
                {cinematographer && (
                    <p className="text-sm text-neutral-400">Fotografía: {cinematographer}</p>
                )}
                {Array.isArray(genres) && genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {genres.map((g) => (
                            <span
                                key={g}
                                className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-neutral-300"
                            >
                                {g}
                            </span>
                        ))}
                    </div>
                )}
                {overview && <p className="text-sm leading-relaxed text-neutral-300">{overview}</p>}

                <button
                    onClick={handleExploreConnections}
                    disabled={connections.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600/20 px-3 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-600/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <Network size={16} />
                    Explorar {connections.length} conexión{connections.length !== 1 ? 'es' : ''} directa
                    {connections.length !== 1 ? 's' : ''}
                </button>

                {connections.length > 0 && (
                    <ul className="space-y-1 border-t border-white/10 pt-3">
                        {connections.map(({ node, type }) => (
                            <li key={node.id}>
                                <button
                                    onClick={() => setSelectedMovie(node)}
                                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-neutral-300 hover:bg-white/10"
                                >
                                    <span>{node.title}</span>
                                    <span className="text-xs text-neutral-500">
                                        {type === 'same_director' ? 'mismo director' : 'afinidad semántica'}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </aside>
    );
}
