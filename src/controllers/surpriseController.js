// src/controllers/surpriseController.js
// "Sorpréndeme": UNA película de mi archivo para quien llega sin saber qué ver.
// - Sin ánimo: al azar entre mis 🟢, con más peso a las de mejor nota.
// - Con ánimo (preset): las 8 vistas (sin 🔴) más cercanas a ese ánimo, 🟢 primero; al azar
//   entre ellas, con más peso a las más cercanas.
// Los ánimos viven en src/services/moods.js (los comparte "¿Qué veo hoy?").

const { query } = require("../db");
const { parseExclude } = require("../services/neighborRanking");
const { beyondFromSeeds } = require("../services/beyond");
const {
  MOODS,
  MOOD_GENRES,
  GENRE_BOOST,
  GREEN_BOOST,
  parseMood,
  moodVector,
} = require("../services/moods");

const BEYOND_SEEDS = 6; // semillas de mi archivo para "fuera de mi archivo"
const BEYOND_POOL = 8; // se sortea entre las 8 más cercanas al ánimo
const MOOD_POOL = 8;

const FIELDS = `id, tmdb_id, title, release_year, poster_path, director, genres[1] AS main_genre,
                rating, recommend, review, overview, rt_score, imdb_rating`;

/** Elige un índice al azar con pesos. */
function weightedPick(items, weightOf) {
  const weights = items.map(weightOf);
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Candidatas de mi archivo para un ánimo (o mis 🟢 si no hay ánimo), sin las excluidas. */
async function archivePool(mood, exclude) {
  let rows;
  if (!mood) {
    ({ rows } = await query(
      `SELECT ${FIELDS} FROM movies
       WHERE status = 'seen' AND recommend = 1 AND NOT (id = ANY($1::int[]))`,
      [exclude],
    ));
  } else {
    const vec = await moodVector(mood);
    ({ rows } = await query(
      `SELECT ${FIELDS},
              1 - (embedding <=> $1::vector) + CASE WHEN recommend = 1 THEN $3::float8 ELSE 0 END
                + CASE WHEN genres && $5::text[] THEN $6::float8 ELSE 0 END AS score
       FROM movies
       WHERE status = 'seen' AND embedding IS NOT NULL AND COALESCE(recommend, 0) <> -1
         AND NOT (id = ANY($2::int[]))
       ORDER BY score DESC
       LIMIT $4`,
      [vec, exclude, GREEN_BOOST, MOOD_POOL, MOOD_GENRES[mood], GENRE_BOOST],
    ));
  }
  return rows;
}

/** Sorteo "fuera de mi archivo": semillas = candidatas de mi archivo para ese ánimo. */
async function surpriseBeyond(mood, excludeTmdb) {
  const pool = await archivePool(mood, []);
  const seeds = (mood ? pool : [...pool].sort(() => Math.random() - 0.5))
    .slice(0, BEYOND_SEEDS)
    .map((r) => r.tmdb_id)
    .filter(Boolean);
  // Con ánimo, la referencia semántica es el ánimo mismo (no el promedio de las semillas).
  const refVector = mood ? JSON.parse(await moodVector(mood).catch(() => "null")) : null;
  const ranked = (await beyondFromSeeds(seeds, excludeTmdb, { refVector })).slice(0, BEYOND_POOL);
  if (!ranked.length) return null;
  const pick = weightedPick(ranked, (r) => BEYOND_POOL + 1 - ranked.indexOf(r));
  // Las notas ya vienen del piso de crítica de beyond.js.
  return {
    ...pick.movie,
    external: true,
    because: pick.because,
  };
}

/**
 * GET /api/recommend/surprise?mood=pensar&exclude=1,2&source=archive|beyond&exclude_ext=603,550
 *  - source=archive (por defecto): de mi archivo; `exclude` son ids del catálogo.
 *  - source=beyond: fuera de mi archivo (TMDB a partir de mis películas); `exclude_ext` son tmdb_id.
 * Respuesta: { mood, source, movie | null, moods: [keys] }
 */
async function surprise(req, res) {
  const mood = parseMood(req.query.mood);
  const exclude = [...parseExclude(req.query.exclude)];
  const source = req.query.source === "beyond" ? "beyond" : "archive";

  try {
    if (source === "beyond") {
      const movie = await surpriseBeyond(mood, parseExclude(req.query.exclude_ext));
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ mood, source, movie, moods: Object.keys(MOODS) });
    }

    const rows = await archivePool(mood, exclude);
    const pick = rows.length
      ? mood
        ? weightedPick(rows, (r) => MOOD_POOL - rows.indexOf(r)) // más cercana, más peso
        : weightedPick(rows, (r) => (r.rating >= 5 ? 3 : r.rating >= 4 ? 2 : 1))
      : null;

    if (pick) delete pick.score;
    res.setHeader("Cache-Control", "no-store"); // cada clic es otra tirada
    return res.status(200).json({ mood, source, movie: pick, moods: Object.keys(MOODS) });
  } catch (err) {
    console.error("❌ Error en surprise:", err.message);
    return res.status(500).json({ error: "No pude elegir una película ahora." });
  }
}

module.exports = { surprise, MOODS };
