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
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-neutral-950/80 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Identidad de Marca y Logo Cinéfilo */}
        <button
          type="button"
          onClick={handleBrandClick}
          aria-label="Ir al inicio y reiniciar"
          className="group flex items-center gap-2.5 text-left focus-ring-cinematic rounded-lg p-1"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] text-neutral-200 transition-all duration-300 group-hover:scale-105 group-hover:border-white/30 group-hover:bg-white/[0.08]">
            <Film size={15} />
          </div>
          <div>
            <span className="block font-serif text-sm font-semibold tracking-wider text-white group-hover:text-neutral-200 transition-colors">
              WATCHLIST <span className="font-sans text-[9px] uppercase tracking-widest text-neutral-300 font-medium ml-1.5 px-1.5 py-0.5 rounded bg-white/10 border border-white/15">Criterio</span>
            </span>
            <span className="hidden sm:block text-[10px] text-neutral-400">
              Archivo y conexiones de cine
            </span>
          </div>
        </button>

        {/* Enlaces de Navegación Centrales */}
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Navegación principal">
          <button
            type="button"
            onClick={() => onNavigate("home")}
            aria-current={isHome ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all focus-ring-cinematic ${
              isHome
                ? "bg-white/10 text-white shadow-sm border border-white/20"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Compass size={13} />
            <span className="hidden sm:inline">Archivo</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("next")}
            aria-current={currentView === "next" ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all focus-ring-cinematic ${
              currentView === "next"
                ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                : "text-neutral-400 hover:text-emerald-300 hover:bg-white/5"
            }`}
          >
            <Popcorn size={13} />
            <span>¿Qué veo hoy?</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("map")}
            aria-current={currentView === "map" ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all focus-ring-cinematic ${
              currentView === "map"
                ? "bg-white/10 text-white border border-white/20"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Network size={13} />
            <span className="hidden sm:inline">Mapa</span>
          </button>
        </nav>

        {/* Botón de Reinicio / Empezar de nuevo y contador */}
        <div className="flex items-center gap-2">
          {movieCount > 0 && (
            <div
              title="Películas vistas registradas en el catálogo con criterio"
              className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-neutral-400"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
              <span>{movieCount} obras</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleBrandClick}
            title="Reiniciar todo y volver al inicio"
            aria-label="Reiniciar y volver al inicio"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-300 backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/10 hover:text-white active:scale-95 focus-ring-cinematic"
          >
            <RotateCcw size={12} className="text-neutral-400" />
            <span>Inicio</span>
          </button>

          {/* Botón de Marco Legal, Privacidad y Atribuciones */}
          <button
            type="button"
            onClick={() => setShowLegal(true)}
            title="Marco Legal, Privacidad y Atribución"
            aria-label="Ver Marco Legal, Privacidad y Atribución"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-neutral-400 backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/10 hover:text-white active:scale-95 focus-ring-cinematic"
          >
            <Scale size={13} />
          </button>
        </div>
      </div>

      <LegalModal isOpen={showLegal} onClose={() => setShowLegal(false)} />
    </header>
  );
}
