// src/controllers/beyondController.js
// POST /api/beyond — "Fuera de mi archivo" a partir de semillas de mi archivo.
// body: { seeds?: number[] (tmdb_id), seed_ids?: number[] (id del catálogo),
//         exclude?: number[] (tmdb_id), limit?: number, offset?: number,
//         query?: string (la búsqueda por tema: sirve de referencia semántica) }
// Respuesta: { results: [{ movie, because }], hasMore }

const { query } = require("../db");
const { beyondFromSeeds } = require("../services/beyond");
const { queryVector } = require("./searchController");
const { detectEmotions } = require("../services/emotions");
const { parseExclude } = require("../services/neighborRanking");

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;
const MAX_RESULTS = 36; // más allá, TMDB empieza a alejarse de las semillas
const MIN_SEEDS = 4;

/**
 * Con una sola semilla (la órbita de una película) TMDB da para dos páginas. Se completan
 * las semillas con sus vecinas más cercanas de mi archivo (vistas, sin 🔴), así la lista
 * sigue anclada a mi criterio.
 */
async function expandSeeds(seeds) {
  if (seeds.length >= MIN_SEEDS) return seeds;
  const { rows } = await query(
    `WITH c AS (
       SELECT embedding FROM movies WHERE tmdb_id = $1 AND embedding IS NOT NULL
       UNION ALL
       SELECT embedding FROM external_embeddings WHERE tmdb_id = $1
       LIMIT 1
     )
     SELECT m.tmdb_id FROM movies m, c
     WHERE m.status = 'seen' AND m.embedding IS NOT NULL AND m.tmdb_id IS NOT NULL
       AND COALESCE(m.recommend, 0) <> -1 AND NOT (m.tmdb_id = ANY($2::int[]))
     ORDER BY m.embedding <=> c.embedding
     LIMIT $3`,
    [seeds[0], seeds, MIN_SEEDS - seeds.length],
  );
  return [...seeds, ...rows.map((r) => r.tmdb_id)];
}

async function beyond(req, res) {
  let seeds = [...parseExclude(req.body?.seeds)];
  const seedIds = [...parseExclude(req.body?.seed_ids)];
  if (!seeds.length && !seedIds.length) {
    return res.status(400).json({ error: "Faltan películas semilla (seeds o seed_ids)." });
  }
  const exclude = parseExclude(req.body?.exclude);
  const limit = Math.min(Math.max(Number(req.body?.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Number.parseInt(req.body?.offset, 10) || 0, 0);

  try {
    if (seedIds.length) {
      // El grafo del frontend no trae tmdb_id: la órbita manda ids del catálogo.
      const { rows } = await query(
        `SELECT id, tmdb_id FROM movies WHERE id = ANY($1::int[]) AND tmdb_id IS NOT NULL`,
        [seedIds],
      );
      const byId = new Map(rows.map((r) => [r.id, r.tmdb_id]));
      seeds = [...seeds, ...seedIds.map((id) => byId.get(id)).filter(Boolean)];
      if (!seeds.length) return res.status(200).json({ results: [], hasMore: false });
    }
    const text = typeof req.body?.query === "string" ? req.body.query.trim().slice(0, 250) : "";
    // Misma lectura de emociones que la búsqueda: "feliz" re-ordena por películas que dan felicidad.
    const refText = text ? detectEmotions(text)?.embedText ?? text : "";
    const refVector = refText ? JSON.parse(await queryVector(refText)) : null;
    const ranked = (
      await beyondFromSeeds(await expandSeeds(seeds), exclude, {
        primaryCount: seeds.length,
        refVector,
      })
    ).slice(0, MAX_RESULTS);
    const page = ranked.slice(offset, offset + limit);
    return res.status(200).json({
      results: page.map(({ movie, because }) => ({ movie, because })),
      hasMore: ranked.length > offset + limit,
    });
  } catch (err) {
    console.error("❌ Error en beyond:", err.message);
    return res.status(500).json({ error: "No pude buscar fuera del archivo ahora." });
  }
}

module.exports = { beyond };
