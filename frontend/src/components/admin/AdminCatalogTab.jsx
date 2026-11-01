// frontend/src/components/admin/AdminCatalogTab.jsx
// CINE-11: Pestaña para gestionar, editar y archivar películas del catálogo.

import { useState } from "react";
import {
  Search,
  CheckCircle2,
  Clock,
  Star,
  Edit3,
  Trash2,
  ExternalLink,
  Loader2,
  AlertTriangle,
  RotateCw,
  Film,
} from "lucide-react";
import useAdminStore from "../../store/useAdminStore";
import { updateAdminMovie, deleteAdminMovie } from "../../services/adminApi";

const RECOMMEND_ICONS = {
  1: { icon: "🟢", label: "Recomendada" },
  0: { icon: "🟡", label: "Con reservas" },
  "-1": { icon: "🔴", label: "No realmente" },
};

export default function AdminCatalogTab({ onNavigateToMovie }) {
  const adminMovies = useAdminStore((s) => s.adminMovies);
  const totalAdminMovies = useAdminStore((s) => s.totalAdminMovies);
  const isLoadingMovies = useAdminStore((s) => s.isLoadingMovies);
  const movieFilterStatus = useAdminStore((s) => s.movieFilterStatus);
  const setMovieFilterStatus = useAdminStore((s) => s.setMovieFilterStatus);
  const movieSearchQuery = useAdminStore((s) => s.movieSearchQuery);
  const setMovieSearchQuery = useAdminStore((s) => s.setMovieSearchQuery);
  const loadAdminMovies = useAdminStore((s) => s.loadAdminMovies);

  // Modal de edición rápida
  const [editingMovie, setEditingMovie] = useState(null);
  const [editStatus, setEditStatus] = useState("seen");
  const [editRating, setEditRating] = useState(null);
  const [editRecommend, setEditRecommend] = useState(null);
  const [editReview, setEditReview] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);

  // Modal de confirmación de eliminación
  const [deletingMovie, setDeletingMovie] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleOpenEdit = (m) => {
    setEditingMovie(m);
    setEditStatus(m.status || "seen");
    setEditRating(m.rating || null);
    setEditRecommend(m.recommend !== undefined ? m.recommend : null);
    setEditReview(m.review || "");
    setUpdateError(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingMovie) return;

    setIsUpdating(true);
    setUpdateError(null);

    try {
      await updateAdminMovie(editingMovie.id, {
        status: editStatus,
        rating: editRating,
        recommend: editRecommend,
        review: editReview.trim() || null,
        syncToNotion: true,
      });

      setEditingMovie(null);
      loadAdminMovies();
    } catch (err) {
      setUpdateError(err.data?.error || err.message || "Error al actualizar la película.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingMovie) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteAdminMovie(deletingMovie.id, { archive: true });
      setDeletingMovie(null);
      loadAdminMovies();
    } catch (err) {
      setDeleteError(err.data?.error || err.message || "Error al eliminar la película.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Barra de Filtros */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold text-white flex items-center gap-2">
            <span>Catálogo Activo</span>
            <span className="text-xs font-sans font-medium text-neutral-400">
              ({totalAdminMovies} películas registradas)
            </span>
          </h3>
          <p className="mt-0.5 text-xs text-neutral-400">
            Administra estados, edita tus reseñas y sincroniza cambios inmediatamente con Notion.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadAdminMovies()}
          disabled={isLoadingMovies}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 hover:text-white hover:border-white/20 transition-all"
        >
          <RotateCw size={13} className={isLoadingMovies ? "animate-spin" : ""} />
          <span>Actualizar lista</span>
        </button>
      </div>

      {/* Filtros y Buscador */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Buscador */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
            <Search size={15} />
          </div>
          <input
            type="text"
            value={movieSearchQuery}
            onChange={(e) => setMovieSearchQuery(e.target.value)}
            placeholder="Filtrar por título, director o palabras en tu reseña..."
            className="w-full rounded-xl border border-white/15 bg-white/5 py-2 pl-9 pr-3 text-xs text-white placeholder-neutral-500 transition-all focus:border-amber-400/80 focus:bg-white/[0.08] focus:outline-none"
          />
        </div>

        {/* Chips de estado */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "Todas" },
            { id: "seen", label: "Vistas ✅" },
            { id: "pending", label: "Pendientes 📌" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMovieFilterStatus(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                movieFilterStatus === tab.id
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-white/5 text-neutral-400 border border-white/10 hover:text-white hover:border-white/20"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Películas */}
      {isLoadingMovies ? (
        <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
          <Loader2 size={24} className="animate-spin text-amber-400 mb-2" />
          <p className="text-xs">Cargando catálogo...</p>
        </div>
      ) : adminMovies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-neutral-400">
          <Film size={28} className="mx-auto mb-2 text-neutral-600" />
          <p className="text-xs font-medium">No se encontraron películas con estos filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {adminMovies.map((m) => {
            const hasReview = Boolean(m.review);
            const isSeen = m.status === "seen";
            const rec = m.recommend !== null ? RECOMMEND_ICONS[m.recommend] : null;

            return (
              <div
                key={m.id}
                className="group flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3.5 transition-all hover:border-white/25 hover:bg-white/[0.04]"
              >
                <div className="flex items-start gap-3">
                  {m.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w92${m.poster_path}`}
                      alt={m.title}
                      className="h-22 w-15 shrink-0 rounded-md object-cover shadow"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-22 w-15 shrink-0 items-center justify-center rounded-md bg-white/5 text-neutral-500">
                      <Film size={20} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold text-white line-clamp-1">
                        {m.display_title || m.title}
                      </h4>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isSeen
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            : "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                        }`}
                      >
                        {isSeen ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                        {isSeen ? "Visto" : "Pendiente"}
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      {m.release_year && <span>{m.release_year}</span>}
                      {m.director && <span> • Dir. {m.director}</span>}
                    </p>

                    {/* Calificación y Recomendación */}
                    <div className="flex items-center gap-2 mt-2">
                      {m.rating ? (
                        <div className="flex items-center text-amber-400 text-[11px]">
                          <Star size={11} className="fill-amber-400 mr-0.5" />
                          <span className="font-semibold">{m.rating}</span>
                          <span className="text-neutral-500">/5</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-neutral-500">Sin nota</span>
                      )}

                      {rec && (
                        <span className="text-[10px] text-neutral-300">
                          {rec.icon} {rec.label}
                        </span>
                      )}

                      {m.notion_page_id ? (
                        <span className="text-[10px] text-emerald-400/90 ml-auto">
                          ✓ Notion
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-500 ml-auto">
                          Solo local
                        </span>
                      )}
                    </div>

                    {/* Reseña Snippet */}
                    <p className="mt-2 text-[11px] text-neutral-300 line-clamp-2 italic bg-white/[0.02] p-1.5 rounded border border-white/5">
                      {hasReview ? `"${m.review}"` : "Sin reseña personal escrita aún."}
                    </p>
                  </div>
                </div>

                {/* Acciones de la tarjeta */}
                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(m)}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Edit3 size={12} />
                      <span>Editar criterio</span>
                    </button>

                    {isSeen && (
                      <button
                        type="button"
                        onClick={() => onNavigateToMovie(m.id)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10 transition-colors"
                      >
                        <ExternalLink size={12} />
                        <span>Ver en grafo</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setDeletingMovie(m)}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-rose-400 hover:text-rose-200 hover:bg-rose-500/10 transition-colors"
                    title="Eliminar y archivar en Notion"
                  >
                    <Trash2 size={12} />
                    <span className="hidden sm:inline">Archivar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Edición Rápida */}
      {editingMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-canvas p-6 shadow-2xl">
            <h4 className="font-serif text-lg font-bold text-white mb-1">
              Editar Criterio: {editingMovie.display_title || editingMovie.title}
            </h4>
            <p className="text-xs text-neutral-400 mb-5">
              Los cambios se actualizarán en el catálogo y se sincronizarán con Notion.
            </p>

            {updateError && (
              <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-950/40 p-2.5 text-xs text-rose-200">
                {updateError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Estado */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Estado
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditStatus("seen")}
                    className={`rounded-lg border p-2 text-xs font-medium ${
                      editStatus === "seen"
                        ? "border-amber-400 bg-amber-500/15 text-amber-200"
                        : "border-white/10 text-neutral-400 hover:text-white"
                    }`}
                  >
                    Visto ✅
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus("pending")}
                    className={`rounded-lg border p-2 text-xs font-medium ${
                      editStatus === "pending"
                        ? "border-sky-400 bg-sky-500/15 text-sky-200"
                        : "border-white/10 text-neutral-400 hover:text-white"
                    }`}
                  >
                    Pendiente 📌
                  </button>
                </div>
              </div>

              {/* Calificación */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Calificación (⭐ 1 a 5)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditRating(s)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        size={22}
                        className={
                          editRating && s <= editRating
                            ? "fill-amber-400 text-amber-400"
                            : "text-neutral-600 hover:text-amber-300"
                        }
                      />
                    </button>
                  ))}
                  {editRating && (
                    <button
                      type="button"
                      onClick={() => setEditRating(null)}
                      className="text-[11px] text-neutral-400 hover:text-white ml-2 underline"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>

              {/* Recomendación */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  ¿Recomendarías?
                </label>
                <div className="flex gap-2">
                  {[
                    { val: 1, label: "🟢 Sí sin dudarlo" },
                    { val: 0, label: "🟡 Con reservas" },
                    { val: -1, label: "🔴 No realmente" },
                  ].map((r) => (
                    <button
                      key={r.val}
                      type="button"
                      onClick={() => setEditRecommend(editRecommend === r.val ? null : r.val)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                        editRecommend === r.val
                          ? "border-white/40 bg-white/10 text-white"
                          : "border-white/10 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reseña */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Reseña personal (actualiza embedding si cambia)
                </label>
                <textarea
                  rows={4}
                  value={editReview}
                  onChange={(e) => setEditReview(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 p-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingMovie(null)}
                  className="rounded-lg px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 px-4 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 transition-all"
                >
                  {isUpdating ? <Loader2 size={13} className="animate-spin" /> : null}
                  <span>Guardar cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Borrado */}
      {deletingMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-2xl border border-rose-500/30 bg-canvas p-6 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400 mb-3">
              <AlertTriangle size={20} />
              <h4 className="font-serif text-base font-bold text-white">¿Archivar y eliminar?</h4>
            </div>

            <p className="text-xs text-neutral-300">
              Estás a punto de eliminar <strong className="text-white">"{deletingMovie.display_title || deletingMovie.title}"</strong> de tu catálogo.
            </p>
            <p className="mt-2 text-[11px] text-neutral-400">
              Si está conectada a Notion, su fila correspondiente se marcará como <span className="text-amber-300">Archivada</span> para no perder tu historial.
            </p>

            {deleteError && (
              <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-950/40 p-2 text-xs text-rose-200">
                {deleteError}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingMovie(null)}
                className="rounded-lg px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-600/30 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-600/50 transition-colors"
              >
                {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Confirmar y archivar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
