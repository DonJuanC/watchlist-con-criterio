// src/components/AmbientBackdrop.jsx
// Fondo ambiental dinámico de sala de cine:
// 1. Cono de proyección cenital de 3200K con respiración analógica sutil.
// 2. Malla sutil de coordenadas estelares/celuloide que elimina el vacío negro.
// 3. Foco ambiental interactivo que acompaña al cursor iluminando la sala.

import { useEffect, useState } from "react";

const POSTER_BASE = "https://image.tmdb.org/t/p/w780";

/**
 * @param {object} props
 * @param {string|null} [props.posterPath]
 * @param {string} [props.className=""]
 */
export default function AmbientBackdrop({ posterPath, className = "" }) {
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let frameId = null;
    let targetX = -1000;
    let targetY = -1000;

    const handleMouseMove = (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!isHovered) setIsHovered(true);
      if (!frameId) {
        frameId = requestAnimationFrame(() => {
          setMousePos({ x: targetX, y: targetY });
          frameId = null;
        });
      }
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isHovered]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden select-none transition-all duration-700 ${className}`}
    >
      {/* 1. Malla sutil de coordenadas / polvo estelar (rompe el vacío plano digital) */}
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 75% 65% at 50% 35%, black 20%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 65% at 50% 35%, black 20%, transparent 85%)",
        }}
      />

      {/* 2. Atmósfera de fondo: Póster activo o Haz de proyección cenital */}
      {posterPath ? (
        <>
          {/* Resplandor del afiche desenfocado */}
          <div
            className="absolute -inset-10 bg-cover bg-center opacity-55 filter blur-[90px] scale-125 transition-all duration-1000 ease-out"
            style={{
              backgroundImage: `url(${POSTER_BASE}${posterPath})`,
            }}
          />
          <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-black/30" />
        </>
      ) : (
        <>
          {/* Cono de luz cálida de proyector que ilumina la cabecera */}
          <div
            className="absolute -top-32 left-1/2 h-[550px] w-[900px] -translate-x-1/2 rounded-full blur-[110px] animate-projector-beam"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(245, 158, 11, 0.14) 0%, rgba(217, 119, 6, 0.05) 50%, transparent 80%)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neutral-950/50 to-neutral-950" />
        </>
      )}

      {/* 3. Luz de linterna / Haz de proyector que sigue al cursor (visible pero elegante) */}
      <div
        className="absolute inset-0 transition-opacity duration-300 ease-out"
        style={{
          opacity: isHovered && mousePos.x > 0 ? 1 : 0,
          background: `radial-gradient(550px circle at ${mousePos.x}px ${mousePos.y}px, rgba(245, 158, 11, 0.09) 0%, rgba(245, 158, 11, 0.02) 45%, transparent 75%)`,
        }}
      />

      {/* 4. Viñeta óptica perimetral suave de lente cinematográfica */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 95% 85% at center, transparent 45%, rgba(0, 0, 0, 0.55) 100%)",
        }}
      />
    </div>
  );
}
