// frontend/src/components/admin/AdminGate.jsx
// CINE-11: Pantalla de desbloqueo y autenticación con estética cinematográfica.

import { useState } from "react";
import { Lock, KeyRound, Eye, EyeOff, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import useAdminStore from "../../store/useAdminStore";

export default function AdminGate({ onBackToHome }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useAdminStore((s) => s.login);
  const isCheckingAuth = useAdminStore((s) => s.isCheckingAuth);
  const loginError = useAdminStore((s) => s.loginError);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    await login(password);
  };

  return (
    <div className="relative flex min-h-[75vh] w-full items-center justify-center px-4 py-12">
      {/* Halo ambiental suave */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute h-96 w-96 rounded-full bg-accent-500/10 blur-[100px]"
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-canvas/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <button
          type="button"
          onClick={onBackToHome}
          className="mb-6 inline-flex items-center gap-1.5 text-xs text-neutral-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          <span>Volver al explorador</span>
        </button>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-accent-500/30 bg-accent-500/10 text-accent-300 shadow-inner">
            <Lock size={22} />
          </div>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-white">
            Criterio Studio
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            Ingresa tu clave maestra para curar películas y sincronizar en vivo con Notion.
          </p>
        </div>

        {loginError && (
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-200">
            <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
            <span>{loginError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-medium text-neutral-300 mb-1.5"
            >
              Contraseña de administrador
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                <KeyRound size={16} />
              </div>
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa la clave..."
                autoFocus
                disabled={isCheckingAuth}
                className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pl-10 pr-10 text-sm text-white placeholder-neutral-500 transition-all focus:border-accent-400/80 focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-accent-400/80"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isCheckingAuth || !password.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent-500/50 bg-gradient-to-r from-accent-600 to-accent-500 py-2.5 px-4 text-sm font-semibold text-neutral-950 shadow-lg shadow-accent-950/40 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCheckingAuth ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Verificando...</span>
              </>
            ) : (
              <span>Desbloquear Studio</span>
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] text-neutral-500">
          Esta sesión se mantiene activa de forma segura en este navegador.
        </p>
      </div>
    </div>
  );
}
