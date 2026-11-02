// src/controllers/directorsController.js
// Devuelve la filmografía completa de un director consultando TMDB y
// cruzándola con las obras existentes en la base de datos de Cine con Criterio.

const { query } = require("../db");
const { getDirectorFilmographyFromTmdb } = require("../services/tmdb");

/**
 * GET /api/directors/:name/filmography
 * Devuelve:
 * {
 *   director: { id, name, profile_path },
 *   in_catalog: [ ...películas que el autor ha visto, con rating, review y recommend ],
 *   external: [ ...películas dirigidas en TMDB no incluidas en el catálogo ],
 *   total_tmdb: number
 * }
 */
async function getDirectorFilmography(req, res) {
  const name = String(req.params.name || "").trim();
  if (!name || name.length < 2) {
    return res.status(400).json({ error: "Nombre de director inválido." });
  }

  try {
    const tmdbData = await getDirectorFilmographyFromTmdb(name);
    if (!tmdbData.director) {
      return res.status(404).json({ error: "No se encontró el director en TMDB." });
    }

    const tmdbIds = tmdbData.movies.map((m) => m.tmdb_id);
    let inCatalogMap = new Map();

    if (tmdbIds.length > 0) {
      const { rows } = await query(
        `SELECT id, tmdb_id, display_title AS title, release_year, poster_path, rating, recommend, review, status
         FROM movies
         WHERE tmdb_id = ANY($1::int[])`,
        [tmdbIds]
      );
      inCatalogMap = new Map(rows.map((r) => [r.tmdb_id, r]));
    }

    const inCatalog = [];
    const external = [];

    for (const m of tmdbData.movies) {
      const cat = inCatalogMap.get(m.tmdb_id);
      if (cat) {
        inCatalog.push({
          ...m,
          id: cat.id,
          status: cat.status,
          rating: cat.rating,
          recommend: cat.recommend,
          review: cat.review,
          in_catalog: true,
        });
      } else {
        external.push({
          ...m,
          external: true,
        });
      }
    }

    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    return res.status(200).json({
      director: tmdbData.director,
      in_catalog: inCatalog,
      external: external,
      total_tmdb: tmdbData.movies.length,
    });
  } catch (err) {
    console.error("❌ Error en getDirectorFilmography:", err.message);
    return res.status(500).json({ error: "Error al obtener la filmografía del director." });
  }
}

module.exports = { getDirectorFilmography };
