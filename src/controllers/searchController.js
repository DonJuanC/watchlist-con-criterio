// src/controllers/searchController.js
// CINE-03: Búsqueda semántica vectorial (similitud coseno) contra la tabla movies.

const { query } = require("../db");
const { generateMovieEmbedding } = require("../services/embeddings");

const DEFAULT_LIMIT = 10;
// Umbral de similitud coseno calibrado para gemini-embedding-001 (768 dimensiones).
// Con textos semánticos enriquecidos (título, director, géneros, sinopsis y reseñas personales),
// consultas breves ("amor", "comedia", "acción") o frases conversacionales
// ("me quiero sentir alegre") generan similitudes naturales en el rango 0.46–0.58.
// El umbral anterior de 0.60 filtraba el 100% de estas búsquedas legítimas.
const MIN_SIMILARITY = 0.45;
const MIN_SIMILARITY_PENDING = 0.45;
const FALLBACK_MIN_SIMILARITY = 0.40;

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
    let { rows } = await query(sql, [
      vectorLiteral,
      resultLimit + 1, // la fila extra solo dice si hay más páginas
      scope === "pending" ? MIN_SIMILARITY_PENDING : MIN_SIMILARITY,
      scope,
      resultOffset,
    ]);

    // Fallback: si una búsqueda abstracta o de una sola palabra no supera el umbral base en offset 0,
    // relajamos levemente a 0.40 para evitar pantallas vacías frustrantes para el usuario
    if (rows.length === 0 && resultOffset === 0) {
      const fallback = await query(sql, [
        vectorLiteral,
        resultLimit + 1,
        FALLBACK_MIN_SIMILARITY,
        scope,
        0,
      ]);
      rows = fallback.rows;
    }

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
