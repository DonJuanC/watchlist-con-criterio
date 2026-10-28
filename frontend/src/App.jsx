// src/App.jsx
// CINE-04: Composición de la pantalla principal.
// CINE-09: flujo nuevo en tres vistas — inicio (búsqueda), película con sus vecinas (ego) y
// el mapa completo como vista secundaria. La carga del grafo arranca al abrir la app, así
// el servidor ya está despierto cuando la persona termina de elegir qué buscar.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  ServerCog,
  AlertTriangle,
  ArrowLeft,
  Network,
} from "lucide-react";
import GraphCanvas from "./components/GraphCanvas";
import GraphControls from "./components/GraphControls";
import SearchOverlay from "./components/SearchOverlay";
import MovieDetailDrawer from "./components/MovieDetailDrawer";
import OnboardingHint from "./components/OnboardingHint";
import HomeSearch from "./components/HomeSearch";
import EgoView from "./components/EgoView";
import ExternalView from "./components/ExternalView";
import NextUpView from "./components/NextUpView";
import useCineStore from "./store/useCineStore";
import { fetchGraph } from "./services/api";

function ServerWarmingBanner() {
  const isServerWarming = useCineStore((s) => s.isServerWarming);
  if (!isServerWarming) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex w-max max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-full border border-amber-500/30 bg-amber-950/90 px-4 py-2 text-sm text-amber-300 shadow-lg backdrop-blur">
      <ServerCog size={16} className="shrink-0 animate-spin" />
      Despertando el servidor… la primera vez puede tardar hasta un minuto.
    </div>
  );
}

function GraphError({ message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center text-red-400">
      <AlertTriangle size={28} />
      <p className="max-w-sm text-sm">
        No pudimos cargar las películas. Recarga la página en unos segundos.
      </p>
      {message && (
        <p className="max-w-sm text-xs text-neutral-500">{message}</p>
      )}
    </div>
  );
}

function GraphLoading({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-neutral-400">
      <Loader2 size={28} className="animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

const PILL_BUTTON =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-white/10 hover:text-white";

export default function App() {
  const graphCanvasRef = useRef(null);
  const [view, setView] = useState("home"); // home | ego | external | next | map
  const [centerId, setCenterId] = useState(null);
  const [externalMovie, setExternalMovie] = useState(null); // CINE-10: película fuera del catálogo

  const isLoading = useCineStore((s) => s.isLoading);
  const graphError = useCineStore((s) => s.graphError);
  const rawGraph = useCineStore((s) => s.rawGraph);
  const setRawGraph = useCineStore((s) => s.setRawGraph);
  const setLoading = useCineStore((s) => s.setLoading);
  const setGraphError = useCineStore((s) => s.setGraphError);

  const graphReady = rawGraph.nodes.length > 0;

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

  // useCallback: ExternalView lo usa como dependencia de su effect.
  const handlePick = useCallback((id) => {
    setCenterId(id);
    setView("ego");
  }, []);

  const handlePickExternal = useCallback((movie) => {
    setExternalMovie(movie);
    setView("external");
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-neutral-950">
      <ServerWarmingBanner />

      {/* Inicio: siempre montado (solo oculto) para no perder la búsqueda al volver. */}
      <div className={view === "home" ? "h-full overflow-y-auto" : "hidden"}>
        <HomeSearch
          onPick={handlePick}
          onPickExternal={handlePickExternal}
          onShowNextUp={() => setView("next")}
          onShowMap={() => setView("map")}
        />
      </div>

      {view === "external" && externalMovie && (
        <div className="h-full overflow-y-auto">
          <nav className="mx-auto flex w-full max-w-xl items-center px-4 pt-4">
            <button
              type="button"
              onClick={() => setView("home")}
              className={PILL_BUTTON}
            >
              <ArrowLeft size={14} />
              Volver
            </button>
          </nav>
          <ExternalView movie={externalMovie} onPick={handlePick} />
        </div>
      )}

      {view === "next" && (
        <div className="h-full overflow-y-auto">
          <nav className="mx-auto flex w-full max-w-xl items-center px-4 pt-4">
            <button
              type="button"
              onClick={() => setView("home")}
              className={PILL_BUTTON}
            >
              <ArrowLeft size={14} />
              Volver
            </button>
          </nav>
          <NextUpView />
        </div>
      )}

      {view === "ego" && (
        <div className="h-full overflow-y-auto">
          <nav className="mx-auto flex w-full max-w-xl items-center justify-between px-4 pt-4">
            <button
              type="button"
              onClick={() => setView("home")}
              className={PILL_BUTTON}
            >
              <ArrowLeft size={14} />
              Volver
            </button>
            <button
              type="button"
              onClick={() => setView("map")}
              className={PILL_BUTTON}
            >
              <Network size={14} />
              Ver todo el mapa
            </button>
          </nav>

          {graphReady && <EgoView centerId={centerId} onSelect={setCenterId} />}
          {!graphReady && graphError && !isLoading && (
            <GraphError message={graphError} />
          )}
          {!graphReady && !graphError && (
            <GraphLoading label="Preparando tus películas…" />
          )}
        </div>
      )}

      {view === "map" && (
        <div className="absolute inset-0 flex flex-col">
          <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 px-4">
            <button
              type="button"
              onClick={() => setView(centerId ? "ego" : "home")}
              className={PILL_BUTTON}
            >
              <ArrowLeft size={14} />
              Volver
            </button>
            <span className="text-xs text-neutral-500">Mapa completo</span>
          </header>

          {/* translateZ(0) hace que los paneles con position:fixed del mapa (búsqueda,
              detalle, controles) se acomoden dentro de esta caja y no tapen la barra de arriba. */}
          <div
            className="relative flex-1 overflow-hidden"
            style={{ transform: "translateZ(0)" }}
          >
            <SearchOverlay />
            <MovieDetailDrawer />

            {isLoading && !graphReady && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-neutral-400">
                <Loader2 size={28} className="animate-spin" />
                <p className="text-sm">Cargando el mapa…</p>
              </div>
            )}

            {graphError && !isLoading && (
              <div className="absolute inset-0 z-10">
                <GraphError message={graphError} />
              </div>
            )}

            {!graphError && (
              <>
                <GraphCanvas ref={graphCanvasRef} />
                {graphReady && <GraphControls />}
                {graphReady && <OnboardingHint />}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
