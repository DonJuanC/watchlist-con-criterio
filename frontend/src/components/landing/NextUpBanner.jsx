// src/components/landing/NextUpBanner.jsx
// Entrada a "¿Qué veo hoy?" desde el inicio: las plataformas más populares del país del
// visitante (en gris; a color las suyas). Tocarlas las marca como "mis plataformas" (el mismo
// estado de la ficha y de "¿Qué veo hoy?"), y el botón abre la lista ya filtrada por ellas.

import { Check, Popcorn } from "lucide-react";
import useCountry, { useMyPlatforms } from "../../hooks/useCountry";
import useRegionPlatforms from "../../hooks/useRegionPlatforms";
import { countryName } from "../../lib/countries";
import { LOGO_BASE } from "../../lib/platforms";
import CountrySelect from "../CountrySelect";

const TOP = 6;

function joinNames(names) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/** @param {{ onOpen: () => void }} props */
export default function NextUpBanner({ onOpen }) {
  const country = useCountry((s) => s.country);
  const togglePlatform = useCountry((s) => s.togglePlatform);
  const mine = useMyPlatforms();
  const { status, platforms } = useRegionPlatforms(country);

  // Las más populares, más las que el visitante ya eligió aunque estén más abajo.
  const shown = [
    ...platforms.slice(0, TOP),
    ...platforms.slice(TOP).filter((p) => mine.includes(p.key)),
  ];
  const mineNames = mine.map((k) => platforms.find((p) => p.key === k)?.name ?? k);

  return (
    <section className="mt-14 w-full" aria-label="¿Qué veo hoy?">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-surface/60 px-5 py-5 text-left sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-serif text-xl text-white">¿Sin una película en mente?</h3>
            <p className="mt-1 text-sm text-neutral-400">
              {mine.length
                ? `Te digo qué ver hoy en ${joinNames(mineNames)}.`
                : `Toca las plataformas que tienes y te digo qué ver hoy en ${countryName(country)}.`}
            </p>
          </div>
          <CountrySelect />
        </div>

        <div
          role="group"
          aria-label="Mis plataformas"
          className="-mx-5 flex flex-nowrap items-center gap-2.5 overflow-x-auto px-5 pb-1.5 pt-1.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          {status === "loading" &&
            Array.from({ length: TOP }).map((_, i) => (
              <span key={i} className="h-11 w-11 shrink-0 rounded-xl bg-white/[0.06] animate-shimmer" />
            ))}
          {shown.map((p) => {
            const on = mine.includes(p.key);
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => togglePlatform(p.key)}
                aria-pressed={on}
                aria-label={p.name}
                title={p.name}
                className={`relative h-11 w-11 shrink-0 rounded-xl transition-all active:scale-95 focus-ring-cinematic ${
                  on ? "ring-2 ring-emerald-400" : "opacity-60 grayscale hover:opacity-100 hover:grayscale-0"
                }`}
              >
                {p.logo_path ? (
                  <img
                    src={`${LOGO_BASE.replace("w45", "w92")}${p.logo_path}`}
                    alt=""
                    loading="lazy"
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <span className="text-[10px] text-neutral-300">{p.name}</span>
                )}
                {on && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-neutral-950">
                    <Check size={10} strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-accent-400 px-4 py-2.5 text-sm font-medium text-neutral-950 transition-all hover:bg-accent-300 active:scale-95 focus-ring-cinematic"
        >
          <Popcorn size={15} />
          ¿Qué veo hoy?
        </button>
      </div>
    </section>
  );
}
