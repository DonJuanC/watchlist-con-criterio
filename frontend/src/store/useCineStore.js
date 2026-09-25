// src/store/useCineStore.js
// CINE-04: Store global (Zustand). Estado desacoplado entre el grafo (datos "base",
// que no cambian con cada búsqueda) y la búsqueda semántica (que solo afecta qué se
// resalta), para que buscar no dispare un remount/reinicio de la física del grafo.

import { useMemo } from 'react';
import { create } from 'zustand';

// CINE-04B: piso por defecto y rango del slider de afinidad semántica mínima.
// Coincide con el piso k-NN de CINE-03B (0.65) para que el estado inicial del
// control refleje exactamente lo que ya se ve al cargar el grafo.
export const MIN_SIMILARITY_DEFAULT = 0.65;
export const MIN_SIMILARITY_RANGE = { min: 0.6, max: 0.85, step: 0.01 };

const useCineStore = create((set) => ({
    // --- Grafo ---
    rawGraph: { nodes: [], links: [] }, // { nodes: [...], links: [...] } tal como los devuelve GET /api/graph
    isLoading: false,
    isServerWarming: false,
    graphError: null,

    // --- Controles de grafo (CINE-04B): filtrado 100% en cliente, sin recálculo
    // en el backend ni reinicio de la simulación física — solo cambia qué subset
    // de `rawGraph.links` se le pasa a ForceGraph2D.
    minSimilarity: MIN_SIMILARITY_DEFAULT,
    showDirectorLinks: true,
    showSemanticLinks: true,

    // --- Búsqueda semántica ---
    searchQuery: '',
    matchedMovieIds: new Map(), // id (number) -> similarity (0..1). Map vacío = sin búsqueda activa.
    isSearching: false,
    searchError: null,

    // --- Selección / detalle ---
    selectedMovie: null, // nodo completo del grafo, o null

    // --- Acciones: grafo ---
    setRawGraph: (graph) => set({ rawGraph: graph, graphError: null }),
    setLoading: (isLoading) => set({ isLoading }),
    setServerWarming: (isServerWarming) => set({ isServerWarming }),
    setGraphError: (graphError) => set({ graphError }),

    // --- Acciones: controles de grafo ---
    setMinSimilarity: (minSimilarity) => set({ minSimilarity }),
    toggleDirectorLinks: () => set((s) => ({ showDirectorLinks: !s.showDirectorLinks })),
    toggleSemanticLinks: () => set((s) => ({ showSemanticLinks: !s.showSemanticLinks })),

    // --- Acciones: búsqueda ---
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setIsSearching: (isSearching) => set({ isSearching }),
    setSearchError: (searchError) => set({ searchError }),
    setMatchedMovieIds: (results) => {
        // results: array de filas de /api/search/semantic ({ id, similarity, ... })
        const map = new Map(results.map((r) => [r.id, r.similarity]));
        set({ matchedMovieIds: map });
    },
    clearSearch: () =>
        set({ searchQuery: '', matchedMovieIds: new Map(), searchError: null, isSearching: false }),

    // --- Acciones: selección ---
    setSelectedMovie: (selectedMovie) => set({ selectedMovie }),
    clearSelectedMovie: () => set({ selectedMovie: null }),
}));

export default useCineStore;

/**
 * Selector reactivo: deriva los links visibles a partir de rawGraph.links y los
 * controles activos (minSimilarity, showDirectorLinks, showSemanticLinks).
 *
 * Se implementa como hook (no como campo del store) y memoizado por sus deps
 * primitivas, para que SOLO recalcule el array cuando cambia un control o llega
 * un grafo nuevo — nunca en cada render — y para que GraphCanvas reciba un nuevo
 * array de `links` sin que cambien las referencias de `nodes`, que es lo que le
 * permite a ForceGraph2D conservar las posiciones (x, y) ya calculadas en vez de
 * reiniciar la simulación física.
 */
export function useFilteredLinks() {
    const links = useCineStore((s) => s.rawGraph.links);
    const minSimilarity = useCineStore((s) => s.minSimilarity);
    const showDirectorLinks = useCineStore((s) => s.showDirectorLinks);
    const showSemanticLinks = useCineStore((s) => s.showSemanticLinks);

    return useMemo(() => {
        return links.filter((link) => {
            if (link.type === 'same_director') return showDirectorLinks;
            if (link.type === 'semantic_similarity') {
                return showSemanticLinks && (link.weight ?? 0) >= minSimilarity;
            }
            return true; // tipo desconocido: se muestra por defecto en vez de ocultarlo silenciosamente
        });
    }, [links, minSimilarity, showDirectorLinks, showSemanticLinks]);
}
