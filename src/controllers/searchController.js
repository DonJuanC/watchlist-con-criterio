// src/controllers/searchController.js
// CINE-03: Búsqueda semántica vectorial (similitud coseno) contra la tabla movies.

const { query } = require('../db');
const { generateMovieEmbedding } = require('../services/embeddings');

const DEFAULT_LIMIT = 10;
const MIN_SIMILARITY = 0.6;

/**
 * POST /api/search/semantic
 * Body: { query: string, limit?: number }
 */
async function semanticSearch(req, res) {
    const { query: searchQuery, limit } = req.body || {};

    if (!searchQuery || typeof searchQuery !== 'string' || !searchQuery.trim()) {
        return res.status(400).json({ error: 'El campo "query" es requerido y no puede venir vacío.' });
    }

    const resultLimit = Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_LIMIT;

    try {
        const embedding = await generateMovieEmbedding(searchQuery.trim());
        const vectorLiteral = JSON.stringify(embedding);

        const sql = `
            SELECT id, tmdb_id, title, overview, poster_path, release_year, director, genres,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM movies
            WHERE 1 - (embedding <=> $1::vector) > $3
            ORDER BY embedding <=> $1::vector ASC
            LIMIT $2;
        `;
        const { rows } = await query(sql, [vectorLiteral, resultLimit, MIN_SIMILARITY]);

        return res.status(200).json({ query: searchQuery, count: rows.length, results: rows });
    } catch (err) {
        console.error('❌ Error en semanticSearch:', err.message);
        return res.status(500).json({ error: 'Error al ejecutar la búsqueda semántica.' });
    }
}

module.exports = { semanticSearch };
