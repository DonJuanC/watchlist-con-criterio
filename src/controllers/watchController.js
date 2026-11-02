// src/controllers/watchController.js
// "Dónde verla": plataformas por país para cualquier película de TMDB (datos de JustWatch).
// Las del catálogo se guardan en Neon (ver src/services/availability.js); las demás, en memoria.

const { getRegionProviders } = require("../services/tmdb");
const { regionPlatforms } = require("../services/platforms");
const { getAvailability } = require("../services/availability");

const REGION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PLATFORMS = 30;
const regionCache = new Map(); // country -> { at, platforms }

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
    const data = await getAvailability(tmdbId, country);
    res.setHeader("Cache-Control", "public, max-age=7200, stale-while-revalidate=86400");
    return res.status(200).json(data);
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
