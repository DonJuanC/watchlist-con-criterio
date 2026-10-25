// src/controllers/moviesController.js
// CINE-10b: ficha completa de una película. Se pide solo al abrirla, así /api/graph
// sigue liviano (no carga 295 sinopsis de golpe).

const { query } = require("../db");

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
                    status, recommend, rating, review
             FROM movies
             WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Película no encontrada." });
    }
    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error("❌ Error en getMovieById:", err.message);
    return res.status(500).json({ error: "Error al obtener la película." });
  }
}

module.exports = { getMovieById };
