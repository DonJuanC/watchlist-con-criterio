// src/components/MovieDetailDrawer.jsx
// CINE-04: Panel lateral con el detalle del nodo seleccionado y sus conexiones directas.

import { useMemo, useCallback } from "react";
import { X, Network, Crosshair } from "lucide-react";
import useCineStore from "../store/useCineStore";
import MovieInfo from "./MovieInfo";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

/** Normaliza source/target de un link: puede ser un id crudo o el nodo ya resuelto por la simulación. */
function linkEndpointId(endpoint) {
  return typeof endpoint === "object" && endpoint !== null
    ? endpoint.id
    : endpoint;
}

export default function MovieDetailDrawer() {
  const selectedMovie = useCineStore((s) => s.selectedMovie);
  const rawGraph = useCineStore((s) => s.rawGraph);
  const clearSelectedMovie = useCineStore((s) => s.clearSelectedMovie);
  const setMatchedMovieIds = useCineStore((s) => s.setMatchedMovieIds);
  const setSelectedMovie = useCineStore((s) => s.setSelectedMovie);
  const focusNode = useCineStore((s) => s.focusNode); // CINE-07

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
        return {
          node: nodesById.get(otherId),
          type: link.type,
          weight: link.weight,
        };
      })
      .filter((c) => c.node);
  }, [selectedMovie, rawGraph]);

  const handleExploreConnections = useCallback(() => {
    // Resalta en el grafo (vía matchedMovieIds) los nodos conectados directamente,
    // reutilizando el mismo mecanismo de atenuación que usa la búsqueda semántica.
    const results = connections.map((c) => ({
      id: c.node.id,
      similarity: c.type === "semantic_similarity" ? (c.weight ?? 0.65) : 1,
    }));
    setMatchedMovieIds(results);
  }, [connections, setMatchedMovieIds]);

  if (!selectedMovie) return null;

  const { title, poster_path } = selectedMovie;

  return (
    <aside className="fixed right-0 top-0 z-30 h-full w-96 overflow-y-auto border-l border-white/[0.06] bg-[#0a0a0c]/95 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-400">
          Ficha de Obra
        </h2>
        <button
          onClick={clearSelectedMovie}
          aria-label="Cerrar panel"
          className="rounded p-1 text-neutral-400 hover:text-white focus-ring-cinematic transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {poster_path && (
        <div className="relative h-72 w-full overflow-hidden bg-neutral-950">
          <img
            src={`${TMDB_IMAGE_BASE}${poster_path}`}
            alt={`Afiche de ${title}`}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-black/40" />
        </div>
      )}

      <div className="space-y-3 p-4">
        <MovieInfo movieId={selectedMovie.id} />

        <button
          onClick={handleExploreConnections}
          disabled={connections.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-xs font-medium text-neutral-200 transition-all hover:border-white/20 hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-ring-cinematic"
        >
          <Network size={14} className="text-neutral-400" />
          Explorar {connections.length}{" "}
          {connections.length === 1 ? "conexión directa" : "conexiones directas"}
        </button>

        {connections.length > 0 && (
          <div className="border-t border-white/[0.06] pt-3">
            <h4 className="mb-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-400">
              Puentes hacia otras películas
            </h4>
            <ul className="space-y-1">
              {connections.map(({ node, type, weight }) => (
                <li
                  key={node.id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-white/10"
                >
                  <button
                    onClick={() => setSelectedMovie(node)}
                    className="min-w-0 flex-1 text-left focus-ring-cinematic rounded"
                  >
                    <span className="block truncate text-sm text-neutral-300">
                      {node.title}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {type === "same_director"
                        ? "Mismo director"
                        : `${Math.round((weight ?? 0) * 100)}% misma atmósfera`}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      // CINE-08: botón explícito de foco — antes el clic en toda
                      // la fila seleccionaba Y enfocaba de forma implícita.
                      setSelectedMovie(node);
                      focusNode(node.id);
                    }}
                    aria-label={`Enfocar ${node.title} en el mapa`}
                    title="Enfocar en el mapa"
                    className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[11px] text-neutral-400 hover:border-white/20 hover:bg-white/10 hover:text-white focus-ring-cinematic"
                  >
                    <Crosshair size={12} />
                    Enfocar en el mapa
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
