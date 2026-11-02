// src/components/Navbar.jsx
// Barra superior: wordmark (vuelve al inicio y limpia el estado), cuatro destinos
// y el toggle de tema. En móvil los destinos se muestran solo como íconos con
// aria-label; el aviso legal vive en el footer de la portada.

import { Film, Popcorn, Network, Compass, UserRound, Sun, Moon, SlidersHorizontal } from "lucide-react";
import useThemeStore from "../store/useThemeStore";
import useAdminStore from "../store/useAdminStore";
import { BrandIsotype, BrandLockup } from "./brand/BrandIcons";

const NAV_ITEMS = [
  { view: "home", label: "Explorar", icon: Compass },
  { view: "next", label: "¿Qué veo hoy?", icon: Popcorn },
  { view: "map", label: "Mapa", icon: Network },
  { view: "selector", label: "Quién elige", icon: UserRound },
];

/**
 * @param {object} props
 * @param {string} props.currentView "home" | "ego" | "next" | "map" | "external" | "selector"
 * @param {(view: string, id?: number|null) => void} props.onNavigate
 * @param {() => void} [props.onResetAll]
 */
export default function Navbar({ currentView, onNavigate, onResetAll }) {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const nextThemeLabel = theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  const handleBrandClick = () => {
    if (onResetAll) onResetAll();
    else onNavigate("home");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-3 sm:px-6">
        <button
          type="button"
          onClick={handleBrandClick}
          aria-label="Cine con Criterio, ir al inicio"
          className="group flex shrink-0 items-center gap-2.5 p-1 text-left focus-ring-cinematic"
        >
          <span className="flex h-7 w-7 items-center justify-center border border-white/[0.08] bg-white/[0.03] text-accent-500 transition-colors group-hover:border-accent-500/40 group-hover:text-accent-400">
            <BrandIsotype size={16} />
          </span>
          <BrandLockup size="sm" />
        </button>

        <div className="flex items-center gap-1">
          <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Navegación principal">
            {NAV_ITEMS.map(({ view, label, icon: Icon }) => {
              const active =
                currentView === view || (view === "home" && (currentView === "ego" || currentView === "external"));
              return (
                <button
                  key={view}
                  type="button"
                  onClick={() => onNavigate(view)}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                  title={label}
                  className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[13px] font-medium transition-colors focus-ring-cinematic ${
                    active
                      ? "bg-white/[0.08] text-white"
                      : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200"
                  }`}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span className="hidden md:inline">{label}</span>
                </button>
              );
            })}
          </nav>

          <span className="mx-1 h-5 w-px bg-white/10" aria-hidden="true" />

          <button
            type="button"
            onClick={toggleTheme}
            title={nextThemeLabel}
            aria-label={nextThemeLabel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/[0.04] hover:text-white focus-ring-cinematic"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {(isAuthenticated || currentView === "admin") && (
            <button
              type="button"
              onClick={() => onNavigate("admin")}
              title="Studio"
              aria-label="Studio"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-ring-cinematic ${
                currentView === "admin"
                  ? "bg-accent-500/20 text-accent-300 border border-accent-500/30"
                  : "text-neutral-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <SlidersHorizontal size={15} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
