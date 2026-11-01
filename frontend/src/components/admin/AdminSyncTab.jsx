// frontend/src/components/admin/AdminSyncTab.jsx
// CINE-11: Consola de control para sincronización manual bidireccional con Notion.

import { useState } from "react";
import {
  Terminal,
  AlertTriangle,
  Play,
  Loader2,
  ArrowRightLeft,
} from "lucide-react";
import { triggerAdminSync } from "../../services/adminApi";
import useAdminStore from "../../store/useAdminStore";

export default function AdminSyncTab() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [prune, setPrune] = useState(false);
  const [reembed, setReembed] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const loadAdminMovies = useAdminStore((s) => s.loadAdminMovies);

  const handleStartSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const res = await triggerAdminSync({ dryRun, prune, reembed });
      setSyncResult(res);
      loadAdminMovies();
    } catch (err) {
      setSyncError(err.data?.error || err.message || "Error al sincronizar con Notion.");
      if (err.data?.logs) {
        setSyncResult({ logs: err.data.logs });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-serif text-xl font-bold text-white flex items-center gap-2">
          <ArrowRightLeft size={20} className="text-amber-400" />
          <span>Sincronización Bidireccional (Notion ⇄ App)</span>
        </h3>
        <p className="mt-1 text-xs text-neutral-400">
          Trae películas y ediciones que hayas anotado en Notion a tu catálogo, o regenera afinidades semánticas.
        </p>
      </div>

      {/* Tarjeta de Opciones de Sincronización */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
          Opciones de Ejecución
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer hover:border-white/20 transition-colors">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-400"
            />
            <div>
              <span className="block text-xs font-medium text-white">Dry Run (Simulación)</span>
              <span className="block text-[11px] text-neutral-400 mt-0.5">
                Verifica cambios sin guardar en el catálogo ni en Notion.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer hover:border-white/20 transition-colors">
            <input
              type="checkbox"
              checked={prune}
              onChange={(e) => setPrune(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-400"
            />
            <div>
              <span className="block text-xs font-medium text-white">Prune (Limpieza)</span>
              <span className="block text-[11px] text-neutral-400 mt-0.5">
                Elimina del catálogo obras que ya no existan en Notion.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer hover:border-white/20 transition-colors">
            <input
              type="checkbox"
              checked={reembed}
              onChange={(e) => setReembed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-400"
            />
            <div>
              <span className="block text-xs font-medium text-white">Re-embed</span>
              <span className="block text-[11px] text-neutral-400 mt-0.5">
                Fuerza la regeneración de vectores de IA en Gemini.
              </span>
            </div>
          </label>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleStartSync}
            disabled={isSyncing}
            className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-600 to-amber-500 py-2.5 px-5 text-xs font-semibold text-neutral-950 shadow-lg shadow-amber-950/40 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isSyncing ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Ejecutando sincronización con Notion...</span>
              </>
            ) : (
              <>
                <Play size={14} className="fill-current" />
                <span>Iniciar sincronización ahora</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Resumen de estadísticas si terminó */}
      {syncResult?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
            <span className="block text-lg font-bold text-emerald-400">{syncResult.stats.synced}</span>
            <span className="text-[11px] text-neutral-400">Sincronizadas</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
            <span className="block text-lg font-bold text-amber-400">{syncResult.stats.embedded}</span>
            <span className="text-[11px] text-neutral-400">Embeddings Gemini</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
            <span className="block text-lg font-bold text-neutral-300">{syncResult.stats.skipped}</span>
            <span className="text-[11px] text-neutral-400">Sin cambios</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
            <span className="block text-lg font-bold text-rose-400">{syncResult.stats.errors}</span>
            <span className="text-[11px] text-neutral-400">Errores</span>
          </div>
        </div>
      )}

      {syncError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-200 flex items-center gap-2">
          <AlertTriangle size={16} className="text-rose-400 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* Consola Monospace de Logs */}
      <div className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-4 font-mono text-[11px] text-neutral-300 shadow-2xl">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-neutral-500">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-amber-400" />
            <span className="font-semibold text-neutral-400">Terminal de Sincronización</span>
          </div>
          {syncResult?.durationMs && (
            <span>Completado en {(syncResult.durationMs / 1000).toFixed(1)}s</span>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1 text-neutral-400">
          {syncResult?.logs && syncResult.logs.length > 0 ? (
            syncResult.logs.map((log, i) => {
              const isOk = log.includes("✅");
              const isWarn = log.includes("⚠️") || log.includes("❓");
              const isErr = log.includes("❌");

              let color = "text-neutral-300";
              if (isOk) color = "text-emerald-400";
              if (isWarn) color = "text-amber-300";
              if (isErr) color = "text-rose-400";

              return (
                <div key={i} className={`leading-relaxed ${color}`}>
                  {log}
                </div>
              );
            })
          ) : (
            <p className="text-neutral-600 italic">
              {isSyncing
                ? "Sincronizando registros con Notion..."
                : "Presiona «Iniciar sincronización ahora» para consultar cambios en Notion."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
