// src/controllers/graphController.js
// CINE-03: Extracción de nodos y cálculo de enlaces (director + afinidad semántica).
//
// CINE-03B (calibración): el umbral fijo de similitud coseno > 0.78 daba 0 aristas
// semánticas con la muestra de 30 películas (sinopsis completas dispersan más el
// embedding que consultas cortas). Se reemplaza por k-NN: los 2 vecinos más
// cercanos de cada nodo, con un piso de 0.65 para no forzar conexiones débiles.

const { query } = require("../db");

const SEMANTIC_MIN_SIMILARITY = 0.65;
const SEMANTIC_TOP_K = 2;

/**
 * GET /api/graph
 * Devuelve { nodes: [...], links: [...] } para el grafo de conexiones.
 */
async function getGraph(req, res) {
  try {
    const nodesSql = `
            SELECT id, title, release_year, poster_path, director,
                   genres[1] AS main_genre
            FROM movies
            WHERE status = 'seen';
        `;

    const directorEdgesSql = `
            SELECT m1.id AS source, m2.id AS target, 'same_director' AS type, 2 AS weight
            FROM movies m1
            JOIN movies m2 ON m1.director = m2.director AND m1.id < m2.id
            WHERE m1.director IS NOT NULL
                AND m1.status = 'seen' AND m2.status = 'seen';
        `;

    // k-NN vía CROSS JOIN LATERAL: para cada película vista, sus SEMANTIC_TOP_K vecinos más
    // cercanos por distancia coseno.
    // CINE-10b: (1) la vecina #1 siempre entra aunque esté bajo el piso → ninguna película
    // queda aislada; (2) el par se normaliza con LEAST/GREATEST + DISTINCT ON, en vez del
    // viejo filtro m1.id < knn.id que descartaba pares válidos.
    const semanticEdgesSql = `
            WITH knn AS (
                SELECT m1.id AS a, k.id AS b,
                       1 - (m1.embedding <=> k.embedding) AS sim, k.rk
                FROM movies m1
                CROSS JOIN LATERAL (
                    SELECT m2.id, m2.embedding,
                           ROW_NUMBER() OVER (ORDER BY m1.embedding <=> m2.embedding) AS rk
                    FROM movies m2
                    WHERE m2.id <> m1.id AND m2.status = 'seen'
                    ORDER BY m1.embedding <=> m2.embedding
                    LIMIT $1
                ) k
                WHERE m1.status = 'seen'
            )
            SELECT DISTINCT ON (LEAST(a, b), GREATEST(a, b))
                   LEAST(a, b) AS source, GREATEST(a, b) AS target,
                   'semantic_similarity' AS type,
                   ROUND(sim::numeric, 3) AS weight
            FROM knn
            WHERE sim >= $2 OR rk = 1
            ORDER BY LEAST(a, b), GREATEST(a, b), sim DESC;
        `;

    const [nodesResult, directorEdgesResult, semanticEdgesResult] =
      await Promise.all([
        query(nodesSql),
        query(directorEdgesSql),
        query(semanticEdgesSql, [SEMANTIC_TOP_K, SEMANTIC_MIN_SIMILARITY]),
      ]);

    const links = [...directorEdgesResult.rows, ...semanticEdgesResult.rows];

    return res.status(200).json({
      nodes: nodesResult.rows,
      links,
    });
  } catch (err) {
    console.error("❌ Error en getGraph:", err.message);
    return res
      .status(500)
      .json({ error: "Error al construir el grafo de conexiones." });
  }
}

module.exports = { getGraph };
