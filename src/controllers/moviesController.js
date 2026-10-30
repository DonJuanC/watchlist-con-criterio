// src/controllers/moviesController.js
// CINE-10b: ficha completa de una película. Se pide solo al abrirla, así /api/graph
// sigue liviano (no carga 295 sinopsis de golpe).

const { query } = require("../db");
const { searchMovies } = require("../services/tmdb");
/**
 * GET /api/movies/:id
 * Devuelve la ficha de una película del catálogo, incluido el criterio personal.
 */
async function getMovieById(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res
      .status(400)
      .json({ error: "El id debe ser un entero positivo." });
  }

  try {
    const { rows } = await query(
      `SELECT id, tmdb_id, display_title AS title, original_title, title_es,
                    release_year, poster_path, director, cinematographer, genres, overview,
                    status, recommend, rating, review,
                    imdb_id, rt_score, imdb_rating, metascore
             FROM movies
             WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Película no encontrada." });
    }
    res.setHeader(
      "Cache-Control",
      "public, max-age=3600, stale-while-revalidate=86400",
    );
    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error("❌ Error en getMovieById:", err.message);
    return res.status(500).json({ error: "Error al obtener la película." });
  }
}

/**
 * GET /api/movies/search?q=texto
 * Resultados de TMDB, marcando cuáles ya están en el catálogo.
 * Respuesta: { results: [{ tmdb_id, title, release_year, poster_path, in_catalog: { id, status } | null }] }
 */
async function searchExternal(req, res) {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    return res.status(400).json({ error: "Escribe al menos 2 caracteres." });
  }

  try {
    const results = await searchMovies(q);
    if (results.length === 0) return res.status(200).json({ results: [] });

    const { rows } = await query(
      `SELECT id, tmdb_id, status FROM movies WHERE tmdb_id = ANY($1::int[])`,
      [results.map((r) => r.tmdb_id)],
    );
    const byTmdb = new Map(
      rows.map((r) => [r.tmdb_id, { id: r.id, status: r.status }]),
    );

    return res.status(200).json({
      results: results.map((r) => ({
        ...r,
        in_catalog: byTmdb.get(r.tmdb_id) ?? null,
      })),
    });
  } catch (err) {
    console.error("❌ Error en searchExternal:", err.message);
    return res.status(502).json({ error: "No se pudo buscar en TMDB." });
  }
}

module.exports = { getMovieById, searchExternal };
