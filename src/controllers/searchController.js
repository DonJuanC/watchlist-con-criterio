// src/controllers/searchController.js
// CINE-03: Búsqueda semántica vectorial (similitud coseno) contra la tabla movies.

const { query } = require("../db");
const { generateMovieEmbedding } = require("../services/embeddings");
const { detectEmotions } = require("../services/emotions");

const DEFAULT_LIMIT = 10;
// Umbral de similitud coseno calibrado para gemini-embedding-001 (768 dimensiones).
// Con textos semánticos enriquecidos (título, director, géneros, sinopsis y reseñas personales),
// consultas breves ("amor", "comedia", "acción") o frases conversacionales
// ("me quiero sentir alegre") generan similitudes naturales en el rango 0.46–0.58.
// El umbral anterior de 0.60 filtraba el 100% de estas búsquedas legítimas.
const MIN_SIMILARITY = 0.45;
const MIN_SIMILARITY_PENDING = 0.45;
const FALLBACK_MIN_SIMILARITY = 0.40;
// Con un piso absoluto de 0.45 entra casi todo el catálogo ("amor": el puesto 1 es 0.566
// y el 20 ya es Inception con 0.48): para consultas cortas la similitud sola casi no separa.
// Por eso, para que "Ver más" pagine lo que de verdad encaja:
// 1) Refuerzo léxico: si la consulta nombra un género (amor → Romance) o una palabra que
//    aparece en la sinopsis, la película sube. Barato y mucho más preciso que el vector solo.
// 2) Corte relativo al 3.er mejor score (no al 1.º, que a veces es un outlier) y tope total.
const RELATIVE_BAND = 0.05;
const MAX_TOTAL_RESULTS = 24;
const GENRE_BOOST = 0.05;
const WORD_BOOST = 0.02;
// Emociones (services/emotions.js): resta a géneros que contradicen la emoción ("feliz" →
// Terror, Bélica, Crimen), salvo que la película también tenga un género reforzado
// (Zombieland es Terror pero también Comedia).
const GENRE_PENALTY = 0.05;
const GENRE_HINTS = {
  Romance: ["amor", "romance", "romantica", "enamor", "pareja"],
  Comedia: ["comedia", "reir", "risa", "divertid", "graciosa", "humor", "chistos"],
  Terror: ["terror", "miedo", "horror", "susto", "asustar"],
  "Ciencia ficción": ["ciencia ficcion", "sci-fi", "scifi", "futurista", "espacio"],
  Animación: ["animacion", "animada", "animado", "dibujos"],
  Bélica: ["guerra", "belica", "soldado"],
  Crimen: ["crimen", "mafia", "gangster", "ganster", "policia", "criminal"],
  Familia: ["familiar", "ninos", "infantil"],
  Música: ["musica", "musical", "banda sonora"],
  Western: ["western", "vaquero", "oeste"],
  Historia: ["historica", "historia real", "epoca"],
  Suspense: ["suspenso", "suspense", "thriller", "tension"],
  Misterio: ["misterio", "enigma"],
  Fantasía: ["fantasia", "magia", "fantastica"],
  Aventura: ["aventura"],
  Acción: ["accion", "adrenalina"],
};
const STOPWORDS = new Set(["algo", "para", "como", "pelicula", "peliculas", "quiero", "sentir", "una", "que", "con", "sobre", "donde"]);

const fold = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Géneros que la consulta nombra y palabras útiles para buscar en la sinopsis. */
function lexicalHints(text) {
  const q = fold(text);
  const genres = Object.entries(GENRE_HINTS)
    .filter(([, hints]) => hints.some((h) => q.includes(h)))
    .map(([g]) => g);
  const words = q
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    .slice(0, 6);
  return { genres, words };
}

// "Ver más" vuelve a pedir la misma consulta: se cachea su embedding para no pagar Gemini
// por cada página.
const EMBEDDING_CACHE_MAX = 200;
const embeddingCache = new Map(); // texto normalizado -> literal de vector

async function queryVector(text) {
  const key = text.toLowerCase();
  if (embeddingCache.has(key)) {
    const v = embeddingCache.get(key);
    embeddingCache.delete(key); // refresca su posición (LRU)
    embeddingCache.set(key, v);
    return v;
  }
  const v = JSON.stringify(await generateMovieEmbedding(text));
  embeddingCache.set(key, v);
  if (embeddingCache.size > EMBEDDING_CACHE_MAX) {
    embeddingCache.delete(embeddingCache.keys().next().value);
  }
  return v;
}

/**
 * POST /api/search/semantic
 * Body: { query: string, limit?: number, scope?: 'seen' | 'pending', offset?: number }
 * scope (Fase 2): 'pending' busca por sensación dentro de mi lista por ver ("¿Qué veo hoy?").
 */
async function semanticSearch(req, res) {
  const { query: searchQuery, limit, scope = "seen", offset } = req.body || {};
  const resultOffset = Number.isInteger(offset) && offset > 0 ? offset : 0;
  if (scope !== "seen" && scope !== "pending") {
    return res
      .status(400)
      .json({ error: 'El campo "scope" debe ser "seen" o "pending".' });
  }

  if (!searchQuery || typeof searchQuery !== "string" || !searchQuery.trim()) {
    return res
      .status(400)
      .json({ error: 'El campo "query" es requerido y no puede venir vacío.' });
  }

  const cleanQuery = searchQuery.trim();
  if (cleanQuery.length > 250) {
    return res
      .status(400)
      .json({ error: 'El campo "query" no puede superar los 250 caracteres.' });
  }

  const resultLimit =
    Number.isInteger(limit) && limit > 0 ? Math.min(limit, 50) : DEFAULT_LIMIT;

  try {
    // Si la consulta nombra una emoción, se embebe el tipo de película que la produce
    // (ver services/emotions.js) y sus géneros entran al refuerzo.
    const emotion = detectEmotions(cleanQuery);
    const vectorLiteral = await queryVector(emotion ? emotion.embedText : cleanQuery);

    const lexical = lexicalHints(cleanQuery);
    const hintGenres = [...new Set([...lexical.genres, ...(emotion?.boost ?? [])])];
    const penalizeGenres = emotion?.penalize.filter((g) => !hintGenres.includes(g)) ?? [];
    // La palabra de la emoción no se busca en la sinopsis: "feliz" en una sinopsis suele
    // hablar de una familia feliz que se rompe, no de una película que te pone feliz.
    const hintWords = lexical.words.filter(
      (w) => !emotion || ![...emotion.emotionWords].some((e) => w.startsWith(e) || e.startsWith(w)),
    );
    // \m = inicio de palabra en Postgres: "amor" encaja con "amores", no con "clamor".
    const wordPattern = hintWords.length ? `\\m(${hintWords.join("|")})` : null;

    const sql = `
            WITH scored AS (
              SELECT id, tmdb_id, title, overview, poster_path, release_year, director, genres,
                     1 - (embedding <=> $1::vector) AS similarity,
                     1 - (embedding <=> $1::vector)
                       + CASE WHEN genres && $7::text[] THEN $9::float8 ELSE 0 END
                       + CASE WHEN $8::text IS NOT NULL
                                   AND translate(lower(COALESCE(overview, '')), 'áéíóúüñ', 'aeiouun') ~ $8::text THEN $10::float8 ELSE 0 END
                       - CASE WHEN genres && $12::text[] AND NOT (genres && $7::text[]) THEN $13::float8 ELSE 0 END
                       AS score
              FROM movies
              WHERE status = $4 AND embedding IS NOT NULL
            ),
            ranked AS (
              SELECT scored.*, ROW_NUMBER() OVER (ORDER BY score DESC, id) AS rk FROM scored
            ),
            anchor AS (SELECT score AS ref FROM ranked WHERE rk = LEAST(3, (SELECT COUNT(*) FROM ranked)))
            SELECT ranked.* FROM ranked, anchor
            WHERE similarity > $3 AND (score >= anchor.ref - $6 OR rk <= 6) AND rk <= $11
            ORDER BY rk
            LIMIT $2 OFFSET $5;
        `;
    const extraParams = [
      RELATIVE_BAND,
      hintGenres,
      wordPattern,
      GENRE_BOOST,
      WORD_BOOST,
      MAX_TOTAL_RESULTS,
      penalizeGenres,
      GENRE_PENALTY,
    ];
    let { rows } = await query(sql, [
      vectorLiteral,
      resultLimit + 1, // la fila extra solo dice si hay más páginas
      scope === "pending" ? MIN_SIMILARITY_PENDING : MIN_SIMILARITY,
      scope,
      resultOffset,
      ...extraParams,
    ]);

    // Fallback: si una búsqueda abstracta o de una sola palabra no supera el umbral base en offset 0,
    // relajamos levemente a 0.40 para evitar pantallas vacías frustrantes para el usuario
    if (rows.length === 0 && resultOffset === 0) {
      const fallback = await query(sql, [
        vectorLiteral,
        resultLimit + 1,
        FALLBACK_MIN_SIMILARITY,
        scope,
        0,
        ...extraParams,
      ]);
      rows = fallback.rows;
    }

    return res
      .status(200)
      .json({
        query: searchQuery,
        emotions: emotion?.keys ?? [],
        count: Math.min(rows.length, resultLimit),
        hasMore: rows.length > resultLimit,
        results: rows.slice(0, resultLimit),
      });
  } catch (err) {
    console.error("❌ Error en semanticSearch:", err.message);
    return res
      .status(500)
      .json({ error: "Error al ejecutar la búsqueda semántica." });
  }
}

module.exports = { semanticSearch, queryVector };
