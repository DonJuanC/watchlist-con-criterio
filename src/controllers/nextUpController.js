// src/controllers/nextUpController.js
// Fase 2: "¿Qué veo hoy?" — de mi lista de pendientes, las que mejor encajan con lo que
// marqué 🟢. Score = promedio de la similitud con las 3 🟢 más parecidas; las 2 más
// parecidas se devuelven como razón ("porque te gustó X").

const { query } = require("../db");

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;
const ANCHORS_FOR_SCORE = 3; // 🟢 que promedian el score
const REASONS_SHOWN = 2; // 🟢 que se muestran como razón

/**
 * GET /api/recommend/next?limit=6&offset=0&mode=affinity|director
 * Respuesta: { mode, results: [{ node, score, because: [{ id, title, rating? }] }], hasMore }
 * offset pagina el mismo ranking ("Otras opciones": 7–12, 13–18…).
 */
async function getNextUp(req, res) {
  const limit = Math.min(
    Math.max(Number(req.query.limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
  const mode = req.query.mode === "director" ? "director" : "affinity";

  try {
    let rows;

    if (mode === "director") {
      // Obras pendientes dirigidas por autores de los que ya has visto películas en tu archivo
      const result = await query(
        `WITH director_matches AS (
           SELECT p.id, p.tmdb_id, p.title, p.release_year, p.poster_path, p.director,
                  p.genres[1] AS main_genre,
                  COUNT(s.id) as seen_count,
                  json_agg(json_build_object('id', s.id, 'title', s.title, 'rating', s.rating)
                           ORDER BY s.rating DESC NULLS LAST, s.release_year DESC) as because
           FROM movies p
           JOIN movies s ON s.director = p.director AND s.status = 'seen'
           WHERE p.status = 'pending' AND p.director IS NOT NULL
           GROUP BY p.id
         )
         SELECT id, tmdb_id, title, release_year, poster_path, director, main_genre,
                seen_count AS score, because
         FROM director_matches
         ORDER BY score DESC, release_year DESC
         LIMIT $1 OFFSET $2`,
        [limit + 1, offset],
      );
      rows = result.rows;
    } else {
      // Afinidad semántica: de mi lista de pendientes, las que mejor encajan con lo que marqué 🟢
      const result = await query(
        `WITH anchors AS (
           SELECT id, title, embedding FROM movies
           WHERE status = 'seen' AND recommend = 1 AND embedding IS NOT NULL
         ),
         pairs AS (
           SELECT p.id, a.id AS anchor_id, a.title AS anchor_title,
                  1 - (p.embedding <=> a.embedding) AS sim,
                  ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY p.embedding <=> a.embedding) AS rk
           FROM movies p CROSS JOIN anchors a
           WHERE p.status = 'pending' AND p.embedding IS NOT NULL
         )
         SELECT m.id, m.tmdb_id, m.title, m.release_year, m.poster_path, m.director,
                m.genres[1] AS main_genre,
                AVG(pr.sim) FILTER (WHERE pr.rk <= $1) AS score,
                json_agg(json_build_object('id', pr.anchor_id, 'title', pr.anchor_title)
                         ORDER BY pr.rk) FILTER (WHERE pr.rk <= $2) AS because
         FROM pairs pr JOIN movies m ON m.id = pr.id
         GROUP BY m.id
         ORDER BY score DESC, m.id
         LIMIT $3 OFFSET $4`,
        [ANCHORS_FOR_SCORE, REASONS_SHOWN, limit + 1, offset],
      );
      rows = result.rows;
    }

    return res.status(200).json({
      mode,
      hasMore: rows.length > limit,
      results: rows.slice(0, limit).map(({ score, because, ...node }) => ({
        node,
        score: Math.round(Number(score) * 1000) / 1000,
        because,
      })),
    });
  } catch (err) {
    console.error("❌ Error en getNextUp:", err.message);
    return res.status(500).json({ error: "No se pudo armar la lista de qué ver." });
  }
}

module.exports = { getNextUp };
