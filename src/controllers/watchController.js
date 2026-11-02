// src/controllers/watchController.js
// "Dónde verla": plataformas por país para cualquier película de TMDB (datos de JustWatch).
// No se guarda en Neon porque la disponibilidad cambia seguido: caché en memoria por 6 h.

const { getWatchProviders, getRegionProviders } = require("../services/tmdb");
const { dedupeByKey, regionPlatforms } = require("../services/platforms");

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map(); // tmdbId -> { at, results } (todos los países de una vez)
const REGION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PLATFORMS = 30;
const regionCache = new Map(); // country -> { at, platforms }

// Plataformas limpias (sin canales ni variantes duplicadas) y con `key` para cruzar con
// "mis plataformas" del visitante. Ver src/services/platforms.js.
function cleanProviders(list = []) {
  return dedupeByKey(
    [...list].sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999)),
  );
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
    res.setHeader("Cache-Control", "public, max-age=7200, stale-while-revalidate=86400");
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

/**
 * GET /api/watch/platforms?country=CO
 * Plataformas de suscripción de un país, la más popular primero (prioridad de JustWatch).
 * Respuesta: { country, platforms: [{ id, key, name, logo_path }] }
 */
async function getPlatforms(req, res) {
  const country = String(req.query.country || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    return res.status(400).json({ error: "country debe ser un código de 2 letras (ej. CO)." });
  }
  try {
    const hit = regionCache.get(country);
    let platforms = hit && Date.now() - hit.at < REGION_TTL_MS ? hit.platforms : null;
    if (!platforms) {
      platforms = regionPlatforms(await getRegionProviders(country), country).slice(0, MAX_PLATFORMS);
      // Un país sin datos no se guarda: puede ser una falla pasajera de TMDB.
      if (platforms.length) regionCache.set(country, { at: Date.now(), platforms });
    }
    res.setHeader("Cache-Control", "public, max-age=21600, stale-while-revalidate=86400");
    return res.status(200).json({ country, platforms });
  } catch (err) {
    console.error("❌ Error en getPlatforms:", err.message);
    return res.status(502).json({ error: "No se pudo consultar las plataformas del país." });
  }
}

module.exports = { getWatch, getPlatforms };
