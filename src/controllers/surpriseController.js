// src/controllers/surpriseController.js
// "Sorpréndeme": UNA película de mi archivo para quien llega sin saber qué ver.
// - Sin ánimo: al azar entre mis 🟢, con más peso a las de mejor nota.
// - Con ánimo (preset): las 8 vistas (sin 🔴) más cercanas a ese ánimo, 🟢 primero; al azar
//   entre ellas, con más peso a las más cercanas.
// Los ánimos son presets del servidor (no texto libre) para que cada uno cueste un solo
// embedding de Gemini por vida del proceso.

const { query } = require("../db");
const { generateEmbedding } = require("../services/embeddings");
const { parseExclude } = require("../services/neighborRanking");

const MOODS = {
  pensar: "película que te deja pensando, ideas, giros, filosofía, la mente, preguntas sin respuesta",
  reir: "comedia divertida y ligera para reír, humor, absurdo, buen rato",
  adrenalina: "acción intensa, tensión, persecuciones, adrenalina, ritmo frenético",
  llorar: "drama emotivo y conmovedor, pérdida, amor, para llorar",
  miedo: "terror y suspenso inquietante, miedo, atmósfera oscura",
  culto: "película rara y de culto, extraña, original, independiente, inclasificable",
};
const MOOD_POOL = 8;
const GREEN_BOOST = 0.04;
const moodEmbeddings = new Map(); // key -> literal de vector

const FIELDS = `id, tmdb_id, title, release_year, poster_path, director, genres[1] AS main_genre,
                rating, recommend, review, overview`;

async function moodVector(key) {
  if (!moodEmbeddings.has(key)) {
    moodEmbeddings.set(key, JSON.stringify(await generateEmbedding(MOODS[key])));
  }
  return moodEmbeddings.get(key);
}

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

/**
 * GET /api/recommend/surprise?mood=pensar&exclude=1,2
 * Respuesta: { mood, movie | null, moods: [keys] }
 */
async function surprise(req, res) {
  const mood = Object.hasOwn(MOODS, req.query.mood) ? req.query.mood : null;
  const exclude = [...parseExclude(req.query.exclude)];

  try {
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
                1 - (embedding <=> $1::vector) + CASE WHEN recommend = 1 THEN $3::float8 ELSE 0 END AS score
         FROM movies
         WHERE status = 'seen' AND embedding IS NOT NULL AND COALESCE(recommend, 0) <> -1
           AND NOT (id = ANY($2::int[]))
         ORDER BY score DESC
         LIMIT $4`,
        [vec, exclude, GREEN_BOOST, MOOD_POOL],
      ));
    }

    const pick = rows.length
      ? mood
        ? weightedPick(rows, (r) => MOOD_POOL - rows.indexOf(r)) // más cercana, más peso
        : weightedPick(rows, (r) => (r.rating >= 5 ? 3 : r.rating >= 4 ? 2 : 1))
      : null;

    if (pick) delete pick.score;
    res.setHeader("Cache-Control", "no-store"); // cada clic es otra tirada
    return res.status(200).json({ mood, movie: pick, moods: Object.keys(MOODS) });
  } catch (err) {
    console.error("❌ Error en surprise:", err.message);
    return res.status(500).json({ error: "No pude elegir una película ahora." });
  }
}

module.exports = { surprise, MOODS };
