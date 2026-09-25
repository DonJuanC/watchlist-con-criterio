// src/services/api.js
// CINE-04: Cliente HTTP con timeout largo (cold start de Render free tier) y una
// señal de "servidor despertando" cuando la respuesta tarda más de 3s.

import useCineStore from '../store/useCineStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const REQUEST_TIMEOUT_MS = 90_000; // Render free tier puede tardar ~50s en despertar
const WARMING_THRESHOLD_MS = 3_000;

/**
 * fetch con:
 * - AbortController a 90s (timeout total).
 * - Flag `isServerWarming` en el store si la respuesta tarda más de 3s
 *   (probable cold start del backend en Render).
 */
async function fetchWithColdStartHandling(path, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const warmingTimer = setTimeout(() => {
        useCineStore.getState().setServerWarming(true);
    }, WARMING_THRESHOLD_MS);

    try {
        const response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            signal: controller.signal,
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || `Error ${response.status} al consultar ${path}`);
        }

        return await response.json();
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('El servidor no respondió a tiempo (posible cold start prolongado).');
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
        clearTimeout(warmingTimer);
        useCineStore.getState().setServerWarming(false);
    }
}

/** GET /api/graph */
export function fetchGraph() {
    return fetchWithColdStartHandling('/api/graph', { method: 'GET' });
}

/** POST /api/search/semantic */
export function semanticSearch(query, limit = 10) {
    return fetchWithColdStartHandling('/api/search/semantic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit }),
    });
}
