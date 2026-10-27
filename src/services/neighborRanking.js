// src/services/neighborRanking.js
// Fase 2: reglas de selección de vecinas compartidas por /movies/:id/neighbors y /recommend.
// Entradas ya filtradas por SQL (solo 'seen', sin 🔴). Aquí: 🟢 sube, tope de director,
// la película que es director + semántica cuenta en el cupo de director con ambas razones.

const MAX_DIRECTOR = 2; // tope de vecinas por mismo director
const GREEN_BOOST = 0.05; // 🟢 suma esto al score semántico

/**
 * @param {object} p
 * @param {Array} p.semanticRows  filas con `sim` (similitud coseno), ordenadas por cercanía
 * @param {Array} p.directorRows  filas del mismo director que el centro
 * @param {string|null} p.centerDirector
 * @param {number|null} p.centerYear
 * @param {number} p.limit
 * @returns {Array<{ node, type, weight, reasons }>}
 */
function pickNeighbors({
  semanticRows,
  directorRows,
  centerDirector,
  centerYear,
  limit,
}) {
  const toNode = ({ sim, ...node }) => node;
  const semById = new Map(semanticRows.map((r) => [r.id, Number(r.sim)]));
  const yearGap = (r) => Math.abs((r.release_year ?? 0) - (centerYear ?? 0));

  // Director: 🟢 primero, luego las que también son semánticas (más similares
  // primero), luego año más cercano.
  const director = [...directorRows].sort(
    (a, b) =>
      (b.recommend === 1) - (a.recommend === 1) ||
      (semById.get(b.id) ?? -1) - (semById.get(a.id) ?? -1) ||
      yearGap(a) - yearGap(b),
  );

  // Semántica: score = similitud + bonus 🟢.
  const score = (r) => Number(r.sim) + (r.recommend === 1 ? GREEN_BOOST : 0);
  const semantic = [...semanticRows].sort((a, b) => score(b) - score(a));

  const picked = [];
  const pickedIds = new Set();
  const pushDirector = (r) => {
    const reasons = semById.has(r.id)
      ? ["same_director", "semantic_similarity"]
      : ["same_director"];
    picked.push({ node: toNode(r), type: "same_director", weight: 1, reasons });
    pickedIds.add(r.id);
  };

  // 1) Cupo de director (máx. MAX_DIRECTOR, sin pasarse de limit).
  director.slice(0, Math.min(MAX_DIRECTOR, limit)).forEach(pushDirector);

  // 2) Semánticas hasta completar (las del mismo director solo entran por el cupo o el relleno).
  for (const r of semantic) {
    if (picked.length >= limit) break;
    if (pickedIds.has(r.id)) continue;
    if (centerDirector && r.director === centerDirector) continue;
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

  return picked;
}

module.exports = { pickNeighbors, MAX_DIRECTOR, GREEN_BOOST };
