// src/components/HowItWorksView.jsx
// Página «Cómo funciona»: explicación técnica y cinematográfica del archivo.
// Detalla cómo opera el grafo de afinidad, los embeddings semánticos y la curaduría humana,
// e incluye la demostración interactiva de conexiones.

import { ArrowLeft, Compass, Cpu, Film, GitFork, Sparkles, Star } from "lucide-react";
import ConnectionDemo from "./landing/ConnectionDemo";

function TechCard({ icon: Icon, title, description, code }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-surface/60 p-5 inner-bevel-subtle">
      <div className="flex items-center gap-2.5 text-accent-400">
        <Icon size={18} />
        <h3 className="font-serif text-lg font-medium text-white">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-neutral-300">{description}</p>
      {code && (
        <div className="rounded-lg border border-white/[0.06] bg-black/40 px-3 py-2 font-mono text-[11px] text-neutral-400">
          {code}
        </div>
      )}
    </div>
  );
}

/**
 * @param {object} props
 * @param {() => void} props.onStart  Lleva a la portada para buscar.
 * @param {(id: number) => void} props.onPick
 */
export default function HowItWorksView({ onStart, onPick }) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 pb-24 pt-8 sm:pt-12 text-left">
      {/* Botón volver */}
      <nav>
        <button
          type="button"
          onClick={onStart}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-neutral-300 backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/10 hover:text-white focus-ring-cinematic"
        >
          <ArrowLeft size={14} />
          Volver a explorar
        </button>
      </nav>

      {/* Encabezado editorial */}
      <header className="flex flex-col gap-4 border-b border-white/[0.08] pb-8">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent-400 font-mono">
          Metodología & Arquitectura
        </span>
        <h1 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-white leading-tight">
          Cómo se conecta el cine con criterio
        </h1>
        <p className="max-w-2xl text-base sm:text-lg text-neutral-300 leading-relaxed">
          En lugar de algoritmos comerciales diseñados para maximizar tiempo de pantalla,
          este archivo mapea afinidades reales entre obras: atmósfera, autoría, ritmo y dilemas compartidos.
        </p>
      </header>

      {/* Pilares técnicos */}
      <section className="flex flex-col gap-6" aria-label="Principios técnicos">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-400">
            Los fundamentos
          </span>
          <h2 className="font-serif text-2xl font-normal text-white">
            Tres capas de conexión
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <TechCard
            icon={Cpu}
            title="1. Embeddings de 768 dimensiones"
            description="Cada película se sintetiza en un vector matemático que captura no solo palabras clave, sino tono, época, tensión y dilemas morales."
            code="gemini-embedding-001 (768d)"
          />
          <TechCard
            icon={GitFork}
            title="2. Similitud Coseno (k-NN)"
            description="La distancia entre dos vectores mide su afinidad de atmósfera. Si supera el umbral de similitud (≥ 0.65), se tiende un puente en el grafo."
            code="1 - (embedding <=> $1::vector)"
          />
          <TechCard
            icon={Film}
            title="3. Autoría y Mirada Compartida"
            description="Las obras de un mismo realizador forman enlaces de autoría inmediatos, revelando la evolución y constantes de su filmografía."
            code="type: 'same_director'"
          />
        </div>
      </section>

      {/* Demostración interactiva incrustada */}
      <section className="flex flex-col gap-4 border-t border-white/[0.08] pt-8" aria-label="Demostración interactiva">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-400">
            En la práctica
          </span>
          <h2 className="font-serif text-2xl font-normal text-white">
            Una película en el centro de su constelación
          </h2>
          <p className="text-sm text-neutral-400 max-w-xl">
            Toca cualquiera de las películas vecinas para viajar a través del grafo.
          </p>
        </div>

        <ConnectionDemo onPick={onPick} />
      </section>

      {/* Criterio personal */}
      <section className="flex flex-col gap-4 border-t border-white/[0.08] pt-8" aria-label="Criterio personal">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-400">
            La capa humana
          </span>
          <h2 className="font-serif text-2xl font-normal text-white">
            El algoritmo propone, el criterio dispone
          </h2>
        </div>

        <p className="max-w-2xl text-base text-neutral-300 leading-relaxed">
          Los vectores encuentran patrones matemáticos entre sinopsis y temáticas, pero la selección final
          del catálogo es 100% humana. Cada película ha sido vista y valorada con:
        </p>

        <div className="grid gap-3 sm:grid-cols-3 pt-2">
          <div className="rounded-xl border border-white/[0.06] bg-surface/40 p-4">
            <span className="flex items-center gap-1.5 text-accent-400 text-sm font-medium">
              <Star size={14} className="fill-accent-400" /> 1 a 5 Estrellas
            </span>
            <p className="mt-1.5 text-xs text-neutral-400">
              Calificación sintética del impacto y ejecución de la obra.
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-surface/40 p-4">
            <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Veredicto Directo
            </span>
            <p className="mt-1.5 text-xs text-neutral-400">
              Imprescindible, Interesante o Prescindible. Sin rodeos.
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-surface/40 p-4">
            <span className="flex items-center gap-1.5 text-neutral-200 text-sm font-medium">
              <Sparkles size={14} className="text-accent-400" /> Reseña Personal
            </span>
            <p className="mt-1.5 text-xs text-neutral-400">
              Un apunte breve y honesto sobre por qué verla (o no).
            </p>
          </div>
        </div>
      </section>

      {/* Botón final */}
      <footer className="mt-6 flex justify-center border-t border-white/[0.08] pt-8">
        <button
          type="button"
          onClick={onStart}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-medium text-white transition-all hover:border-white/40 hover:bg-white/20 active:scale-95 focus-ring-cinematic"
        >
          <Compass size={16} />
          Explorar el catálogo
        </button>
      </footer>
    </main>
  );
}
