// frontend/src/components/admin/AdminCurateTab.jsx
// CINE-11: Pestaña para buscar películas en TMDB y curar con estado, criterio y sync a Notion.

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Sparkles,
  Star,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  Film,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { createAdminMovie } from "../../services/adminApi";
import useAdminStore from "../../store/useAdminStore";

const RECOMMENDATIONS = [
  { value: 1, label: "Sí sin dudarlo", icon: "🟢", color: "hover:border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-300" },
  { value: 0, label: "Sí con reservas", icon: "🟡", color: "hover:border-amber-500/50 hover:bg-amber-500/10 text-amber-300" },
  { value: -1, label: "No realmente", icon: "🔴", color: "hover:border-rose-500/50 hover:bg-rose-500/10 text-rose-300" },
];

export default function AdminCurateTab({ onNavigateToMovie }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Película seleccionada para curar
  const [selectedMovie, setSelectedMovie] = useState(null);

  // Formulario de curaduría
  const [status, setStatus] = useState("seen"); // "seen" | "pending"
  const [rating, setRating] = useState(null); // 1 a 5
  const [recommend, setRecommend] = useState(null); // 1, 0, -1
  const [review, setReview] = useState("");
  const [syncToNotion, setSyncToNotion] = useState(true);

  // Estado de envío
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  const debounceTimerRef = useRef(null);
  const loadAdminMovies = useAdminStore((s) => s.loadAdminMovies);

  // Búsqueda TMDB con debounce
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/movies/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (res.ok) {
          setSearchResults(data.results || []);
        } else {
          setSearchError(data.error || "No se pudo buscar en TMDB");
        }
      } catch {
        setSearchError("Error de conexión al buscar películas.");
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(debounceTimerRef.current);
  }, [searchQuery]);

  const handleSelectMovie = (m) => {
    setSelectedMovie(m);
    setSubmitError(null);
    setSubmitSuccess(null);
    // Valores por defecto
    setStatus(m.in_catalog?.status || "seen");
    setRating(null);
    setRecommend(null);
    setReview("");
  };

  const handleResetForm = () => {
    setSelectedMovie(null);
    setSubmitError(null);
    setSubmitSuccess(null);
    setReview("");
    setRating(null);
    setRecommend(null);
    setStatus("seen");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMovie) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const res = await createAdminMovie({
        tmdb_id: selectedMovie.tmdb_id,
        status,
        rating,
        recommend,
        review: review.trim() || null,
        syncToNotion,
      });

      setSubmitSuccess({
        message: res.message || "Película guardada con éxito.",
        movie: res.movie,
        warning: res.warning,
      });

      loadAdminMovies();
    } catch (err) {
      setSubmitError(err.data?.error || err.message || "Error al guardar la película.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div>
        <h3 className="font-serif text-xl font-bold text-white flex items-center gap-2">
          <Sparkles size={20} className="text-amber-400" />
          <span>Curar Nueva Película</span>
        </h3>
        <p className="mt-1 text-xs text-neutral-400">
          Busca cualquier título en TMDB, asigna tu criterio personal y sincroniza automáticamente con Notion y Neon.
        </p>
      </div>

      {/* Barra de Búsqueda TMDB */}
      <div className="relative">
        <label htmlFor="tmdb-search-input" className="block text-xs font-medium text-neutral-300 mb-1.5">
          Buscar en TMDB (título original o en español)
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-400">
            {isSearching ? <Loader2 size={16} className="animate-spin text-amber-400" /> : <Search size={16} />}
          </div>
          <input
            id="tmdb-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ej: Oppenheimer, La ciénaga, Perfect Days..."
            className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-500 transition-all focus:border-amber-400/80 focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-amber-400/80"
          />
        </div>

        {searchError && (
          <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1">
            <AlertCircle size={13} /> {searchError}
          </p>
        )}

        {/* Resultados de búsqueda flotantes o en lista */}
        {searchResults.length > 0 && !selectedMovie && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {searchResults.map((m) => {
              const inCat = Boolean(m.in_catalog);
              return (
                <div
                  key={m.tmdb_id}
                  onClick={() => handleSelectMovie(m)}
                  className="group flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 transition-all hover:border-amber-400/40 hover:bg-white/[0.07]"
                >
                  {m.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w92${m.poster_path}`}
                      alt={m.title}
                      className="h-18 w-12 shrink-0 rounded-md object-cover shadow"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-18 w-12 shrink-0 items-center justify-center rounded-md bg-white/5 text-neutral-500">
                      <Film size={20} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                        {m.title}
                      </h4>
                      {m.release_year && (
                        <span className="text-[11px] text-neutral-400">({m.release_year})</span>
                      )}
                    </div>

                    {m.director && (
                      <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                        Dir. {m.director}
                      </p>
                    )}

                    {inCat ? (
                      <span className="mt-2 inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                        <CheckCircle2 size={10} /> En catálogo ({m.in_catalog.status === "seen" ? "Visto" : "Pendiente"})
                      </span>
                    ) : (
                      <span className="mt-2 inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-400 group-hover:text-white">
                        + Curar esta obra
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Formulario de Curaduría para la película seleccionada */}
      {selectedMovie && (
        <div className="rounded-2xl border border-white/15 bg-white/[0.02] p-5 sm:p-7 backdrop-blur-md">
          {/* Ficha preliminar */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4 pb-6 border-b border-white/10">
            <div className="flex items-start gap-4">
              {selectedMovie.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w185${selectedMovie.poster_path}`}
                  alt={selectedMovie.title}
                  className="h-28 w-20 shrink-0 rounded-lg object-cover shadow-xl border border-white/10"
                />
              ) : (
                <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-lg bg-white/5 text-neutral-500">
                  <Film size={28} />
                </div>
              )}
              <div>
                <h4 className="font-serif text-lg font-bold text-white">
                  {selectedMovie.title} {selectedMovie.release_year && <span className="font-sans font-normal text-neutral-400">({selectedMovie.release_year})</span>}
                </h4>
                {selectedMovie.director && (
                  <p className="text-xs text-neutral-300 mt-0.5">Director: <span className="font-medium text-white">{selectedMovie.director}</span></p>
                )}
                <p className="text-[11px] text-neutral-400 line-clamp-2 mt-1 max-w-xl">
                  {selectedMovie.overview}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetForm}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-neutral-400 hover:text-white hover:border-white/20 transition-colors"
            >
              <RotateCcw size={13} />
              <span>Cambiar película</span>
            </button>
          </div>

          {/* Formulario de Criterio */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {/* 1. Selector de Estado: Visto vs Pendiente */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                1. Estado en tu catálogo
              </label>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => setStatus("seen")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all ${
                    status === "seen"
                      ? "border-amber-400 bg-amber-500/15 text-amber-200 shadow-md"
                      : "border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <CheckCircle2 size={16} className={status === "seen" ? "text-amber-400" : "text-neutral-500"} />
                  <span>Visto ✅ (Entra al grafo)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus("pending")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all ${
                    status === "pending"
                      ? "border-sky-400 bg-sky-500/15 text-sky-200 shadow-md"
                      : "border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <Clock size={16} className={status === "pending" ? "text-sky-400" : "text-neutral-500"} />
                  <span>Pendiente 📌 (Mi lista)</span>
                </button>
              </div>
            </div>

            {/* 2. Calificación (⭐ 1 a 5) */}
            <div>
              <div className="flex items-center justify-between max-w-md mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  2. Calificación
                </label>
                {rating && (
                  <button
                    type="button"
                    onClick={() => setRating(null)}
                    className="text-[11px] text-neutral-400 hover:text-rose-300 underline"
                  >
                    Borrar calificación
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = rating && star <= rating;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      aria-label={`${star} estrellas`}
                      className="group p-1 transition-transform hover:scale-125 focus:outline-none"
                    >
                      <Star
                        size={26}
                        className={`transition-colors ${
                          filled
                            ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                            : "text-neutral-600 group-hover:text-amber-400/50"
                        }`}
                      />
                    </button>
                  );
                })}
                <span className="ml-3 text-xs font-serif text-neutral-300">
                  {rating ? `${rating} de 5 estrellas` : "Sin calificar"}
                </span>
              </div>
            </div>

            {/* 3. ¿Recomendarías? (🟢 🟡 🔴) */}
            <div>
              <div className="flex items-center justify-between max-w-md mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  3. ¿La recomendarías?
                </label>
                {recommend !== null && (
                  <button
                    type="button"
                    onClick={() => setRecommend(null)}
                    className="text-[11px] text-neutral-400 hover:text-rose-300 underline"
                  >
                    Quitar veredicto
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2.5">
                {RECOMMENDATIONS.map((r) => {
                  const isSelected = recommend === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRecommend(isSelected ? null : r.value)}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all ${
                        isSelected
                          ? "border-white/40 bg-white/10 text-white shadow"
                          : `border-white/10 bg-white/[0.02] text-neutral-400 ${r.color}`
                      }`}
                    >
                      <span>{r.icon}</span>
                      <span>{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Reseña Personal (Mi Criterio) */}
            <div>
              <label htmlFor="review-text" className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                4. Tu Reseña / Criterio Personal
              </label>
              <textarea
                id="review-text"
                rows={4}
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Escribe tu opinión sincera, sensaciones, ritmo, fotografía o por qué te marcó. Esta reseña se integrará al embedding de Gemini y se sincronizará a Notion..."
                className="w-full rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white placeholder-neutral-500 transition-all focus:border-amber-400/80 focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-amber-400/80"
              />
              <p className="mt-1 text-[11px] text-neutral-500">
                {review.length} caracteres • Al guardar una película vista, se enriquecerá el cálculo semántico con tus palabras.
              </p>
            </div>

            {/* 5. Switch de Sincronización a Notion */}
            <div className="flex items-center gap-3 pt-2">
              <input
                id="sync-notion-checkbox"
                type="checkbox"
                checked={syncToNotion}
                onChange={(e) => setSyncToNotion(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-400"
              />
              <label htmlFor="sync-notion-checkbox" className="text-xs text-neutral-300 cursor-pointer">
                Sincronizar inmediatamente con tu base de Notion (<span className="text-neutral-400">crear fila con propiedades y match OK</span>)
              </label>
            </div>

            {/* Mensajes de error o éxito */}
            {submitError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-200">
                <AlertCircle size={16} className="shrink-0 text-rose-400 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {submitSuccess && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-xs text-emerald-200 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span className="font-medium">{submitSuccess.message}</span>
                </div>
                {submitSuccess.warning && (
                  <p className="text-[11px] text-amber-300">⚠️ {submitSuccess.warning}</p>
                )}
                {submitSuccess.movie?.id && (
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onNavigateToMovie(submitSuccess.movie.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30 transition-colors"
                    >
                      <ExternalLink size={13} />
                      <span>Ver en el grafo de conexiones</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetForm}
                      className="text-neutral-400 hover:text-white underline text-xs"
                    >
                      Curar otra obra
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Botón de Enviar */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-600 to-amber-500 py-3 px-6 text-sm font-semibold text-neutral-950 shadow-xl shadow-amber-950/50 transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Guardando y sincronizando con Notion...</span>
                  </>
                ) : (
                  <span>Guardar en Catálogo y Notion</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
