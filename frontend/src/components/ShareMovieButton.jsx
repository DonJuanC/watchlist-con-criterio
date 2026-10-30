// src/components/ShareMovieButton.jsx
// Botón para compartir o copiar el enlace directo de una película (#/movie/:id)
// con feedback visual táctil y notificación flotante (Toast).

import { useState } from "react";
import { Share2, Check } from "lucide-react";

/**
 * @param {object} props
 * @param {{ id: number, title: string }} props.movie
 * @param {string} [props.className=""]
 * @param {boolean} [props.showToast=true]
 */
export default function ShareMovieButton({
  movie,
  className = "",
  showToast = true,
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = async (e) => {
    e.stopPropagation();
    const origin = window.location.origin;
    const shareUrl = `${origin}${window.location.pathname}#/movie/${movie.id}`;

    // Web Share API nativa si el dispositivo la soporta (móviles/tablets)
    if (
      navigator.share &&
      /mobile|android|iphone|ipad/i.test(navigator.userAgent)
    ) {
      try {
        await navigator.share({
          title: `${movie.title} · Watchlist con Criterio`,
          text: `Mira ${movie.title} y sus conexiones cinematográficas:`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }

    // Copiar al portapapeles
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement("input");
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        aria-label={`Compartir enlace de ${movie.title}`}
        title="Compartir o copiar enlace directo"
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-all duration-200 active:scale-95 shrink-0 ${
          copied
            ? "border-emerald-500/50 bg-emerald-950/70 text-emerald-300 shadow-md"
            : "border-white/15 bg-white/5 text-neutral-300 hover:border-white/30 hover:bg-white/10 hover:text-white"
        } ${className}`}
      >
        {copied ? (
          <>
            <Check size={13} className="text-emerald-400" />
            <span className="font-semibold text-emerald-300">¡Copiado!</span>
          </>
        ) : (
          <>
            <Share2 size={13} className="text-neutral-400 group-hover:text-white" />
            <span>Compartir</span>
          </>
        )}
      </button>

      {/* Notificación flotante (Toast) */}
      {showToast && copied && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full border border-emerald-500/40 bg-emerald-950/90 px-4 py-2.5 text-xs font-medium text-emerald-200 shadow-2xl backdrop-blur-xl animate-in fade-in duration-200"
        >
          <Check size={14} className="text-emerald-400 shrink-0" />
          <span>Enlace de “{movie.title}” copiado al portapapeles</span>
        </div>
      )}
    </>
  );
}
