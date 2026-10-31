// src/store/useThemeStore.js
// Tema claro/oscuro. Por defecto sigue al sistema; si el usuario elige con el
// toggle, la elección se guarda y deja de seguir al sistema.
// El script inline de index.html aplica el tema antes del primer paint (sin flash);
// este store solo lo lee, lo cambia y lo mantiene sincronizado.

import { create } from 'zustand';

const STORAGE_KEY = 'theme';
const META_COLOR = { dark: '#14110E', light: '#F2EFEA' };
const LIGHT_QUERY = '(prefers-color-scheme: light)';

function readStored() {
    try {
        const t = localStorage.getItem(STORAGE_KEY);
        return t === 'light' || t === 'dark' ? t : null;
    } catch {
        return null;
    }
}

function readSystem() {
    return typeof window !== 'undefined' && window.matchMedia?.(LIGHT_QUERY).matches ? 'light' : 'dark';
}

function applyTheme(theme) {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[theme]);
}

const initialTheme = document.documentElement.dataset.theme || readStored() || readSystem();
applyTheme(initialTheme);

const useThemeStore = create((set, get) => ({
    theme: initialTheme,
    toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            /* almacenamiento bloqueado: el cambio aplica solo a esta sesión */
        }
        applyTheme(next);
        set({ theme: next });
    },
}));

// Si el usuario no ha elegido, seguir los cambios del sistema en vivo.
window.matchMedia?.(LIGHT_QUERY).addEventListener('change', (e) => {
    if (readStored()) return;
    const next = e.matches ? 'light' : 'dark';
    applyTheme(next);
    useThemeStore.setState({ theme: next });
});

export default useThemeStore;
