// src/components/OnboardingHint.jsx
// Onboarding y acceso permanente a la guía interactiva y el tour cinemático del mapa.
// Si no se ha cerrado, muestra una tarjeta de bienvenida invitando al tour;
// una vez cerrada, conserva una píldora compacta en la esquina superior para reabrirla.

import { useState } from "react";
import { Sparkles, X } from "lucide-react";

/**
 * @param {object} props
 * @param {() => void} props.onStartTour
 * @param {() => void} props.onOpenGuide
 */
export default function OnboardingHint({ onStartTour, onOpenGuide }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("cine-onboarding-dismissed") === "1";
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("cine-onboarding-dismissed", "1");
    } catch {
      // sessionStorage puede no estar disponible
    }
  };

  // Estado minimizado: píldora discreta fija en la esquina superior
  if (dismissed) {
    return (
      <div className="fixed top-18 right-3 sm:top-20 sm:right-6 z-20 animate-view-enter">
        <button
          type="button"
          onClick={onStartTour}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-neutral-900/85 px-3.5 py-1.5 text-xs font-medium text-neutral-300 shadow-xl backdrop-blur-md transition-all hover:border-accent-400 hover:bg-neutral-900 hover:text-white focus-ring-cinematic"
          title="Cómo funciona este mapa (Tour y guía)"
        >
          <Sparkles size={13} className="text-accent-400" />
          <span>Guía del mapa</span>
        </button>
      </div>
    );
  }

  // Estado inicial: tarjeta de bienvenida invitando al tour cinemático
  return (
    <div className="fixed bottom-[4.5rem] left-3 right-16 z-20 sm:bottom-auto sm:left-6 sm:right-auto sm:top-20 sm:max-w-sm rounded-2xl border border-accent-500/30 bg-neutral-900/95 p-4 text-xs leading-relaxed text-neutral-300 shadow-2xl backdrop-blur-xl animate-view-enter">
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Cerrar sugerencia"
        className="absolute right-2.5 top-2.5 rounded-full p-1 text-neutral-400 hover:bg-white/10 hover:text-white focus-ring-cinematic"
      >
        <X size={14} />
      </button>

      <div className="flex items-center gap-2 text-accent-300 font-mono text-[11px] uppercase tracking-[0.14em] mb-1">
        <Sparkles size={13} className="text-accent-400" />
        <span>El Cosmos de Cine</span>
      </div>

      <p className="pr-4 text-neutral-300 text-xs">
        Las películas cercanas comparten atmósfera y autoría. Descubre cómo interpretar las líneas y distancias.
      </p>

      <div className="mt-3 flex items-center gap-2 pt-1 border-t border-white/[0.06]">
        <button
          type="button"
          onClick={() => {
            handleDismiss();
            if (onStartTour) onStartTour();
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-accent-400/50 bg-accent-500/20 px-3.5 py-1.5 text-[11px] font-medium text-white hover:bg-accent-500/30 transition-all focus-ring-cinematic"
        >
          <Sparkles size={12} className="text-accent-300" />
          <span>Iniciar tour (1 min)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            handleDismiss();
            if (onOpenGuide) onOpenGuide();
          }}
          className="text-[11px] font-mono text-neutral-400 hover:text-white transition-colors underline decoration-white/20 underline-offset-2 ml-1"
        >
          Leer guía
        </button>
      </div>
    </div>
  );
}
