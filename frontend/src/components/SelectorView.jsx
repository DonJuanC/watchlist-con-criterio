// src/components/SelectorView.jsx
// Página «Quién elige»: presenta a El Selector, por qué existe el archivo,
// cómo califica y el archivo en cifras (calculadas en vivo desde el grafo).
// Los textos viven en src/content/selector.js.

import { useMemo } from "react";
import { ArrowRight, Star } from "lucide-react";
import useCineStore from "../store/useCineStore";
import { SELECTOR } from "../content/selector";

const VERDICT_DOT = {
  1: "bg-emerald-400",
  0: "bg-amber-400",
  "-1": "bg-red-400",
};

function Section({ eyebrow, title, children }) {
  return (
    <section className="flex flex-col gap-4 border-t border-white/[0.08] pt-8">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">{eyebrow}</span>
        <h2 className="font-serif text-2xl sm:text-3xl font-normal text-white text-balance">{title}</h2>
      </div>
      {children}
    </section>
  );
}

// Párrafos del archivo de contenido. Vacío: nada en producción, recordatorio en local.
function Prose({ paragraphs, pendingHint }) {
  if (!paragraphs || paragraphs.length === 0) {
    if (!import.meta.env.DEV) return null;
    return (
      <p className="rounded-xl border border-dashed border-amber-500/40 px-4 py-3 text-sm text-amber-300">
        Pendiente: {pendingHint} (src/content/selector.js)
      </p>
    );
  }
  return (
    <div className="flex max-w-[65ch] flex-col gap-4 text-base leading-relaxed text-neutral-300">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/[0.08] bg-surface/60 px-4 py-4">
      <span className="font-serif text-3xl text-white tabular-nums">{value}</span>
      <span className="text-xs text-neutral-400">{label}</span>
    </div>
  );
}

/**
 * @param {object} props
 * @param {() => void} props.onStart  Lleva a la portada para buscar.
 */
export default function SelectorView({ onStart }) {
  const catalog = useCineStore((s) => s.rawGraph.nodes);

  const stats = useMemo(() => {
    if (catalog.length === 0) return null;
    const years = catalog.map((m) => m.release_year).filter(Boolean);
    return {
      seen: catalog.length,
      directors: new Set(catalog.map((m) => m.director).filter(Boolean)).size,
      span: years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "—",
      recommended: catalog.filter((m) => m.recommend === 1).length,
    };
  }, [catalog]);

  const showOrigin = SELECTOR.origin.length > 0 || import.meta.env.DEV;
  const showBio = SELECTOR.bio.length > 0 || import.meta.env.DEV;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-4 pb-24 pt-10 sm:pt-14">
      {/* Presentación */}
      <header className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        {SELECTOR.portrait ? (
          <img
            src={SELECTOR.portrait}
            alt={`Retrato de ${SELECTOR.name}`}
            className="h-24 w-24 shrink-0 rounded-full object-cover shadow-poster"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-950/40 font-serif text-3xl text-amber-300"
          >
            ES
          </div>
        )}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Quién elige</span>
          <h1 className="font-serif text-4xl sm:text-5xl font-normal tracking-tight text-white">{SELECTOR.name}</h1>
          <p className="text-base text-neutral-300">{SELECTOR.tagline}</p>
        </div>
      </header>

      {showBio && (
        <Section eyebrow="Sobre mí" title="Quién está detrás">
          <Prose paragraphs={SELECTOR.bio} pendingHint="escribe tu bio en el arreglo bio" />
        </Section>
      )}

      {showOrigin && (
        <Section eyebrow="El origen" title="Por qué existe este archivo">
          <Prose paragraphs={SELECTOR.origin} pendingHint="cuenta por qué surge la idea en el arreglo origin" />
        </Section>
      )}

      <Section eyebrow="Mi criterio" title="Cómo califico">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-neutral-200">La nota, de 1 a 5</h3>
            <ul className="flex flex-col gap-2.5">
              {SELECTOR.scale.stars.map(({ value, text }) => (
                <li key={value} className="flex items-start gap-3 text-sm text-neutral-300">
                  <span className="flex shrink-0 gap-0.5 pt-0.5" aria-label={`${value} de 5`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={11}
                        className={i < value ? "fill-amber-400 text-amber-400" : "text-neutral-600"}
                      />
                    ))}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-neutral-200">El veredicto</h3>
            <ul className="flex flex-col gap-2.5">
              {SELECTOR.scale.verdicts.map(({ value, label, text }) => (
                <li key={value} className="flex items-start gap-3 text-sm text-neutral-300">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${VERDICT_DOT[value]}`} aria-hidden="true" />
                  <span>
                    <span className="font-medium text-white">{label}.</span> {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="max-w-[65ch] text-sm text-neutral-400">
          No todas las películas tienen nota o reseña. Las escribo cuando tengo algo que decir, y las que
          recomiendo pesan más cuando el archivo elige vecinas.
        </p>
      </Section>

      <Section eyebrow="El archivo" title="En cifras">
        {stats ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={stats.seen} label="películas vistas" />
            <Stat value={stats.directors} label="directores" />
            <Stat value={stats.span} label="de la más antigua a la más reciente" />
            <Stat value={stats.recommended} label="imprescindibles" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Cargando cifras">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[88px] rounded-xl bg-white/5 animate-shimmer" />
            ))}
          </div>
        )}
      </Section>

      {SELECTOR.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {SELECTOR.links.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-white/30 hover:text-white focus-ring-cinematic"
            >
              {label}
            </a>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onStart}
        className="inline-flex items-center gap-2 self-start rounded-xl bg-white px-5 py-3 text-sm font-medium text-neutral-950 transition-all hover:bg-neutral-200 active:scale-95 focus-ring-cinematic"
      >
        Empieza por una película que te gustó
        <ArrowRight size={15} />
      </button>
    </main>
  );
}
