// src/controllers/nextUpController.js
// "¿Qué veo hoy?": la versión amplia de "Sorpréndeme". Mismos ánimos, mismas fuentes, pero en
// lista y filtrable por las plataformas del visitante.
//
// Fuentes:
//  - archive (por defecto): las que vi y recomiendo (🟢 y 🟡). Sin ánimo, 🟢 primero y un
//    orden que cambia cada día; con ánimo, por cercanía a ese ánimo.
//  - radar: mis pendientes. Sin ánimo, por afinidad con mis 🟢 (con la razón: "porque me
//    gustó X"); con ánimo, por cercanía a ese ánimo.
//  - beyond: fuera de mi archivo (TMDB a partir de mis películas, re-rankeado; ver beyond.js).
//
// Filtro de disponibilidad (country + avail): en SQL sobre watch_availability para el catálogo;
// para "beyond", consulta por película (caché en memoria de availability.js).

const { query } = require("../db");
const { parseExclude } = require("../services/neighborRanking");
const { beyondFromSeeds } = require("../services/beyond");
const { getAvailability } = require("../services/availability");
const { MOOD_GENRES, GENRE_BOOST, GREEN_BOOST, parseMood, moodVector } = require("../services/moods");

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;
const ANCHORS_FOR_SCORE = 3; // 🟢 que promedian el score de afinidad
const REASONS_SHOWN = 2; // 🟢 que se muestran como razón
const MOOD_MAX = 48; // con ánimo, más allá de las 48 más cercanas ya no se parece al ánimo
const BEYOND_SEEDS = 6;
const BEYOND_MAX = 24;
const MAX_PROVIDER_KEYS = 30;
const SOURCES = new Set(["archive", "radar", "beyond"]);

const FIELDS = `m.id, m.tmdb_id, m.title, m.release_year, m.poster_path, m.director,
                m.genres[1] AS main_genre, m.rating, m.recommend, m.review, m.overview,
                m.rt_score, m.imdb_rating`;

/** País y plataformas pedidos: { country, avail: "mine"|"any"|null, keys } o null sin país. */
function parseAvailability(q) {
  const country = String(q.country || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return null;
  const keys = String(q.providers || "")
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k && k.length <= 60)
    .slice(0, MAX_PROVIDER_KEYS);
  const avail = q.avail === "any" ? "any" : q.avail === "mine" && keys.length ? "mine" : null;
  return { country, avail, keys };
}

/**
 * Fragmentos SQL del filtro para la película `m`, con parámetros numerados desde `start`.
 * `select` agrega `stream` (null = aún no consultada); `where` filtra si hay `avail`.
 */
function availabilitySql(av, start) {
  if (!av) return { select: "", where: "", params: [] };
  const c = `$${start}`;
  const params = [av.country];
  const select = `, CASE WHEN EXISTS (SELECT 1 FROM watch_fetched f WHERE f.tmdb_id = m.tmdb_id)
         THEN COALESCE((SELECT w.stream FROM watch_availability w
                        WHERE w.tmdb_id = m.tmdb_id AND w.country = ${c}), '[]'::jsonb)
         END AS stream`;
  let where = "";
  if (av.avail === "any") {
    where = `AND EXISTS (SELECT 1 FROM watch_availability w WHERE w.tmdb_id = m.tmdb_id
                AND w.country = ${c} AND cardinality(w.stream_keys) > 0)`;
  } else if (av.avail === "mine") {
    params.push(av.keys);
    where = `AND EXISTS (SELECT 1 FROM watch_availability w WHERE w.tmdb_id = m.tmdb_id
                AND w.country = ${c} AND w.stream_keys && $${start + 1}::text[])`;
  }
  return { select, where, params };
}

/** Catálogo (archive / radar), con o sin ánimo. Devuelve limit + 1 filas para saber si hay más. */
async function fromCatalog({ source, mood, limit, offset, exclude, av }) {
  const status = source === "radar" ? "pending" : "seen";
  // Lo que recomiendo: 🟢 y 🟡. Las pendientes no tienen calificación.
  const recommended = source === "archive" ? "AND m.recommend IN (0, 1)" : "";

  if (mood) {
    const vec = await moodVector(mood);
    const f = availabilitySql(av, 8);
    const moodLimit = Math.max(0, Math.min(limit + 1, MOOD_MAX - offset));
    const { rows } = await query(
      `SELECT ${FIELDS} ${f.select},
              1 - (m.embedding <=> $1::vector)
                + CASE WHEN m.recommend = 1 THEN $2::float8 ELSE 0 END
                + CASE WHEN m.genres && $3::text[] THEN $4::float8 ELSE 0 END AS score
       FROM movies m
       WHERE m.status = '${status}' AND m.embedding IS NOT NULL ${recommended}
         AND NOT (m.id = ANY($5::int[])) ${f.where}
       ORDER BY score DESC, m.id
       LIMIT $6 OFFSET $7`,
      [vec, GREEN_BOOST, MOOD_GENRES[mood], GENRE_BOOST, exclude, moodLimit, offset, ...f.params],
    );
    return rows;
  }

  if (source === "archive") {
    // 🟢 antes que 🟡, las de 4–5 estrellas antes; dentro de cada grupo, un orden que cambia
    // cada día (md5 del id + la fecha): "¿Qué veo hoy?" no muestra lo mismo todos los días.
    const f = availabilitySql(av, 4);
    const { rows } = await query(
      `SELECT ${FIELDS} ${f.select}
       FROM movies m
       WHERE m.status = 'seen' ${recommended} AND NOT (m.id = ANY($1::int[])) ${f.where}
       ORDER BY (m.recommend = 1) DESC, (COALESCE(m.rating, 0) >= 4) DESC,
                md5(m.id::text || CURRENT_DATE::text)
       LIMIT $2 OFFSET $3`,
      [exclude, limit + 1, offset, ...f.params],
    );
    return rows;
  }

  // radar sin ánimo: afinidad con lo que marqué 🟢 (promedio de las 3 más parecidas).
  const f = availabilitySql(av, 6);
  const { rows } = await query(
    `WITH anchors AS (
       SELECT id, title, embedding FROM movies
       WHERE status = 'seen' AND recommend = 1 AND embedding IS NOT NULL
     ),
     pairs AS (
       SELECT m.id, a.id AS anchor_id, a.title AS anchor_title,
              1 - (m.embedding <=> a.embedding) AS sim,
              ROW_NUMBER() OVER (PARTITION BY m.id ORDER BY m.embedding <=> a.embedding) AS rk
       FROM movies m CROSS JOIN anchors a
       WHERE m.status = 'pending' AND m.embedding IS NOT NULL
         AND NOT (m.id = ANY($5::int[])) ${f.where}
     )
     SELECT ${FIELDS} ${f.select},
            AVG(pr.sim) FILTER (WHERE pr.rk <= $1) AS score,
            json_agg(json_build_object('id', pr.anchor_id, 'title', pr.anchor_title)
                     ORDER BY pr.rk) FILTER (WHERE pr.rk <= $2) AS because
     FROM pairs pr JOIN movies m ON m.id = pr.id
     GROUP BY m.id
     ORDER BY score DESC, m.id
     LIMIT $3 OFFSET $4`,
    [ANCHORS_FOR_SCORE, REASONS_SHOWN, limit + 1, offset, exclude, ...f.params],
  );
  return rows;
}

// "Más allá": mismo cálculo que Sorpréndeme, pero la lista entera. Caché corta para que
// "Otras opciones" pagine sobre la misma lista y no repita el costo de TMDB y Gemini.
const BEYOND_TTL_MS = 30 * 60 * 1000;
const beyondCache = new Map(); // `${mood}|${exclude}` -> { at, list }

async function beyondList(mood, excludeExt) {
  const key = `${mood || ""}|${[...excludeExt].sort().join(",")}`;
  const hit = beyondCache.get(key);
  if (hit && Date.now() - hit.at < BEYOND_TTL_MS) return hit.list;

  let seeds;
  if (mood) {
    const vec = await moodVector(mood);
    ({ rows: seeds } = await query(
      `SELECT m.tmdb_id FROM movies m
       WHERE m.status = 'seen' AND m.embedding IS NOT NULL AND m.tmdb_id IS NOT NULL
         AND COALESCE(m.recommend, 0) <> -1
       ORDER BY 1 - (m.embedding <=> $1::vector)
                + CASE WHEN m.recommend = 1 THEN $2::float8 ELSE 0 END
                + CASE WHEN m.genres && $3::text[] THEN $4::float8 ELSE 0 END DESC
       LIMIT $5`,
      [vec, GREEN_BOOST, MOOD_GENRES[mood], GENRE_BOOST, BEYOND_SEEDS],
    ));
  } else {
    // Sin ánimo: 6 de mis 🟢, distintas cada día.
    ({ rows: seeds } = await query(
      `SELECT tmdb_id FROM movies
       WHERE status = 'seen' AND recommend = 1 AND tmdb_id IS NOT NULL
       ORDER BY md5(id::text || CURRENT_DATE::text)
       LIMIT $1`,
      [BEYOND_SEEDS],
    ));
  }
  const refVector = mood ? JSON.parse(await moodVector(mood)) : null;
  const ranked = await beyondFromSeeds(
    seeds.map((r) => r.tmdb_id),
    excludeExt,
    { refVector },
  );
  const list = ranked.slice(0, BEYOND_MAX).map((r) => ({
    node: { ...r.movie, external: true },
    because: r.because,
  }));
  beyondCache.set(key, { at: Date.now(), list });
  if (beyondCache.size > 50) beyondCache.delete(beyondCache.keys().next().value);
  return list;
}

/** Agrega `stream` a cada película de fuera y filtra según av. */
async function withExternalAvailability(items, av) {
  if (!av) return items;
  const out = await Promise.all(
    items.map(async (it) => {
      try {
        const a = await getAvailability(it.node.tmdb_id, av.country);
        return { ...it, node: { ...it.node, stream: a.stream } };
      } catch {
        return { ...it, node: { ...it.node, stream: null } };
      }
    }),
  );
  if (av.avail === "any") return out.filter((it) => it.node.stream?.length);
  if (av.avail === "mine") {
    return out.filter((it) => it.node.stream?.some((p) => av.keys.includes(p.key)));
  }
  return out;
}

/**
 * GET /api/recommend/next
 *   ?source=archive|radar|beyond  &mood=pensar|reir|…  &limit=12&offset=0
 *   [&country=CO&avail=mine&providers=netflix,hbo max | &country=CO&avail=any]
 *   [&exclude=1,2 (ids del catálogo) &exclude_ext=603 (tmdb_id): lo que el visitante ya vio]
 * Respuesta: { source, mood, results: [{ node, because? }], hasMore }
 *   node.stream: plataformas de suscripción en `country` (null si aún no se consultó).
 *   node.external: true en "beyond" (no está en mi catálogo).
 */
async function getNextUp(req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
  const source = SOURCES.has(req.query.source) ? req.query.source : "archive";
  const mood = parseMood(req.query.mood);
  const av = parseAvailability(req.query);

  try {
    if (source === "beyond") {
      const list = await withExternalAvailability(
        await beyondList(mood, parseExclude(req.query.exclude_ext)),
        av,
      );
      return res.status(200).json({
        source,
        mood,
        hasMore: list.length > offset + limit,
        results: list.slice(offset, offset + limit),
      });
    }

    const rows = await fromCatalog({
      source,
      mood,
      limit,
      offset,
      exclude: [...parseExclude(req.query.exclude)],
      av,
    });
    const hasMore = rows.length > limit && (!mood || offset + limit < MOOD_MAX);
    return res.status(200).json({
      source,
      mood,
      hasMore,
      results: rows.slice(0, limit).map(({ score, because, ...node }) => ({
        node,
        because: because ?? undefined,
      })),
    });
  } catch (err) {
    console.error("❌ Error en getNextUp:", err.message);
    return res.status(500).json({ error: "No se pudo armar la lista de qué ver." });
  }
}

module.exports = { getNextUp };
