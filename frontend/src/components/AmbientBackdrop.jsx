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
          {/* Foco cinematográfico cenital (Teal & Indigo & Amber) */}
          <div className="absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-gradient-to-b from-cyan-600/18 via-indigo-600/12 to-transparent blur-[110px]" />
          <div className="absolute top-1/3 -left-20 h-[400px] w-[500px] rounded-full bg-indigo-900/15 blur-[120px]" />
          <div className="absolute bottom-10 right-0 h-[450px] w-[550px] rounded-full bg-amber-700/10 blur-[130px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neutral-950/50 to-neutral-950" />
        </>
      )}

      {/* Viñeta sutil de bordes estilo pantalla de proyección */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_30%,_rgba(0,0,0,0.65)_100%)]" />
    </div>
  );
}
