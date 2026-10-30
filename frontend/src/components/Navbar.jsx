// src/components/Navbar.jsx
// Barra superior de navegación y marca cinematográfica:
// Proporciona identidad visual, navegación entre secciones, conteo del catálogo
// y un botón omnipresente para "Empezar de nuevo" / limpiar estado.

import { Film, Popcorn, Network, RotateCcw, Compass } from "lucide-react";
import useCineStore from "../store/useCineStore";

/**
 * @param {object} props
 * @param {string} props.currentView "home" | "ego" | "next" | "map" | "external"
 * @param {(view: string, id?: number|null) => void} props.onNavigate
 * @param {() => void} [props.onResetAll]
 */
export default function Navbar({ currentView, onNavigate, onResetAll }) {
  const rawNodes = useCineStore((s) => s.rawGraph.nodes);
  const movieCount = rawNodes.length;

  const handleBrandClick = () => {
    if (onResetAll) {
      onResetAll();
    } else {
      onNavigate("home");
    }
  };

  const isHome = currentView === "home";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-neutral-950/80 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Identidad de Marca y Logo Cinéfilo */}
        <button
          type="button"
          onClick={handleBrandClick}
          aria-label="Ir al inicio y reiniciar"
          className="group flex items-center gap-2.5 text-left focus:outline-none"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-950/40 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.15)] transition-all duration-300 group-hover:scale-105 group-hover:border-cyan-400 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.35)]">
            <Film size={16} />
          </div>
          <div>
            <span className="block font-serif text-sm font-bold tracking-wider text-white group-hover:text-cyan-300 transition-colors">
              WATCHLIST <span className="font-sans text-[10px] uppercase tracking-widest text-cyan-400 font-semibold ml-1 px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/30">Criterio</span>
            </span>
            <span className="hidden sm:block text-[10px] text-neutral-400">
              Explorador de afinidad y autoría
            </span>
          </div>
        </button>

        {/* Enlaces de Navegación Centrales */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => onNavigate("home")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              isHome
                ? "bg-white/10 text-white shadow-sm border border-white/15"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Compass size={13} />
            <span className="hidden sm:inline">Explorar</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("next")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              currentView === "next"
                ? "bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                : "text-neutral-400 hover:text-emerald-300 hover:bg-white/5"
            }`}
          >
            <Popcorn size={13} />
            <span>¿Qué veo hoy?</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("map")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              currentView === "map"
                ? "bg-cyan-950/70 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                : "text-neutral-400 hover:text-cyan-300 hover:bg-white/5"
            }`}
          >
            <Network size={13} />
            <span className="hidden sm:inline">Mapa completo</span>
          </button>
        </nav>

        {/* Botón de Reinicio / Empezar de nuevo y contador */}
        <div className="flex items-center gap-2">
          {movieCount > 0 && (
            <div
              title="Películas vistas registradas en el catálogo con embeddings"
              className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-neutral-400"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{movieCount} películas</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleBrandClick}
            title="Reiniciar todo y volver al inicio"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-neutral-200 backdrop-blur-md transition-all hover:border-cyan-400/50 hover:bg-white/10 hover:text-white hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] active:scale-95"
          >
            <RotateCcw size={12} className="text-cyan-400" />
            <span className="hidden sm:inline">Empezar de nuevo</span>
            <span className="sm:hidden">Reiniciar</span>
          </button>
        </div>
      </div>
    </header>
  );
}
