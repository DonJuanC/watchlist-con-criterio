// src/controllers/neighborsController.js
// Fase 2 · Bloque B: vecinas del ego view con criterio.
// Se calculan aquí (no desde /api/graph) para no depender del top-2 k-NN del mapa:
// 🔴 nunca es vecina, 🟢 sube en el ranking semántico, director con tope.

const { query } = require("../db");

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;
const SEMANTIC_POOL = 20; // candidatas semánticas antes de rankear
const MAX_DIRECTOR = 2; // tope de vecinas por mismo director
const GREEN_BOOST = 0.05; // 🟢 suma esto al score semántico

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

    const toNode = ({ sim, ...node }) => node;
    const semById = new Map(semResult.rows.map((r) => [r.id, Number(r.sim)]));
    const yearGap = (r) =>
      Math.abs((r.release_year ?? 0) - (center.release_year ?? 0));

    // Director: 🟢 primero, luego las que también son semánticas (más similares
    // primero), luego año más cercano.
    const director = [...dirResult.rows].sort(
      (a, b) =>
        (b.recommend === 1) - (a.recommend === 1) ||
        (semById.get(b.id) ?? -1) - (semById.get(a.id) ?? -1) ||
        yearGap(a) - yearGap(b),
    );

    // Semántica: score = similitud + bonus 🟢.
    const score = (r) => Number(r.sim) + (r.recommend === 1 ? GREEN_BOOST : 0);
    const semantic = [...semResult.rows].sort((a, b) => score(b) - score(a));

    const picked = [];
    const pickedIds = new Set();
    const pushDirector = (r) => {
      const reasons = semById.has(r.id)
        ? ["same_director", "semantic_similarity"]
        : ["same_director"];
      picked.push({
        node: toNode(r),
        type: "same_director",
        weight: 1,
        reasons,
      });
      pickedIds.add(r.id);
    };

    // 1) Cupo de director (máx. MAX_DIRECTOR, sin pasarse de limit).
    director.slice(0, Math.min(MAX_DIRECTOR, limit)).forEach(pushDirector);

    // 2) Semánticas hasta completar.
    for (const r of semantic) {
      if (picked.length >= limit) break;
      if (pickedIds.has(r.id)) continue;
      if (center.director && r.director === center.director) continue;
      picked.push({
        node: toNode(r),
        type: "semantic_similarity",
        weight: Math.round(Number(r.sim) * 1000) / 1000,
        reasons: ["semantic_similarity"],
      });
      pickedIds.add(r.id);
    }

    // 3) Si faltan, relleno con más del mismo director.
    for (const r of director) {
      if (picked.length >= limit) break;
      if (!pickedIds.has(r.id)) pushDirector(r);
    }

    return res.status(200).json({ centerId: id, neighbors: picked });
  } catch (err) {
    console.error("❌ Error en getNeighbors:", err.message);
    return res.status(500).json({ error: "Error al calcular las vecinas." });
  }
}

module.exports = { getNeighbors };
