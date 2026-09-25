// src/App.jsx
// CINE-04: Composición de la pantalla principal — grafo de fondo, overlay de búsqueda,
// panel de detalle y notificación de cold start.

import { useEffect, useRef } from 'react';
import { Loader2, ServerCog, AlertTriangle } from 'lucide-react';
import GraphCanvas from './components/GraphCanvas';
import GraphControls from './components/GraphControls';
import SearchOverlay from './components/SearchOverlay';
import MovieDetailDrawer from './components/MovieDetailDrawer';
import useCineStore from './store/useCineStore';
import { fetchGraph } from './services/api';

function ServerWarmingBanner() {
    const isServerWarming = useCineStore((s) => s.isServerWarming);
    if (!isServerWarming) return null;

    return (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-500/30 bg-amber-950/90 px-4 py-2 text-sm text-amber-300 shadow-lg backdrop-blur">
            <ServerCog size={16} className="animate-spin" />
            Reactivando servidor en la nube... (puede tardar hasta un minuto en el free tier)
        </div>
    );
}

export default function App() {
    const graphCanvasRef = useRef(null);
    const isLoading = useCineStore((s) => s.isLoading);
    const graphError = useCineStore((s) => s.graphError);
    const rawGraph = useCineStore((s) => s.rawGraph);
    const setRawGraph = useCineStore((s) => s.setRawGraph);
    const setLoading = useCineStore((s) => s.setLoading);
    const setGraphError = useCineStore((s) => s.setGraphError);

    useEffect(() => {
        let cancelled = false;

        async function loadGraph() {
            setLoading(true);
            try {
                const data = await fetchGraph();
                if (!cancelled) setRawGraph(data);
            } catch (err) {
                if (!cancelled) setGraphError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadGraph();
        return () => {
            cancelled = true;
        };
    }, [setRawGraph, setLoading, setGraphError]);

    return (
        <div className="relative h-screen w-screen overflow-hidden bg-neutral-950">
            <SearchOverlay />
            <MovieDetailDrawer />
            <ServerWarmingBanner />

            {isLoading && rawGraph.nodes.length === 0 && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-neutral-400">
                    <Loader2 size={28} className="animate-spin" />
                    <p className="text-sm">Cargando grafo de conexiones...</p>
                </div>
            )}

            {graphError && !isLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-red-400">
                    <AlertTriangle size={28} />
                    <p className="max-w-sm text-center text-sm">{graphError}</p>
                </div>
            )}

            {!graphError && (
                <>
                    <GraphCanvas ref={graphCanvasRef} />
                    {rawGraph.nodes.length > 0 && <GraphControls />}
                </>
            )}
        </div>
    );
}
