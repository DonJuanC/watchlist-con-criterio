// src/services/availability.js
// Dónde ver una película, por país. Para el catálogo se guarda en Neon (watch_availability)
// y se refresca desde TMDB cuando tiene más de 7 días; así "¿Qué veo hoy?" puede filtrar por
// plataforma en SQL. Las películas de fuera del catálogo (búsqueda abierta) solo van a una
// caché en memoria, para que la tabla no crezca con cada búsqueda de un visitante.

const { query, pool } = require("../db");
const { getWatchProviders } = require("./tmdb");
const { dedupeByKey } = require("./platforms");

const DB_TTL_DAYS = 7;
const MEMORY_TTL_MS = 6 * 60 * 60 * 1000;
const memory = new Map(); // tmdbId -> { at, byCountry }

// Plataformas limpias (sin canales ni variantes duplicadas) y con `key` para cruzar con
// "mis plataformas" del visitante.
function cleanProviders(list = []) {
  return dedupeByKey(
    [...list].sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999)),
  );
}

/** Respuesta cruda de TMDB (todos los países) → { CO: { link, stream, rent, buy }, … } */
function shape(results = {}) {
  const out = {};
  for (const [country, c] of Object.entries(results)) {
    if (!/^[A-Z]{2}$/.test(country)) continue;
    out[country] = {
      link: c.link || null,
      // stream junta suscripción (flatrate), gratis (free) y con anuncios (ads).
      stream: cleanProviders([...(c.flatrate || []), ...(c.free || []), ...(c.ads || [])]),
      rent: cleanProviders(c.rent),
      buy: cleanProviders(c.buy),
    };
  }
  return out;
}

const EMPTY = (country) => ({ country, link: null, stream: [], rent: [], buy: [] });

/** Consulta TMDB y reemplaza en Neon todos los países de esa película. */
async function refreshAvailability(tmdbId) {
  const byCountry = shape(await getWatchProviders(tmdbId));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM watch_availability WHERE tmdb_id = $1", [tmdbId]);
    const entries = Object.entries(byCountry);
    if (entries.length) {
      // Un solo INSERT con todos los países (unos 60–140 por película).
      const values = [];
      const params = [];
      entries.forEach(([country, c], i) => {
        const b = i * 7;
        values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`);
        params.push(
          tmdbId,
          country,
          c.stream.map((p) => p.key),
          JSON.stringify(c.stream),
          JSON.stringify(c.rent),
          JSON.stringify(c.buy),
          c.link,
        );
      });
      await client.query(
        `INSERT INTO watch_availability (tmdb_id, country, stream_keys, stream, rent, buy, link)
         VALUES ${values.join(", ")}`,
        params,
      );
    }
    await client.query(
      `INSERT INTO watch_fetched (tmdb_id, fetched_at) VALUES ($1, NOW())
       ON CONFLICT (tmdb_id) DO UPDATE SET fetched_at = NOW()`,
      [tmdbId],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return byCountry;
}

async function fromMemory(tmdbId, country) {
  const hit = memory.get(tmdbId);
  let byCountry = hit && Date.now() - hit.at < MEMORY_TTL_MS ? hit.byCountry : null;
  if (!byCountry) {
    byCountry = shape(await getWatchProviders(tmdbId));
    memory.set(tmdbId, { at: Date.now(), byCountry });
  }
  return byCountry[country] ? { country, ...byCountry[country] } : EMPTY(country);
}

/**
 * Disponibilidad de una película en un país: { country, link, stream, rent, buy }.
 * Del catálogo: Neon, refrescando si está vencida. Si Neon falla, TMDB directo.
 */
async function getAvailability(tmdbId, country) {
  try {
    const { rows } = await query(
      `SELECT EXISTS (SELECT 1 FROM movies WHERE tmdb_id = $1) AS in_catalog,
              (SELECT fetched_at > NOW() - make_interval(days => $3)
                 FROM watch_fetched WHERE tmdb_id = $1) AS fresh,
              (SELECT row_to_json(w) FROM (
                 SELECT link, stream, rent, buy FROM watch_availability
                 WHERE tmdb_id = $1 AND country = $2) w) AS hit`,
      [tmdbId, country, DB_TTL_DAYS],
    );
    const { in_catalog: inCatalog, fresh, hit } = rows[0];
    if (!inCatalog) return fromMemory(tmdbId, country);
    if (fresh) return hit ? { country, ...hit } : EMPTY(country);
    const byCountry = await refreshAvailability(tmdbId);
    return byCountry[country] ? { country, ...byCountry[country] } : EMPTY(country);
  } catch (err) {
    if (err.status) throw err; // error de TMDB (p. ej. 404): lo maneja el controlador
    console.error("⚠️ Disponibilidad desde Neon falló, uso TMDB directo:", err.message);
    return fromMemory(tmdbId, country);
  }
}

module.exports = { getAvailability, refreshAvailability, DB_TTL_DAYS };
