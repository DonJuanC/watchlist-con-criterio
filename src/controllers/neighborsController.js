// src/controllers/neighborsController.js
// Fase 2 · Bloque B: vecinas del ego view con criterio.
// Se calculan aquí (no desde /api/graph) para no depender del top-2 k-NN del mapa:
// 🔴 nunca es vecina, 🟢 sube en el ranking semántico, director con tope.

const { query } = require("../db");
const { pickNeighbors } = require("../services/neighborRanking");

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;
const SEMANTIC_POOL = 20; // candidatas semánticas antes de rankear
const NODE_FIELDS = `m.id, m.title, m.release_year, m.poster_path, m.director,
                     m.genres[1] AS main_genre, m.recommend, m.rating`;

/**
 * GET /api/movies/:id/neighbors?limit=6
 * Respuesta: { centerId, neighbors: [{ node, type, weight, reasons }] }
 *  - type: 'same_director' | 'semantic_similarity' (el que define el cupo)
 *  - weight: similitud coseno real (semántica) o 1 (director)
 *  - reasons: todas las razones del vínculo, p. ej. ['same_director', 'semantic_similarity']
 */
async function getNeighbors(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res
      .status(400)
      .json({ error: "El id debe ser un entero positivo." });
  }
  const limit = Math.min(
    Math.max(Number(req.query.limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  try {
    const centerResult = await query(
      `SELECT id, director, release_year FROM movies
       WHERE id = $1 AND status = 'seen' AND embedding IS NOT NULL`,
      [id],
    );
    if (centerResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Película no encontrada en el catálogo visto." });
    }
    const center = centerResult.rows[0];

    const [semResult, dirResult] = await Promise.all([
      query(
        `SELECT ${NODE_FIELDS},
                1 - (m.embedding <=> c.embedding) AS sim
         FROM movies m, (SELECT embedding FROM movies WHERE id = $1) c
         WHERE m.id <> $1 AND m.status = 'seen' AND m.embedding IS NOT NULL
           AND COALESCE(m.recommend, 0) <> -1
         ORDER BY m.embedding <=> c.embedding
         LIMIT $2`,
        [id, SEMANTIC_POOL],
      ),
      center.director
        ? query(
            `SELECT ${NODE_FIELDS}
             FROM movies m
             WHERE m.director = $1 AND m.id <> $2 AND m.status = 'seen'
               AND COALESCE(m.recommend, 0) <> -1`,
            [center.director, id],
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const picked = pickNeighbors({
      semanticRows: semResult.rows,
      directorRows: dirResult.rows,
      centerDirector: center.director,
      centerYear: center.release_year,
      limit,
    });

    res.setHeader("Cache-Control", "public, max-age=1800, stale-while-revalidate=86400");
    return res.status(200).json({ centerId: id, neighbors: picked });
  } catch (err) {
    console.error("❌ Error en getNeighbors:", err.message);
    return res.status(500).json({ error: "Error al calcular las vecinas." });
  }
}

module.exports = { getNeighbors };
