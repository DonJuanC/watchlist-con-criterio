// src/controllers/searchController.js
// CINE-03: Búsqueda semántica vectorial (similitud coseno) contra la tabla movies.

const { query } = require("../db");
const { generateMovieEmbedding } = require("../services/embeddings");

const DEFAULT_LIMIT = 10;
const MIN_SIMILARITY = 0.6;
// En pendientes el pool es chico (~100): con el piso de 0.6 casi no queda nada, y lo útil
// es el orden relativo (verificado: "algo oscuro" → Lost Highway 0.62, Dark City 0.59…).
const MIN_SIMILARITY_PENDING = 0.5;

/**
 * POST /api/search/semantic
 * Body: { query: string, limit?: number, scope?: 'seen' | 'pending', offset?: number }
 * scope (Fase 2): 'pending' busca por sensación dentro de mi lista por ver ("¿Qué veo hoy?").
 */
async function semanticSearch(req, res) {
  const { query: searchQuery, limit, scope = "seen", offset } = req.body || {};
  const resultOffset = Number.isInteger(offset) && offset > 0 ? offset : 0;
  if (scope !== "seen" && scope !== "pending") {
    return res
      .status(400)
      .json({ error: 'El campo "scope" debe ser "seen" o "pending".' });
  }

  if (!searchQuery || typeof searchQuery !== "string" || !searchQuery.trim()) {
    return res
      .status(400)
      .json({ error: 'El campo "query" es requerido y no puede venir vacío.' });
  }

  const cleanQuery = searchQuery.trim();
  if (cleanQuery.length > 250) {
    return res
      .status(400)
      .json({ error: 'El campo "query" no puede superar los 250 caracteres.' });
  }

  const resultLimit =
    Number.isInteger(limit) && limit > 0 ? Math.min(limit, 50) : DEFAULT_LIMIT;

  try {
    const embedding = await generateMovieEmbedding(cleanQuery);
    const vectorLiteral = JSON.stringify(embedding);

    const sql = `
            SELECT id, tmdb_id, title, overview, poster_path, release_year, director, genres,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM movies
            WHERE status = $4
                AND 1 - (embedding <=> $1::vector) > $3
            ORDER BY embedding <=> $1::vector ASC, id
            LIMIT $2 OFFSET $5;
        `;
    const { rows } = await query(sql, [
      vectorLiteral,
      resultLimit + 1, // la fila extra solo dice si hay más páginas
      scope === "pending" ? MIN_SIMILARITY_PENDING : MIN_SIMILARITY,
      scope,
      resultOffset,
    ]);

    return res
      .status(200)
      .json({
        query: searchQuery,
        count: Math.min(rows.length, resultLimit),
        hasMore: rows.length > resultLimit,
        results: rows.slice(0, resultLimit),
      });
  } catch (err) {
    console.error("❌ Error en semanticSearch:", err.message);
    return res
      .status(500)
      .json({ error: "Error al ejecutar la búsqueda semántica." });
  }
}

module.exports = { semanticSearch };
