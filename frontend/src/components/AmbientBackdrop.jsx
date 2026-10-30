// src/components/AmbientBackdrop.jsx
// Fondo ambiental dinámico de sala de cine: iluminación OLED que florece
// con la paleta de la película activa o focos teatrales sutiles en la pantalla inicial.

const POSTER_BASE = "https://image.tmdb.org/t/p/w780";

/**
 * @param {object} props
 * @param {string|null} [props.posterPath]
 * @param {string} [props.className=""]
 */
export default function AmbientBackdrop({ posterPath, className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-all duration-1000 ${className}`}
    >
      {posterPath ? (
        <>
          {/* Resplandor del afiche desenfocado */}
          <div
            className="absolute -inset-10 bg-cover bg-center opacity-45 filter blur-[80px] scale-125 transition-all duration-1000 ease-out"
            style={{
              backgroundImage: `url(${POSTER_BASE}${posterPath})`,
            }}
          />
          {/* Capa de atmósfera para mantener contraste óptico con calidez */}
          <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-2xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-black/30" />
        </>
      ) : (
        <>
          {/* Atmósfera de sala de proyección: oscuridad sobria con foco sutil de luz cálida de proyector */}
          <div className="absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-500/[0.04] via-amber-900/[0.02] to-transparent blur-[140px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neutral-950/80 to-neutral-950" />
        </>
      )}

      {/* Viñeta sutil de bordes estilo pantalla de proyección */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_30%,_rgba(0,0,0,0.65)_100%)]" />
    </div>
  );
}
