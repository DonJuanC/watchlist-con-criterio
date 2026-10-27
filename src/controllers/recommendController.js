// src/controllers/recommendController.js
// CINE-10: "si te gustó X, de lo que he visto te recomiendo…" para CUALQUIER película de TMDB.
// - X ya vista en el catálogo → { source: 'catalog', movieId } (el frontend abre su EgoView).
// - X en el catálogo como pendiente → usa su embedding guardado.
// - X fuera del catálogo → embedding con Gemini UNA vez, cacheado en external_embeddings.
// Mismas reglas que las vecinas: solo vistas, 🔴 fuera, 🟢 sube, máx. 2 del mismo director.

const { query } = require("../db");
const { getMovieForEmbedding } = require("../services/tmdb");
const { generateEmbedding } = require("../services/embeddings");
const { pickNeighbors } = require("../services/neighborRanking");

const LIMIT = 6;
const SEMANTIC_POOL = 20;
const NODE_FIELDS = `m.id, m.title, m.release_year, m.poster_path, m.director,
                     m.genres[1] AS main_genre, m.recommend, m.rating`;

/** Embedding de una película externa: de la caché o, si no está, generado y guardado. */
async function getExternalEmbedding(tmdbId) {
  const cached = await query(
    `SELECT tmdb_id, title, release_year, poster_path, director, embedding::text AS embedding
     FROM external_embeddings WHERE tmdb_id = $1`,
    [tmdbId],
  );
  if (cached.rows.length > 0) {
    const { embedding, ...movie } = cached.rows[0];
    return { movie, embedding, cached: true };
  }

  const d = await getMovieForEmbedding(tmdbId);
  if (!d.overview) return null; // sin sinopsis no hay con qué comparar

  // Mismo texto que scripts/sync-notion.js, para que los embeddings sean comparables.
  const semanticText = `${d.title_es}. Géneros: ${d.genres.join(", ")}. Sinopsis: ${d.overview}`;
  const embedding = `[${(await generateEmbedding(semanticText)).join(",")}]`;

  const movie = {
    tmdb_id: d.tmdb_id,
    title: d.display_title,
    release_year: d.release_year,
    poster_path: d.poster_path,
    director: d.director,
  };
  await query(
    `INSERT INTO external_embeddings (tmdb_id, title, release_year, poster_path, director, embedding)
     VALUES ($1, $2, $3, $4, $5, $6::vector)
     ON CONFLICT (tmdb_id) DO NOTHING`,
    [movie.tmdb_id, movie.title, movie.release_year, movie.poster_path, movie.director, embedding],
  );
  return { movie, embedding, cached: false };
}

/**
 * POST /api/recommend   body: { tmdbId }
 * Respuesta:
 *  - { source: 'catalog', movieId }
 *  - { source: 'pending' | 'external', movie: { tmdb_id, title, release_year, poster_path, director },
 *      recommendations: [{ node, type, weight, reasons }] }
 */
async function recommend(req, res) {
  const tmdbId = Number(req.body?.tmdbId);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return res.status(400).json({ error: "tmdbId debe ser un entero positivo." });
  }

  try {
    const inCatalog = await query(
      `SELECT id, status, tmdb_id, title, release_year, poster_path, director,
              embedding::text AS embedding
       FROM movies WHERE tmdb_id = $1`,
      [tmdbId],
    );
    const row = inCatalog.rows[0];
    if (row && row.status === "seen") {
      return res.status(200).json({ source: "catalog", movieId: row.id });
    }

    let source;
    let movie;
    let embedding;
    if (row && row.embedding) {
      source = "pending";
      const { embedding: stored, id, status, ...rest } = row;
      embedding = stored;
      movie = rest;
    } else {
      const ext = await getExternalEmbedding(tmdbId);
      if (!ext) {
        return res
          .status(422)
          .json({ error: "Esta película no tiene sinopsis en TMDB; no se puede comparar." });
      }
      source = "external";
      ({ movie, embedding } = ext);
    }

    const [semResult, dirResult] = await Promise.all([
      query(
        `SELECT ${NODE_FIELDS}, 1 - (m.embedding <=> $1::vector) AS sim
         FROM movies m
         WHERE m.status = 'seen' AND m.embedding IS NOT NULL
           AND COALESCE(m.recommend, 0) <> -1
         ORDER BY m.embedding <=> $1::vector
         LIMIT $2`,
        [embedding, SEMANTIC_POOL],
      ),
      movie.director
        ? query(
            `SELECT ${NODE_FIELDS}
             FROM movies m
             WHERE m.director = $1 AND m.status = 'seen'
               AND COALESCE(m.recommend, 0) <> -1`,
            [movie.director],
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const recommendations = pickNeighbors({
      semanticRows: semResult.rows,
      directorRows: dirResult.rows,
      centerDirector: movie.director,
      centerYear: movie.release_year,
      limit: LIMIT,
    });

    return res.status(200).json({ source, movie, recommendations });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: "Esa película no existe en TMDB." });
    }
    console.error("❌ Error en recommend:", err.message);
    return res.status(500).json({ error: "No se pudo calcular la recomendación." });
  }
}

module.exports = { recommend };
