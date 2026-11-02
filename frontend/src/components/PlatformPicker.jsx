// src/components/PlatformPicker.jsx
// "¿Qué plataformas tienes?": las más populares del país del visitante (JustWatch vía TMDB),
// con "Ver todas" para el resto. La elección se guarda por país y la usan la ficha y
// "¿Qué veo hoy?". Las elegidas fuera del top se muestran siempre.

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import useCountry, { useMyPlatforms } from "../hooks/useCountry";
import useRegionPlatforms from "../hooks/useRegionPlatforms";
import { countryName } from "../lib/countries";
import { LOGO_BASE } from "../lib/platforms";

const TOP = 8;

/** @param {{ top?: number }} props */
export default function PlatformPicker({ top = TOP }) {
  const country = useCountry((s) => s.country);
  const togglePlatform = useCountry((s) => s.togglePlatform);
  const mine = useMyPlatforms();
  const { status, platforms } = useRegionPlatforms(country);
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(() => {
    if (expanded) return platforms;
    const head = platforms.slice(0, top);
    const extra = platforms.slice(top).filter((p) => mine.includes(p.key));
    return [...head, ...extra];
  }, [platforms, expanded, top, mine]);

  if (status === "loading") {
    return (
      <div className="flex flex-wrap gap-1.5" aria-label="Cargando plataformas">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="h-7 w-24 rounded-full bg-white/[0.06] animate-shimmer" />
        ))}
      </div>
    );
  }

  if (status === "error" || !platforms.length) {
    return (
      <p className="text-xs text-neutral-400">
        No pude cargar las plataformas de {countryName(country)} ahora mismo.
      </p>
    );
  }

  const hidden = platforms.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Mis plataformas">
      {visible.map((p) => {
        const on = mine.includes(p.key);
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => togglePlatform(p.key)}
            aria-pressed={on}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all active:scale-95 focus-ring-cinematic ${
              on
                ? "border-emerald-500/60 bg-emerald-950/80 text-emerald-200"
                : "border-white/10 bg-white/[0.04] text-neutral-300 hover:border-white/20 hover:text-white"
            }`}
          >
            {p.logo_path && (
              <img src={`${LOGO_BASE}${p.logo_path}`} alt="" loading="lazy" className="h-4 w-4 rounded" />
            )}
            <span>{p.name}</span>
            {on && <Check size={11} className="shrink-0 text-emerald-400" aria-hidden="true" />}
          </button>
        );
      })}
      {(hidden > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-full px-2 py-1 text-[11px] text-neutral-400 underline-offset-2 hover:text-white hover:underline focus-ring-cinematic"
        >
          {expanded ? "Ver menos" : `Ver todas (${platforms.length})`}
        </button>
      )}
    </div>
  );
}
