// src/App.jsx
// Aplicación principal con barra de navegación superior, deep linking y carga diferida.

import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  ServerCog,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import Navbar from "./components/Navbar";
import GraphControls from "./components/GraphControls";
import SearchOverlay from "./components/SearchOverlay";
import MovieDetailDrawer from "./components/MovieDetailDrawer";
import OnboardingHint from "./components/OnboardingHint";
import HomeSearch from "./components/HomeSearch";
import EgoView from "./components/EgoView";
import ExternalView from "./components/ExternalView";
import NextUpView from "./components/NextUpView";
import AmbientBackdrop from "./components/AmbientBackdrop";
import useCineStore from "./store/useCineStore";
import { fetchGraph } from "./services/api";

const GraphCanvas = lazy(() => import("./components/GraphCanvas"));

function ServerWarmingBanner() {
  const isServerWarming = useCineStore((s) => s.isServerWarming);
  if (!isServerWarming) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex w-max max-w-[92vw] -translate-x-1/2 items-center gap-2.5 rounded-full border border-amber-500/40 bg-amber-950/90 px-4 py-2.5 text-xs sm:text-sm text-amber-200 shadow-2xl backdrop-blur-xl">
      <ServerCog size={16} className="shrink-0 animate-spin text-amber-400" />
      <span>Despertando el servidor... la primera carga puede tardar unos segundos.</span>
    </div>
  );
}

function GraphError({ message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center text-red-400">
      <AlertTriangle size={28} />
      <p className="max-w-sm text-sm font-medium">
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
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-neutral-400">
      <div className="relative flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
      </div>
      <p className="font-serif text-sm text-neutral-300 tracking-wide">{label}</p>
    </div>
  );
}

const PILL_BUTTON =
  "inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-neutral-300 backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/10 hover:text-white active:scale-95";

function parseRouteFromHash() {
  const hash = window.location.hash || "";
  if (hash.startsWith("#/movie/")) {
    const id = Number.parseInt(hash.slice(8), 10);
    if (Number.isInteger(id) && id > 0) {
      return { view: "ego", centerId: id };
    }
  }
  if (hash === "#/que-veo-hoy") {
    return { view: "next", centerId: null };
  }
  if (hash === "#/mapa") {
    return { view: "map", centerId: null };
  }
  return { view: "home", centerId: null };
}

export default function App() {
  const graphCanvasRef = useRef(null);

  const initialRoute = useRef(parseRouteFromHash());
  const [view, setView] = useState(initialRoute.current.view);
  const [centerId, setCenterId] = useState(initialRoute.current.centerId);
  const [externalMovie, setExternalMovie] = useState(null);
  const [homeKey, setHomeKey] = useState(0);

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

  useEffect(() => {
    const handleHashChange = () => {
      const route = parseRouteFromHash();
      setView(route.view);
      if (route.centerId != null) {
        setCenterId(route.centerId);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (view === "ego" && centerId) {
      const node = rawGraph.nodes.find((n) => n.id === centerId);
      document.title = node ? `${node.title} — Watchlist con Criterio` : "Película — Watchlist con Criterio";
    } else if (view === "next") {
      document.title = "¿Qué veo hoy? — Watchlist con Criterio";
    } else if (view === "map") {
      document.title = "Mapa de Conexiones — Watchlist con Criterio";
    } else {
      document.title = "Watchlist con Criterio — Cine & Conexiones";
    }
  }, [view, centerId, rawGraph.nodes]);

  const navigate = useCallback((targetView, targetId = null) => {
    if (targetView === "home") {
      if (window.location.hash !== "#/" && window.location.hash !== "") {
        window.location.hash = "#/";
      } else {
        setView("home");
      }
    } else if (targetView === "ego" && targetId != null) {
      setCenterId(targetId);
      window.location.hash = `#/movie/${targetId}`;
      setView("ego");
    } else if (targetView === "next") {
      window.location.hash = "#/que-veo-hoy";
      setView("next");
    } else if (targetView === "map") {
      window.location.hash = "#/mapa";
      setView("map");
    }
  }, []);

  const handleResetAll = useCallback(() => {
    setCenterId(null);
    setExternalMovie(null);
    setHomeKey((k) => k + 1);
    window.location.hash = "#/";
    setView("home");
  }, []);

  const handlePick = useCallback((id) => {
    navigate("ego", id);
  }, [navigate]);

  const handlePickExternal = useCallback((movie) => {
    setExternalMovie(movie);
    setView("external");
  }, []);

  const activePoster =
    view === "ego" && centerId
      ? rawGraph.nodes.find((n) => n.id === centerId)?.poster_path
      : view === "external" && externalMovie
        ? externalMovie.poster_path
        : null;

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-neutral-950">
      <AmbientBackdrop posterPath={activePoster} />
      <ServerWarmingBanner />

      {/* Barra de navegación unificada superior */}
      <Navbar
        currentView={view}
        onNavigate={navigate}
        onResetAll={handleResetAll}
      />

      {/* Contenedor principal de vistas */}
      <main className="relative flex-1 overflow-hidden">
        {/* Inicio: siempre montado */}
        <div className={view === "home" ? "h-full overflow-y-auto" : "hidden"}>
          <HomeSearch
            key={homeKey}
            onPick={handlePick}
            onPickExternal={handlePickExternal}
            onShowNextUp={() => navigate("next")}
            onShowMap={() => navigate("map")}
          />
        </div>

        {view === "external" && externalMovie && (
          <div className="h-full overflow-y-auto pt-2">
            <nav className="mx-auto flex w-full max-w-xl items-center px-4 pt-2">
              <button
                type="button"
                onClick={() => navigate("home")}
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
          <div className="h-full overflow-y-auto pt-2">
            <NextUpView />
          </div>
        )}

        {view === "ego" && (
          <div className="h-full overflow-y-auto pt-2">
            {graphReady && <EgoView centerId={centerId} onSelect={handlePick} />}
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
            <div
              className="relative flex-1 overflow-hidden"
              style={{ transform: "translateZ(0)" }}
            >
              <SearchOverlay />
              <MovieDetailDrawer />

              {isLoading && !graphReady && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-neutral-400">
                  <div className="h-10 w-10 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
                  <p className="text-sm font-medium">Cargando el mapa…</p>
                </div>
              )}

              {graphError && !isLoading && (
                <div className="absolute inset-0 z-10">
                  <GraphError message={graphError} />
                </div>
              )}

              {!graphError && (
                <>
                  <Suspense
                    fallback={
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-neutral-400">
                        <div className="h-10 w-10 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
                        <p className="text-sm font-medium">Iniciando motor gráfico…</p>
                      </div>
                    }
                  >
                    <GraphCanvas ref={graphCanvasRef} />
                  </Suspense>
                  {graphReady && <GraphControls />}
                  {graphReady && <OnboardingHint />}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
