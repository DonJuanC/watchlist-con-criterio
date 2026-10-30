// src/controllers/graphController.js
// CINE-03: Extracción de nodos y cálculo de enlaces (director + afinidad semántica).
// Fase 3: Caché en memoria del servidor con TTL de 1 hora + cabeceras HTTP Cache-Control
// para evitar recálculos vectoriales pesados en Neon en cada recarga.

const { query } = require("../db");

const SEMANTIC_MIN_SIMILARITY = 0.65;
const SEMANTIC_TOP_K = 2;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora de caché en memoria del proceso

let cachedGraph = null;
let lastCacheTime = 0;

function invalidateGraphCache() {
  cachedGraph = null;
  lastCacheTime = 0;
}

/**
 * GET /api/graph
 * Devuelve { nodes: [...], links: [...] } para el grafo de conexiones.
 */
async function getGraph(req, res) {
  const forceRefresh = req.query.refresh === "true";
  const now = Date.now();

  // Si está en caché y no expiró, responder de inmediato sin tocar la base de datos
  if (!forceRefresh && cachedGraph && now - lastCacheTime < CACHE_TTL_MS) {
    res.setHeader("Cache-Control", "public, max-age=1800, stale-while-revalidate=86400");
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json(cachedGraph);
  }

  try {
    const nodesSql = `
            SELECT id, title, release_year, poster_path, director,
                   genres[1] AS main_genre, rating, recommend, review
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
    const data = {
      nodes: nodesResult.rows,
      links,
    };

    // Actualiza caché en memoria
    cachedGraph = data;
    lastCacheTime = now;

    res.setHeader("Cache-Control", "public, max-age=1800, stale-while-revalidate=86400");
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(data);
  } catch (err) {
    console.error("❌ Error en getGraph:", err.message);
    return res
      .status(500)
      .json({ error: "Error al construir el grafo de conexiones." });
  }
}

module.exports = { getGraph, invalidateGraphCache };
