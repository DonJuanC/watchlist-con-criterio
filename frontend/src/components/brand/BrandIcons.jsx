// src/components/brand/BrandIcons.jsx
// Sistema Oficial de Iconografía e Isotipos — Cine con Criterio
// Racional: Retícula base 24x24 px, trazo continuo de 1.5px, esquinas vivas (0px radius).

import React from "react";

/**
 * 1. Isotipo Oficial de «El Selector»: Monograma «C» Anamórfica
 * La contraforma interna reproduce con exactitud la relación de aspecto 2.35:1
 * (pantalla ancha anamórfica de cine) sin apelar a perforaciones de celuloide.
 */
export function BrandIsotype({ size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Cine con Criterio — Isotipo"
    >
      {/* Marco exterior geométrico de la letra C con remates rectos */}
      {/* Dimensiones anamórficas internas: Ventana 16.5px de ancho x 7px de alto (proporción 2.35:1) */}
      <path
        d="M26 6H6V26H26V20H21V21.5H11V10.5H21V12H26V6Z"
        fill="currentColor"
      />
      {/* Micro-mira anamórfica interior */}
      <rect x="13.5" y="14" width="9.4" height="4" stroke="currentColor" strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

/**
 * 2. Logotipo Tipográfico Oficial: [Cine] / [con Criterio]
 * Respeta el eje matemático axial de 15 grados en el slash y la retícula suiza.
 */
export function BrandLockup({ size = "md", stacked = false, responsive = false, className = "" }) {
  if (stacked) {
    return (
      <div className={`flex flex-col font-sans select-none tracking-tight leading-none ${className}`}>
        <span className="font-extrabold text-accent-500 uppercase tracking-wider text-[15px]">
          CINE
        </span>
        <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-200 mt-0.5">
          <span className="text-neutral-500 font-mono -rotate-[15deg] inline-block">/</span>
          <span>con Criterio</span>
        </div>
      </div>
    );
  }

  const textClasses =
    size === "sm"
      ? "text-[14px]"
      : size === "lg"
      ? "text-[20px]"
      : "text-[16px]";

  const hideTagline = responsive ? "hidden sm:inline" : "inline";

  return (
    <div className={`inline-flex items-baseline gap-2 font-sans select-none tracking-tight ${textClasses} ${className}`}>
      <span className="font-bold text-accent-500">Cine</span>
      <span
        className={`${hideTagline} font-mono text-neutral-500 font-light select-none -rotate-[15deg] origin-center text-[0.9em]`}
        aria-hidden="true"
      >
        /
      </span>
      <span className={`${hideTagline} font-medium text-neutral-100 tracking-normal`}>
        con Criterio
      </span>
    </div>
  );
}

/**
 * 3. El Criterio (Rating): Estrella Destello de 4 Puntas (Lens Flare Anamórfico)
 * Sustituye la estrella clásica de 5 puntas de hotel o app genérica por un destello óptico afilado.
 */
export function CriterionStar({ size = 16, className = "", filled = true }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 2L13.8 9.5L21.3 11.3L22 12L21.3 12.7L13.8 14.5L12 22L10.2 14.5L2.7 12.7L2 12L2.7 11.3L10.2 9.5L12 2Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? "0.5" : "1.5"}
        strokeLinejoin="miter"
      />
    </svg>
  );
}

/**
 * 4. La Pluma y el Lente: Sello de Autoría de «El Selector»
 * Plumín de tinta cuya abertura central se desdobla en el contorno de un lente de cámara.
 */
export function PenAndLens({ size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
    >
      {/* Silueta de plumín técnico */}
      <path d="M12 2L19 9L15 22L12 18L9 22L5 9L12 2Z" />
      {/* Contorno de lente en la contraforma de la tinta */}
      <circle cx="12" cy="11" r="3" />
      <line x1="12" y1="2" x2="12" y2="8" />
    </svg>
  );
}

/**
 * 5. El Fotograma: Relación Estricta 2.35:1 (Biblioteca / Catálogo)
 */
export function Framerate235({ size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
    >
      {/* Marco 2.35:1 centrado */}
      <rect x="2" y="7" width="20" height="10" />
      {/* Marcas de encuadre en esquinas */}
      <line x1="2" y1="10" x2="5" y2="10" />
      <line x1="2" y1="14" x2="5" y2="14" />
      <line x1="19" y1="10" x2="22" y2="10" />
      <line x1="19" y1="14" x2="22" y2="14" />
    </svg>
  );
}

/**
 * 6. El Boleto: Ticket Geométrico con Incisiones en 90°
 */
export function TicketCut({ size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
    >
      <path d="M3 5H21V9C19.5 9 19.5 11 19.5 12C19.5 13 19.5 15 21 15V19H3V15C4.5 15 4.5 13 4.5 12C4.5 11 4.5 9 3 9V5Z" />
      <line x1="9" y1="5" x2="9" y2="19" strokeDasharray="2 2" />
    </svg>
  );
}

/**
 * 7. Cruz de Enfoque: Mira Analítica (Explorador / Disección Técnica)
 */
export function FocusCrosshair({ size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
    >
      <rect x="4" y="4" width="16" height="16" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

/**
 * 8. Eslabón Compartido: Enlace Cruzado a Música con Criterio (MCC)
 * Dos rectángulos en diagonal entrelazados (cine y sonido).
 */
export function SharedLink({ size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
    >
      <rect x="3" y="5" width="11" height="8" transform="rotate(-15 3 5)" />
      <rect x="9" y="11" width="11" height="8" transform="rotate(-15 9 11)" />
      <line x1="9" y1="8" x2="15" y2="14" strokeWidth="1.5" />
    </svg>
  );
}
