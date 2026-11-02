// src/services/externalRatings.js
// Piso de crítica para lo que está FUERA de mi archivo (en lo mío manda mi criterio, no la crítica).
// Regla: Rotten Tomatoes >= 50%. Sin nota de RT (cine latino, viejo, de nicho), IMDb >= 6.5.
// Sin ninguna de las dos, basta el piso de TMDB que ya aplica beyond.js.
// Las notas se guardan en Neon (external_ratings) para no gastar la cuota de OMDb (~1.000/día)
// en cada request: después de unos días casi todo sale de la base.

const { query } = require("../db");
const { getCriticRatings } = require("./omdb");

const MIN_RT = 50;
const MIN_IMDB = 6.5;
const STALE_DAYS = 60; // las notas casi no cambian; se refrescan cada dos meses
const MAX_LIVE = 24; // consultas a OMDb por request, como máximo
const CONCURRENCY = 6;

let tableReady = null;
function ensureTable() {
  tableReady ??= query(
    `CREATE TABLE IF NOT EXISTS external_ratings (
       tmdb_id     integer PRIMARY KEY,
       imdb_id     text,
       rt_score    real,
       imdb_rating real,
       metascore   real,
       fetched_at  timestamptz NOT NULL DEFAULT now()
     )`,
  ).catch((err) => {
    tableReady = null; // reintenta en el próximo request
    throw err;
  });
  return tableReady;
}

/** ¿Pasa el piso? Sin datos de crítica no se descarta (no castigar lo que RT no cubre). */
function passesCriticFloor(r) {
  if (!r) return false;
  if (r.rt_score != null) return r.rt_score >= MIN_RT;
  if (r.imdb_rating != null) return r.imdb_rating >= MIN_IMDB;
  return true;
}

async function saveRatings(tmdbId, r) {
  await query(
    `INSERT INTO external_ratings (tmdb_id, imdb_id, rt_score, imdb_rating, metascore, fetched_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (tmdb_id) DO UPDATE SET imdb_id = EXCLUDED.imdb_id, rt_score = EXCLUDED.rt_score,
       imdb_rating = EXCLUDED.imdb_rating, metascore = EXCLUDED.metascore, fetched_at = now()`,
    [tmdbId, r.imdb_id, r.rt_score, r.imdb_rating, r.metascore],
  ).catch(() => null);
}

/**
 * Notas de crítica por tmdb_id: base primero, OMDb en vivo para lo que falta (con tope).
 * @returns {Promise<Map<number, {rt_score, imdb_rating, metascore}>>} solo las verificadas;
 *   lo que no se pudo consultar hoy (cuota, error, tope) no aparece en el Map.
 */
async function ratingsFor(tmdbIds) {
  const ids = [...new Set(tmdbIds)].filter((n) => Number.isInteger(n) && n > 0);
  const out = new Map();
  if (!ids.length) return out;
  try {
    await ensureTable();
    const { rows } = await query(
      `SELECT tmdb_id, rt_score, imdb_rating, metascore FROM external_ratings
        WHERE tmdb_id = ANY($1::int[]) AND fetched_at > now() - ($2 || ' days')::interval`,
      [ids, String(STALE_DAYS)],
    );
    for (const r of rows) out.set(r.tmdb_id, r);
  } catch (err) {
    console.error("⚠️ external_ratings no disponible:", err.message.slice(0, 120));
  }

  const missing = ids.filter((id) => !out.has(id)).slice(0, MAX_LIVE);
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    await Promise.all(
      missing.slice(i, i + CONCURRENCY).map(async (id) => {
        const r = await getCriticRatings(id);
        if (!r.fetched) return;
        out.set(id, r);
        await saveRatings(id, r);
      }),
    );
  }
  return out;
}

module.exports = { ratingsFor, passesCriticFloor, saveRatings, MIN_RT, MIN_IMDB };
