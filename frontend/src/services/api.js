// src/services/api.js
// CINE-04: Cliente HTTP con timeout largo (cold start de Render free tier) y una
// señal de "servidor despertando" cuando la respuesta tarda más de 3s.

import useCineStore from "../store/useCineStore";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
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
      throw new Error(
        body.error || `Error ${response.status} al consultar ${path}`,
      );
    }

    return await response.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        "El servidor no respondió a tiempo (posible cold start prolongado).",
      );
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
  return fetchWithColdStartHandling("/api/graph", { method: "GET" });
}

/** POST /api/search/semantic — scope 'seen' (catálogo visto) o 'pending' (mi lista por ver). */
export function semanticSearch(query, limit = 10, scope = "seen", offset = 0) {
  return fetchWithColdStartHandling("/api/search/semantic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit, scope, offset }),
  });
}

/** GET /api/movies/:id — ficha completa (sinopsis, créditos, criterio personal). */
export function fetchMovie(id) {
  return fetchWithColdStartHandling(`/api/movies/${id}`, { method: "GET" });
}

/** GET /api/movies/external/:tmdbId — ficha de una película fuera del catálogo. */
export function fetchExternalMovie(tmdbId) {
  return fetchWithColdStartHandling(`/api/movies/external/${tmdbId}`, { method: "GET" });
}

/** GET /api/movies/:id/neighbors — vecinas con criterio (🔴 fuera, 🟢 sube, tope de director).
 *  `exclude`: ids vistos por el visitante o ya mostrados ("Otras opciones"). */
export function fetchNeighbors(id, limit = 6, exclude = []) {
  const ex = exclude.length ? `&exclude=${exclude.join(",")}` : "";
  return fetchWithColdStartHandling(
    `/api/movies/${id}/neighbors?limit=${limit}${ex}`,
    {
      method: "GET",
    },
  );
}

/** GET /api/movies/search — búsqueda abierta en TMDB, marcando qué está en el catálogo. */
export function searchTmdb(q) {
  return fetchWithColdStartHandling(
    `/api/movies/search?q=${encodeURIComponent(q)}`,
    { method: "GET" },
  );
}

/** POST /api/recommend — "si te gustó X…" para cualquier película de TMDB. */
export function fetchRecommend(tmdbId, exclude = []) {
  return fetchWithColdStartHandling("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tmdbId, exclude }),
  });
}

/** GET /api/recommend/next — "¿Qué veo hoy?": pendientes por afinidad de 🟢 o directores compartidos. */
/**
 * GET /api/recommend/next — "¿Qué veo hoy?".
 * source: "archive" | "radar" | "beyond"; mood: clave de src/lib/moods.js.
 * Con `country`, cada película trae `stream` y `avail` filtra en el servidor: "mine" (con
 * `providers`) o "any". exclude / excludeExt: lo que el visitante marcó como visto.
 */
export function fetchNextUp({
  source = "archive",
  mood,
  limit = 12,
  offset = 0,
  country,
  avail,
  providers = [],
  exclude = [],
  excludeExt = [],
} = {}) {
  const qs = new URLSearchParams({ source, limit, offset });
  if (mood) qs.set("mood", mood);
  if (country) qs.set("country", country);
  if (avail) qs.set("avail", avail);
  if (providers.length) qs.set("providers", providers.join(","));
  if (exclude.length) qs.set("exclude", exclude.join(","));
  if (excludeExt.length) qs.set("exclude_ext", excludeExt.join(","));
  return fetchWithColdStartHandling(`/api/recommend/next?${qs}`, { method: "GET" });
}

/** GET /api/recommend/surprise — "Sorpréndeme": una película de mi archivo, al azar o por ánimo. */
export function fetchSurprise(mood = null, exclude = [], { source = "archive", excludeExt = [] } = {}) {
  const params = new URLSearchParams();
  if (mood) params.set("mood", mood);
  if (exclude.length) params.set("exclude", exclude.join(","));
  if (source === "beyond") params.set("source", "beyond");
  if (excludeExt.length) params.set("exclude_ext", excludeExt.join(","));
  const qs = params.toString();
  return fetchWithColdStartHandling(`/api/recommend/surprise${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

/** POST /api/beyond — "Fuera de mi archivo": TMDB a partir de películas de mi archivo.
 *  seeds: tmdb_id; seedIds: ids del catálogo; exclude: tmdb_id ya vistos o mostrados. */
export function fetchBeyond({ seeds = [], seedIds = [], exclude = [], limit = 6, offset = 0, query }) {
  return fetchWithColdStartHandling("/api/beyond", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seeds, seed_ids: seedIds, exclude, limit, offset, query }),
  });
}

/** GET /api/watch/:tmdbId — dónde ver una película en un país (datos de JustWatch vía TMDB). */
/** GET /api/watch/platforms — plataformas de suscripción de un país, la más popular primero. */
export function fetchRegionPlatforms(country) {
  return fetchWithColdStartHandling(
    `/api/watch/platforms?country=${encodeURIComponent(country)}`,
    { method: "GET" },
  );
}

export function fetchWatchProviders(tmdbId, country) {
  return fetchWithColdStartHandling(
    `/api/watch/${tmdbId}?country=${encodeURIComponent(country)}`,
    { method: "GET" },
  );
}
