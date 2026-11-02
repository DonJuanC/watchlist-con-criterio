// src/services/omdb.js
// Notas de la crítica en vivo (Rotten Tomatoes %, IMDb, Metascore) para lo que
// scripts/fetch-ratings.js no cubre: películas fuera de mi archivo y huecos del catálogo.
// Misma lógica que el script (IMDb ID desde TMDB, OMDb por ese ID). Caché en memoria.
// Cuota gratis de OMDb: ~1.000/día. Si se agota, se responde sin notas (nunca falla la ficha).

const OMDB_KEY = process.env.OMDB_API_KEY;
const TMDB_KEY = process.env.TMDB_API_KEY;
const CACHE_MAX = 1000;
const EMPTY = { imdb_id: null, rt_score: null, imdb_rating: null, metascore: null };
const cache = new Map(); // tmdb_id -> notas
let quotaBlockedUntil = 0;

const num = (v) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

async function getImdbId(tmdbId) {
  const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/external_ids?api_key=${TMDB_KEY}`);
  if (!res.ok) return null;
  return (await res.json()).imdb_id || null;
}

/**
 * @param {number} tmdbId
 * @param {string|null} [knownImdbId]
 * @returns {Promise<{ imdb_id, rt_score, imdb_rating, metascore, fetched: boolean }>}
 *   fetched=false: no se pudo consultar (sin key, cuota o error); no guardar como definitivo.
 */
async function getCriticRatings(tmdbId, knownImdbId = null) {
  if (cache.has(tmdbId)) return cache.get(tmdbId);
  if (!OMDB_KEY || Date.now() < quotaBlockedUntil) return { ...EMPTY, fetched: false };
  try {
    const imdbId = knownImdbId || (await getImdbId(tmdbId));
    if (!imdbId) {
      const out = { ...EMPTY, fetched: true };
      cache.set(tmdbId, out);
      return out;
    }
    const res = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${imdbId}`);
    const d = await res.json().catch(() => ({}));
    if (/limit/i.test(d.Error || "")) {
      quotaBlockedUntil = Date.now() + 60 * 60 * 1000; // cuota del día: pausa una hora
      return { ...EMPTY, imdb_id: imdbId, fetched: false };
    }
    if (!res.ok) return { ...EMPTY, imdb_id: imdbId, fetched: false };
    const rtRaw = (d.Ratings || []).find((r) => r.Source === "Rotten Tomatoes")?.Value;
    const out = {
      imdb_id: imdbId,
      rt_score: rtRaw ? num(rtRaw) : null,
      imdb_rating: num(d.imdbRating),
      metascore: num(d.Metascore),
      fetched: true,
    };
    cache.set(tmdbId, out);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return out;
  } catch {
    return { ...EMPTY, fetched: false };
  }
}

module.exports = { getCriticRatings };
