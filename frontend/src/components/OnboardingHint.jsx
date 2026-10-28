// src/components/OnboardingHint.jsx
// CINE-08: micro-onboarding — el usuario nuevo del portafolio no sabe qué significa
// la nube de puntos sin una pista mínima. Aparece una sola vez por sesión de pestaña
// (sessionStorage) en la esquina superior y se puede cerrar manualmente.

import { useState } from 'react';
import { X } from 'lucide-react';

export default function OnboardingHint() {
    const [dismissed, setDismissed] = useState(() => {
        try {
            return sessionStorage.getItem('cine-onboarding-dismissed') === '1';
        } catch {
            return false;
        }
    });

    if (dismissed) return null;

    const handleDismiss = () => {
        setDismissed(true);
        try {
            sessionStorage.setItem('cine-onboarding-dismissed', '1');
        } catch {
            // sessionStorage puede no estar disponible (modo privado, etc.) — no es crítico.
        }
    };

    return (
        // Mobile: abajo, encima del panel de ajustes y sin tapar el zoom (arriba está la búsqueda).
        // Desktop: arriba a la izquierda. z-10 en mobile: si se abre el panel de ajustes, queda por encima del aviso.
        <div className="fixed bottom-[4.5rem] left-3 right-16 z-10 rounded-xl sm:bottom-auto sm:left-6 sm:right-auto sm:top-6 sm:z-20 sm:max-w-xs border border-white/10 bg-neutral-900/90 px-4 py-3 text-xs leading-relaxed text-neutral-300 shadow-2xl backdrop-blur">
            <button
                onClick={handleDismiss}
                aria-label="Cerrar sugerencia"
                className="absolute right-2 top-2 rounded-full p-0.5 text-neutral-500 hover:bg-white/10 hover:text-white"
            >
                <X size={14} />
            </button>
            <p className="pr-4">
                Explora el mapa del cine: las películas cercanas comparten la misma atmósfera.
                <br />
                Haz clic en cualquiera para descubrir sus conexiones.
            </p>
        </div>
    );
}
