// src/components/Navbar.jsx
// Barra superior de navegación y marca cinematográfica:
// Proporciona identidad visual, navegación entre secciones, conteo del catálogo
// y un botón omnipresente para "Empezar de nuevo" / limpiar estado.

import { useState } from "react";
import { Film, Popcorn, Network, RotateCcw, Compass, Scale } from "lucide-react";
import useCineStore from "../store/useCineStore";
import LegalModal from "./LegalModal";

/**
 * @param {object} props
 * @param {string} props.currentView "home" | "ego" | "next" | "map" | "external"
 * @param {(view: string, id?: number|null) => void} props.onNavigate
 * @param {() => void} [props.onResetAll]
 */
export default function Navbar({ currentView, onNavigate, onResetAll }) {
  const [showLegal, setShowLegal] = useState(false);
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
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#0a0a0c]/85 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Identidad de Marca y Logo Cinéfilo */}
        <button
          type="button"
          onClick={handleBrandClick}
          aria-label="Ir al inicio y reiniciar"
          className="group flex items-center gap-2.5 text-left focus-ring-cinematic rounded-lg p-1"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-neutral-300 transition-all duration-200 group-hover:border-white/20 group-hover:text-white">
            <Film size={14} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-sm font-normal tracking-wide text-white group-hover:text-neutral-200 transition-colors">
              Watchlist
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-400">
              / Criterio
            </span>
          </div>
        </button>

        {/* Enlaces de Navegación Centrales */}
        <nav className="flex items-center gap-1" aria-label="Navegación principal">
          <button
            type="button"
            onClick={() => onNavigate("home")}
            aria-current={isHome ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all focus-ring-cinematic ${
              isHome
                ? "bg-white/[0.08] text-white border border-white/[0.1]"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]"
            }`}
          >
            <Compass size={13} />
            <span className="hidden sm:inline">Archivo</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("next")}
            aria-current={currentView === "next" ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all focus-ring-cinematic ${
              currentView === "next"
                ? "bg-white/[0.08] text-white border border-white/[0.1]"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]"
            }`}
          >
            <Popcorn size={13} />
            <span>¿Qué veo hoy?</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("map")}
            aria-current={currentView === "map" ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all focus-ring-cinematic ${
              currentView === "map"
                ? "bg-white/[0.08] text-white border border-white/[0.1]"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]"
            }`}
          >
            <Network size={13} />
            <span className="hidden sm:inline">Mapa</span>
          </button>
        </nav>

        {/* Botón de Reinicio y contador */}
        <div className="flex items-center gap-2">
          {movieCount > 0 && (
            <div
              title="Películas vistas registradas en el catálogo con criterio"
              className="hidden lg:inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[10px] font-mono text-neutral-400"
            >
              <span className="h-1 w-1 rounded-full bg-amber-400/90" />
              <span>{movieCount} obras</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleBrandClick}
            title="Reiniciar todo y volver al inicio"
            aria-label="Reiniciar y volver al inicio"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-xs font-medium text-neutral-300 transition-all hover:border-white/20 hover:text-white active:scale-95 focus-ring-cinematic"
          >
            <RotateCcw size={12} className="text-neutral-400" />
            <span className="hidden sm:inline">Inicio</span>
          </button>

          {/* Botón de Marco Legal, Privacidad y Atribuciones */}
          <button
            type="button"
            onClick={() => setShowLegal(true)}
            title="Marco Legal, Privacidad y Atribución"
            aria-label="Ver Marco Legal, Privacidad y Atribución"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.02] text-neutral-400 transition-all hover:border-white/20 hover:text-white active:scale-95 focus-ring-cinematic"
          >
            <Scale size={12} />
          </button>
        </div>
      </div>

      <LegalModal isOpen={showLegal} onClose={() => setShowLegal(false)} />
    </header>
  );
}
