// src/components/LegalModal.jsx
// Modal informativo con los Términos de Uso, Política de Privacidad (Ley 1581 / RGPD),
// atribución de propiedad intelectual (TMDB, JustWatch, OMDb) y canal de contacto/retirada.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ShieldCheck, FileText, Scale, Mail, ExternalLink } from "lucide-react";

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 */
export default function LegalModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("terms");

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Bloquear scroll de fondo de forma segura
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex flex-col w-full max-w-2xl max-h-[88dvh] sm:max-h-[84vh] my-auto rounded-2xl border border-white/15 bg-[#121215] shadow-2xl overflow-hidden text-neutral-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal (Fija) */}
        <div className="shrink-0 flex items-center justify-between border-b border-white/10 px-5 sm:px-6 py-3.5 sm:py-4 bg-[#121215]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-amber-300">
              <Scale size={16} />
            </div>
            <div>
              <h2 id="legal-modal-title" className="font-serif text-sm sm:text-base font-semibold text-white">
                Marco Legal & Transparencia
              </h2>
              <p className="text-[10px] sm:text-[11px] text-neutral-400">
                Términos, privacidad, licencias y atribución de datos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors focus-ring-cinematic"
          >
            <X size={18} />
          </button>
        </div>

        {/* Pestañas de Navegación Interna (Fijas con scroll horizontal seguro) */}
        <div className="shrink-0 flex overflow-x-auto border-b border-white/10 bg-neutral-950/70 px-4 sm:px-6 gap-2 text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("terms")}
            className={`shrink-0 whitespace-nowrap py-2.5 sm:py-3 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === "terms"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <FileText size={13} />
            Términos de Uso
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("privacy")}
            className={`shrink-0 whitespace-nowrap py-2.5 sm:py-3 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === "privacy"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <ShieldCheck size={13} />
            Privacidad & Datos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ip")}
            className={`shrink-0 whitespace-nowrap py-2.5 sm:py-3 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === "ip"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Scale size={13} />
            Propiedad & Marcas
          </button>
        </div>

        {/* Contenido con Scroll (min-h-0 obligatorio para flexbox) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 sm:py-5 space-y-4 text-xs sm:text-sm leading-relaxed text-neutral-300 overscroll-contain">
          {activeTab === "terms" && (
            <div className="space-y-4">
              <section>
                <h3 className="font-semibold text-white text-sm mb-1">1. Naturaleza del Servicio</h3>
                <p>
                  <strong>Watchlist con Criterio</strong> es un catálogo exploratorio y archivo cinematográfico personal creado por Juan Camilo con fines culturales, educativos y de divulgación cinéfila.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-white text-sm mb-1">2. No Afiliación ni Reproducción</h3>
                <p>
                  Este sitio web <strong>NO aloja, almacena, retransmite ni distribuye películas, archivos de video ni transmisiones de streaming</strong>. Únicamente organiza metadatos públicos de obras cinematográficas y enlaces informativos hacia las plataformas legales oficiales donde están disponibles.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-white text-sm mb-1">3. Criterio y Reseñas</h3>
                <p>
                  Las calificaciones (⭐ 1 a 5), recomendaciones (🔴, 🟡, 🟢) y notas críticas expresadas corresponden exclusivamente al criterio personal del autor sincronizado desde su registro en Notion.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-white text-sm mb-1">4. Disponibilidad</h3>
                <p>
                  El servicio se ofrece gratuitamente y sin garantías de disponibilidad continua o ininterrumpida. La infraestructura utiliza capas gratuitas en la nube sujetas a periodos de suspensión por inactividad.
                </p>
              </section>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="space-y-4">
              <section>
                <h3 className="font-semibold text-white text-sm mb-1">1. Principio de Privacidad por Diseño (Privacy by Design)</h3>
                <p>
                  Este proyecto <strong>no requiere creación de cuentas, no recopila nombres, direcciones de correo ni contraseñas</strong>, y no emplea herramientas de rastreo publicitario de terceros (como píxeles de Meta o cookies publicitarias).
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-white text-sm mb-1">2. Almacenamiento Local (localStorage)</h3>
                <p>
                  En conformidad con la Ley 1581 de 2012 (Colombia) y el RGPD (Unión Europea), informamos que se utilizan únicamente datos estrictamente funcionales guardados de forma local en su navegador:
                </p>
                <ul className="list-disc list-inside mt-1.5 space-y-1 text-neutral-400">
                  <li><code className="text-amber-300/90 font-mono">watchlist.country</code>: Recuerda su selección de país para consultar plataformas de streaming.</li>
                  <li><code className="text-amber-300/90 font-mono">watchlist_selected_providers</code>: Guarda sus plataformas preferidas en la vista <em>«¿Qué veo hoy?»</em>.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-white text-sm mb-1">3. Búsquedas Semánticas y Procesamiento con IA</h3>
                <p>
                  Cuando realiza una búsqueda por sensación (ej. <em>«atmósfera melancólica con giros»</em>), el texto ingresado se procesa de forma efímera a través de la API de Google Gemini (<code className="text-neutral-200 font-mono">gemini-embedding-001</code>) para generar representaciones matemáticas vectoriales. Estas consultas <strong>no se asocian a su identidad personal</strong>.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-white text-sm mb-1">4. Ejercicio de Derechos (ARCO)</h3>
                <p>
                  Para ejercer cualquier derecho de consulta, actualización o rectificación sobre cualquier dato o registro, puede comunicarse directamente con el titular del proyecto a través del canal oficial de contacto.
                </p>
              </section>
            </div>
          )}

          {activeTab === "ip" && (
            <div className="space-y-4">
              <section>
                <h3 className="font-semibold text-white text-sm mb-1">1. Atribución The Movie Database (TMDB)</h3>
                <p>
                  Este producto utiliza la API de TMDB pero no está respaldado ni certificado por TMDB. Todos los afiches, sinopsis, directores, fotógrafos y metadatos de películas se obtienen de acuerdo con sus términos de uso oficiales.
                </p>
                <p className="mt-1 text-[11px] text-neutral-400 italic">
                  “This product uses the TMDB API but is not endorsed or certified by TMDB.”
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-white text-sm mb-1">2. Datos de Streaming (JustWatch)</h3>
                <p>
                  La información de disponibilidad y plataformas de streaming en cada país es provista por <strong>JustWatch</strong> a través de la API de TMDB.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-white text-sm mb-1">3. Puntuaciones de Crítica (OMDb, IMDb, Rotten Tomatoes, Metacritic)</h3>
                <p>
                  Las calificaciones agregadas de la crítica provienen de OMDb API. Los títulos, marcas registradas y logos de IMDb, Rotten Tomatoes y Metacritic pertenecen a sus respectivos propietarios legales.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-white text-sm mb-1">4. Tipografías e Iconos</h3>
                <p>
                  Tipografías: <em>Playfair Display</em> y <em>Plus Jakarta Sans</em> bajo licencia SIL Open Font License 1.1. Iconografía provista por <em>Lucide Icons</em> bajo licencia ISC.
                </p>
              </section>

              <section className="border-t border-white/10 pt-3">
                <h3 className="font-semibold text-amber-300 text-sm mb-1 flex items-center gap-1.5">
                  <Mail size={13} />
                  Canal de Notificación y Retirada (DMCA / Takedown Notice)
                </h3>
                <p>
                  Si usted es titular de derechos de propiedad intelectual de alguna obra, fotografía o texto expuesto en este catálogo y considera que su publicación vulnera sus derechos o desea su retirada inmediata, por favor remita su solicitud a:
                </p>
                <div className="mt-2 p-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-neutral-300 font-mono text-xs">
                  Contacto de Propiedad Intelectual & Privacidad:<br />
                  <a
                    href="https://github.com/DonJuanC/watchlist-con-criterio/issues"
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 underline hover:text-amber-300 inline-flex items-center gap-1 mt-1"
                  >
                    github.com/DonJuanC/watchlist-con-criterio <ExternalLink size={11} />
                  </a>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Pie del Modal (Fijo con botón claro) */}
        <div className="shrink-0 border-t border-white/10 px-5 sm:px-6 py-3 bg-neutral-950/80 flex items-center justify-between text-[11px] text-neutral-400">
          <span>Watchlist con Criterio · 2026</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md border border-white/15 bg-white/5 text-xs font-medium text-white hover:bg-white/10 transition-colors focus-ring-cinematic"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
