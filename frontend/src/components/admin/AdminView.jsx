// frontend/src/components/admin/AdminView.jsx
// CINE-11: Contenedor principal de Criterio Studio (Panel de Administración).

import { useEffect } from "react";
import {
  Sparkles,
  Film,
  ArrowRightLeft,
  ArrowLeft,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import useAdminStore from "../../store/useAdminStore";
import AdminGate from "./AdminGate";
import AdminCurateTab from "./AdminCurateTab";
import AdminCatalogTab from "./AdminCatalogTab";
import AdminSyncTab from "./AdminSyncTab";

export default function AdminView({ onNavigateToHome, onNavigateToMovie }) {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const checkAuth = useAdminStore((s) => s.checkAuth);
  const logout = useAdminStore((s) => s.logout);
  const activeTab = useAdminStore((s) => s.activeTab);
  const setActiveTab = useAdminStore((s) => s.setActiveTab);
  const loadAdminMovies = useAdminStore((s) => s.loadAdminMovies);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      loadAdminMovies();
    }
  }, [isAuthenticated, loadAdminMovies]);

  if (!isAuthenticated) {
    return <AdminGate onBackToHome={onNavigateToHome} />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      {/* Barra Superior del Studio */}
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h2 className="font-serif text-lg font-bold text-white">Criterio Studio</h2>
            <p className="text-[11px] text-neutral-400">
              Curaduría personal y sincronización bidireccional con Notion
            </p>
          </div>
        </div>

        {/* Acciones de Navegación y Salida */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateToHome}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 hover:text-white hover:border-white/20 transition-all"
          >
            <ArrowLeft size={13} />
            <span>Volver a la app</span>
          </button>

          <button
            type="button"
            onClick={logout}
            title="Cerrar sesión de administrador"
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1.5 text-neutral-400 hover:text-rose-300 hover:border-rose-500/30 hover:bg-rose-950/20 transition-all"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* Navegación por Pestañas */}
      <div className="mb-8 flex items-center gap-2 border-b border-white/10 pb-2">
        {[
          { id: "curate", label: "Curar Nueva Obra", icon: Sparkles },
          { id: "catalog", label: "Catálogo", icon: Film },
          { id: "sync", label: "Sincronización Notion", icon: ArrowRightLeft },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                isActive
                  ? "border border-amber-500/40 bg-amber-500/15 text-amber-200 shadow-md"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={14} className={isActive ? "text-amber-400" : "text-neutral-400"} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenido de la pestaña activa */}
      <div>
        {activeTab === "curate" && (
          <AdminCurateTab onNavigateToMovie={onNavigateToMovie} />
        )}
        {activeTab === "catalog" && (
          <AdminCatalogTab onNavigateToMovie={onNavigateToMovie} />
        )}
        {activeTab === "sync" && <AdminSyncTab />}
      </div>
    </div>
  );
}
