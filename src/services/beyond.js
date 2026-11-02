// src/services/beyond.js
// "Fuera de mi archivo": cuando el visitante ya vio lo mío (o quiere ir más allá), se piden
// a TMDB las recomendaciones de películas semilla de mi archivo y se agregan.
//
// Precisión primero (opción B): TMDB solo propone candidatas. El orden final lo decide la
// similitud de embedding con la referencia (la película de partida, el ánimo o la consulta),
// con el mismo modelo y el mismo texto enriquecido que usa mi catálogo. Así Amélie deja de
// traer "To All the Boys…" solo porque TMDB las asocia por popularidad.
// Costo: los embeddings de candidatas se guardan en external_embeddings y cada request genera
// como máximo MAX_NEW_EMBEDS nuevos, dentro del presupuesto de relleno (ver embeddings.js).
// Lo que no alcanza a verificarse hoy no se muestra: queda para cuando se llene la caché.
// Nunca entra nada que ya esté en mi catálogo (visto o pendiente): eso ya tiene su lugar.

const { query } = require("../db");
const { getRecommendations, getMovieForEmbedding } = require("./tmdb");
const { ratingsFor, passesCriticFloor } = require("./externalRatings");
const {
  generateEmbeddings,
  buildMovieSemanticText,
  reserveBackgroundEmbeddings,
  pauseBackgroundEmbeddings,
} = require("./embeddings");

const MAX_SEEDS = 8;
// Piso de calidad y de votos: TMDB tira a lo popular y trae relleno.
const MIN_VOTES = 300;
const MIN_AVERAGE = 6.8;
const SECONDARY_WEIGHT = 0.4; // semillas de relleno (vecinas de mi archivo) pesan menos
const CANDIDATES = 24; // candidatas de TMDB que pasan al re-ranking semántico
const MAX_NEW_EMBEDS = 10; // embeddings nuevos por request, como máximo
// Corte de precisión. Referencia = película: piso absoluto, calibrado con mi catálogo
// (más allá de ~0.59 las vecinas dejan de parecerse; Amélie → Ninja Turtles 0.587).
// Referencia = texto (ánimo o consulta): las similitudes texto-película son más bajas,
// así que el corte es relativo a la mejor candidata.
const MIN_SIM_MOVIE = 0.59;
const TEXT_BAND = 0.06;
const TMDB_WEIGHT = 0.03; // el voto de TMDB solo desempata; manda la similitud
const DETAIL_CONCURRENCY = 6;

const parseVec = (text) => JSON.parse(text);
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
function centroid(vectors) {
  const out = new Array(vectors[0].length).fill(0);
  for (const v of vectors) for (let i = 0; i < v.length; i++) out[i] += v[i] / vectors.length;
  return out;
}

/** Embeddings guardados (catálogo o caché externa) por tmdb_id. */
async function storedEmbeddings(tmdbIds) {
  if (!tmdbIds.length) return new Map();
  const { rows } = await query(
    `SELECT tmdb_id, embedding::text AS e FROM movies
      WHERE tmdb_id = ANY($1::int[]) AND embedding IS NOT NULL
     UNION ALL
     SELECT tmdb_id, embedding::text AS e FROM external_embeddings WHERE tmdb_id = ANY($1::int[])`,
    [tmdbIds],
  );
  return new Map(rows.map((r) => [r.tmdb_id, parseVec(r.e)]));
}

/** Embeddings de candidatas nuevas: detalle de TMDB + un solo lote de Gemini, y a la caché. */
async function embedMissing(tmdbIds) {
  const details = [];
  for (let i = 0; i < tmdbIds.length; i += DETAIL_CONCURRENCY) {
    const chunk = await Promise.all(
      tmdbIds.slice(i, i + DETAIL_CONCURRENCY).map((id) => getMovieForEmbedding(id).catch(() => null)),
    );
    details.push(...chunk.filter((d) => d && d.overview));
  }
  if (!details.length) return new Map();

  // Mismo texto enriquecido que scripts/sync-notion.js y recommendController (comparables).
  const vectors = await generateEmbeddings(
    details.map((d) =>
      buildMovieSemanticText({
        title: d.title_es || d.display_title,
        director: d.director,
        genres: d.genres,
        overview: d.overview,
      }),
    ),
  );
  const out = new Map();
  await Promise.all(
    details.map((d, i) => {
      out.set(d.tmdb_id, vectors[i]);
      return query(
        `INSERT INTO external_embeddings (tmdb_id, title, release_year, poster_path, director, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)
         ON CONFLICT (tmdb_id) DO NOTHING`,
        [d.tmdb_id, d.display_title, d.release_year, d.poster_path, d.director, `[${vectors[i].join(",")}]`],
      ).catch(() => null);
    }),
  );
  return out;
}

/**
 * @param {number[]} seedTmdbIds  películas de partida (tmdb_id)
 * @param {Set<number>} excludeTmdb  tmdb_id que no deben salir (vistas por el visitante, ya mostradas)
 * @param {object} [opts]
 * @param {number} [opts.primaryCount]  las primeras N semillas son las pedidas; el resto es relleno
 * @param {number[]|null} [opts.refVector]  referencia semántica (ánimo o consulta). Si falta,
 *   se usa el centroide de las semillas principales.
 * @returns {Promise<Array<{ movie, because: Array<{ tmdb_id, title, id }>, score, sim }>>} ordenadas
 */
async function beyondFromSeeds(seedTmdbIds, excludeTmdb = new Set(), opts = {}) {
  return applyCriticFloor(await rankCandidates(seedTmdbIds, excludeTmdb, opts));
}

/**
 * Piso de crítica (ver externalRatings.js). Lo que hoy no se pudo verificar (cuota de OMDb)
 * no sale: precisión primero; queda para cuando su nota esté en la base.
 * Las notas viajan en `movie` para que el frontend no tenga que volver a pedirlas.
 */
async function applyCriticFloor(ranked) {
  if (!ranked.length) return ranked;
  const ratings = await ratingsFor(ranked.map((c) => c.movie.tmdb_id));
  return ranked
    .filter((c) => passesCriticFloor(ratings.get(c.movie.tmdb_id)))
    .map((c) => {
      const r = ratings.get(c.movie.tmdb_id);
      return { ...c, movie: { ...c.movie, rt_score: r.rt_score, imdb_rating: r.imdb_rating } };
    });
}

async function rankCandidates(seedTmdbIds, excludeTmdb, opts) {
  const { primaryCount = Infinity, refVector = null } = opts;
  const seeds = [...new Set(seedTmdbIds)].filter((n) => Number.isInteger(n) && n > 0).slice(0, MAX_SEEDS);
  if (!seeds.length) return [];

  const [lists, catalog] = await Promise.all([
    Promise.all(seeds.map((id) => getRecommendations(id).catch(() => []))),
    query(`SELECT id, tmdb_id, title FROM movies WHERE tmdb_id IS NOT NULL`),
  ]);
  const inCatalog = new Map(catalog.rows.map((r) => [r.tmdb_id, r]));

  // 1) Candidatas de TMDB: afinidad (cuántas semillas, qué tan arriba) × calidad.
  const agg = new Map(); // tmdb_id -> { movie, score, because }
  lists.forEach((items, s) => {
    const seed = inCatalog.get(seeds[s]);
    const weight = s < primaryCount ? 1 : SECONDARY_WEIGHT;
    items.forEach((m, rank) => {
      if (inCatalog.has(m.tmdb_id) || excludeTmdb.has(m.tmdb_id) || seeds.includes(m.tmdb_id)) return;
      if ((m.vote_count || 0) < MIN_VOTES || (m.vote_average || 0) < MIN_AVERAGE) return;
      const entry = agg.get(m.tmdb_id) ?? { movie: m, score: 0, because: [] };
      entry.score += weight * (1 - rank / (items.length + 1));
      if (seed && entry.because.length < 2) {
        entry.because.push({ tmdb_id: seed.tmdb_id, id: seed.id, title: seed.title });
      }
      agg.set(m.tmdb_id, entry);
    });
  });
  const quality = (m) => ((m.vote_average ?? 0) - 5) / 5;
  const candidates = [...agg.values()]
    .map((e) => ({ ...e, score: e.score * (0.5 + quality(e.movie)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATES);
  if (!candidates.length) return [];

  // 2) Referencia semántica.
  let ref = refVector;
  if (!ref) {
    const primary = seeds.slice(0, Math.min(primaryCount, seeds.length));
    const seedVecs = await storedEmbeddings(primary);
    ref = seedVecs.size ? centroid([...seedVecs.values()]) : null;
  }
  if (!ref) return candidates.map((c) => ({ ...c, sim: null })); // sin referencia: orden TMDB

  // 3) Embeddings de las candidatas (caché primero, el resto en un lote) y re-ranking.
  const ids = candidates.map((c) => c.movie.tmdb_id);
  const vecs = await storedEmbeddings(ids);
  const missing = ids.filter((id) => !vecs.has(id));
  const allowed = reserveBackgroundEmbeddings(Math.min(missing.length, MAX_NEW_EMBEDS));
  if (allowed > 0) {
    try {
      for (const [id, v] of await embedMissing(missing.slice(0, allowed))) vecs.set(id, v);
    } catch (err) {
      if (String(err.message).includes("429")) pauseBackgroundEmbeddings();
      console.error("⚠️ beyond: no se pudieron generar embeddings:", err.message.slice(0, 120));
    }
  }
  // Sin nada verificable (caché vacía y sin cupo de Gemini): orden de TMDB, mejor que nada.
  if (!ids.some((id) => vecs.has(id))) return candidates.map((c) => ({ ...c, sim: null }));
  const maxScore = Math.max(...candidates.map((c) => c.score)) || 1;
  const scored = candidates
    .filter((c) => vecs.has(c.movie.tmdb_id)) // sin sinopsis no hay con qué comparar
    .map((c) => {
      const sim = cosine(ref, vecs.get(c.movie.tmdb_id));
      return { ...c, sim, score: sim + TMDB_WEIGHT * (c.score / maxScore) };
    });
  if (!scored.length) return [];
  const topSim = Math.max(...scored.map((c) => c.sim));
  const floor = refVector ? topSim - TEXT_BAND : MIN_SIM_MOVIE;
  return scored.filter((c) => c.sim >= floor).sort((a, b) => b.score - a.score);
}

module.exports = { beyondFromSeeds };
