// src/controllers/watchController.js
// "Dónde verla": plataformas por país para cualquier película de TMDB (datos de JustWatch).
// No se guarda en Neon porque la disponibilidad cambia seguido: caché en memoria por 6 h.

const { getWatchProviders } = require("../services/tmdb");

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map(); // tmdbId -> { at, results } (todos los países de una vez)

// TMDB lista a veces la misma plataforma dos veces ("HBO Max" y "HBO Max Amazon Channel"):
// si está la directa, se oculta la del canal de Amazon.
function cleanProviders(list = []) {
  const names = new Set(list.map((p) => p.provider_name));
  const seen = new Set();
  return [...list]
    .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))
    .filter((p) => {
      const base = p.provider_name.replace(/ Amazon Channel$/, "");
      if (base !== p.provider_name && names.has(base)) return false;
      if (seen.has(p.provider_name)) return false;
      seen.add(p.provider_name);
      return true;
    })
    .map((p) => ({ id: p.provider_id, name: p.provider_name, logo_path: p.logo_path }));
}

async function getCachedProviders(tmdbId) {
  const hit = cache.get(tmdbId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.results;
  const results = await getWatchProviders(tmdbId);
  cache.set(tmdbId, { at: Date.now(), results });
  return results;
}

/**
 * GET /api/watch/:tmdbId?country=CO
 * Respuesta: { country, link, stream: [...], rent: [...], buy: [...] }
 *  - stream junta suscripción (flatrate), gratis (free) y con anuncios (ads).
 *  - link: página de TMDB con las opciones de ese país (TMDB no da enlaces directos).
 */
async function getWatch(req, res) {
  const tmdbId = Number(req.params.tmdbId);
  const country = String(req.query.country || "").toUpperCase();
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return res.status(400).json({ error: "tmdbId debe ser un entero positivo." });
  }
  if (!/^[A-Z]{2}$/.test(country)) {
    return res.status(400).json({ error: "country debe ser un código de 2 letras (ej. CO)." });
  }

  try {
    const results = await getCachedProviders(tmdbId);
    const c = results[country] || {};
    return res.status(200).json({
      country,
      link: c.link || null,
      stream: cleanProviders([...(c.flatrate || []), ...(c.free || []), ...(c.ads || [])]),
      rent: cleanProviders(c.rent),
      buy: cleanProviders(c.buy),
    });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: "Esa película no existe en TMDB." });
    }
    console.error("❌ Error en getWatch:", err.message);
    return res.status(502).json({ error: "No se pudo consultar dónde verla." });
  }
}

module.exports = { getWatch };
