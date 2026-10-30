import { useEffect, useState } from "react";

const POSTER_BASE = "https://image.tmdb.org/t/p/w780";

/**
 * @param {object} props
 * @param {string|null} [props.posterPath]
 * @param {string} [props.className=""]
 */
export default function AmbientBackdrop({ posterPath, className = "" }) {
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

  useEffect(() => {
    let frameId = null;
    let targetX = -1000;
    let targetY = -1000;

    const handleMouseMove = (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!frameId) {
        frameId = requestAnimationFrame(() => {
          setMousePos({ x: targetX, y: targetY });
          frameId = null;
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, []);

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
          {/* Atmósfera de sala de proyección: foco de proyector con respiración sutil */}
          <div className="absolute -top-40 left-1/2 h-[650px] w-[850px] rounded-full bg-gradient-to-b from-amber-500/[0.045] via-amber-900/[0.02] to-transparent blur-[140px] animate-projector-beam" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neutral-950/80 to-neutral-950" />
        </>
      )}

      {/* Haz de luz de sala interactivo que acompaña suavemente al cursor */}
      <div
        className="absolute inset-0 transition-opacity duration-700 ease-out"
        style={{
          opacity: mousePos.x > 0 ? 1 : 0,
          background: `radial-gradient(650px circle at ${mousePos.x}px ${mousePos.y}px, rgba(245, 158, 11, 0.038), transparent 70%)`,
        }}
      />

      {/* Viñeta sutil de bordes estilo sala de cine */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_30%,_rgba(0,0,0,0.65)_100%)]" />
    </div>
  );
}
