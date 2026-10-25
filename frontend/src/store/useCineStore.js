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

    // --- Navegación de cámara (CINE-07) ---
    // Petición desacoplada de "enfoca este nodo": quien pide el foco (ej. la lista de
    // conexiones directas en MovieDetailDrawer) no necesita una referencia directa al
    // ForceGraph2D — solo escribe aquí, y GraphCanvas reacciona vía useEffect.
    focusNodeId: null,

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

    // --- Acciones: navegación de cámara ---
    focusNode: (focusNodeId) => set({ focusNodeId }),
    clearFocusNode: () => set({ focusNodeId: null }),
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

// CINE-09: vista "una película y sus vecinas". Dado un grafo y una película central,
// devuelve como máximo `limit` vecinas, mezclando afinidad semántica (las más cercanas)
// y mismo director (las de año más próximo) para que la vista no se llene de un solo tipo.
// Es una función pura: no toca el store ni la simulación del grafo completo.
export const EGO_DEFAULT_LIMIT = 6;

function egoEndpointId(endpoint) {
    return typeof endpoint === 'object' && endpoint !== null ? endpoint.id : endpoint;
}

export function buildEgoGraph(graph, centerId, limit = EGO_DEFAULT_LIMIT) {
    const empty = { center: null, neighbors: [], nodes: [], links: [] };
    if (centerId == null) return empty;

    const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
    const center = nodesById.get(centerId);
    if (!center) return empty;

    // Un solo vínculo por vecina: gana el de mayor peso (mismo director pesa 1).
    const byNeighbor = new Map();
    for (const link of graph.links) {
        const s = egoEndpointId(link.source);
        const t = egoEndpointId(link.target);
        if (s !== centerId && t !== centerId) continue;
        const otherId = s === centerId ? t : s;
        const other = nodesById.get(otherId);
        if (!other || otherId === centerId) continue;
        const weight = link.type === 'same_director' ? 1 : link.weight ?? 0;
        const prev = byNeighbor.get(otherId);
        if (!prev || weight > prev.weight) {
            byNeighbor.set(otherId, { node: other, type: link.type, weight });
        }
    }

    const semantic = [];
    const director = [];
    for (const entry of byNeighbor.values()) {
        (entry.type === 'same_director' ? director : semantic).push(entry);
    }
    semantic.sort((a, b) => b.weight - a.weight);
    const yearGap = (e) => Math.abs((e.node.release_year ?? 0) - (center.release_year ?? 0));
    director.sort((a, b) => yearGap(a) - yearGap(b));

    const half = Math.ceil(limit / 2);
    const picked = [...semantic.slice(0, half), ...director.slice(0, limit - half)];
    const leftovers = [...semantic.slice(half), ...director.slice(limit - half)];
    picked.push(...leftovers.slice(0, Math.max(0, limit - picked.length)));

    // Copias superficiales: ForceGraph2D escribe x/y en los nodos, y no queremos
    // contaminar las posiciones del mapa completo.
    return {
        center,
        neighbors: picked,
        nodes: [{ ...center }, ...picked.map((p) => ({ ...p.node }))],
        links: picked.map((p) => ({ source: centerId, target: p.node.id, type: p.type, weight: p.weight })),
    };
}

/** Hook: vecinas de `centerId`, memoizado para que la referencia solo cambie si cambia el grafo o el centro. */
export function useEgoGraph(centerId, limit = EGO_DEFAULT_LIMIT) {
    const rawGraph = useCineStore((s) => s.rawGraph);
    return useMemo(() => buildEgoGraph(rawGraph, centerId, limit), [rawGraph, centerId, limit]);
}
