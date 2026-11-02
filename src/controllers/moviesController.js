// src/controllers/moviesController.js
// CINE-10b: ficha completa de una película. Se pide solo al abrirla, así /api/graph
// sigue liviano (no carga 295 sinopsis de golpe).

const { query } = require("../db");
const { searchMovies, getOfficialTrailer, getMovieForEmbedding } = require("../services/tmdb");
const { getCriticRatings } = require("../services/omdb");

const trailerCache = new Map(); // tmdb_id -> trailer | null

/**
 * GET /api/movies/:id
 * Devuelve la ficha de una película del catálogo, incluido el criterio personal
 * y el tráiler oficial verificado de YouTube.
 */
async function getMovieById(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res
      .status(400)
      .json({ error: "El id debe ser un entero positivo." });
  }

  try {
    const { rows } = await query(
      `SELECT id, tmdb_id, display_title AS title, original_title, title_es,
                    release_year, poster_path, director, cinematographer, genres, overview,
                    status, recommend, rating, review,
                    imdb_id, rt_score, imdb_rating, metascore, ratings_fetched_at
             FROM movies
             WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Película no encontrada." });
    }

    const { ratings_fetched_at: fetchedAt, ...movie } = rows[0];

    // Huecos de crítica (película nueva aún sin `npm run ratings`, o una que falló):
    // se consulta en vivo y se guarda. Se reintenta como mucho una vez por semana.
    const noCritics = movie.rt_score == null && movie.imdb_rating == null && movie.metascore == null;
    const stale = !fetchedAt || Date.now() - new Date(fetchedAt).getTime() > 7 * 86_400_000;
    if (movie.tmdb_id && noCritics && stale) {
      const r = await getCriticRatings(movie.tmdb_id, movie.imdb_id);
      if (r.fetched) {
        Object.assign(movie, {
          imdb_id: r.imdb_id,
          rt_score: r.rt_score,
          imdb_rating: r.imdb_rating,
          metascore: r.metascore,
        });
        query(
          `UPDATE movies SET imdb_id = $2, rt_score = $3, imdb_rating = $4, metascore = $5,
                  ratings_fetched_at = NOW()
           WHERE id = $1`,
          [movie.id, r.imdb_id, r.rt_score, r.imdb_rating, r.metascore],
        ).catch((err) => console.error("⚠️ No se guardaron las notas:", err.message));
      }
    }

    // Adjuntar tráiler oficial verificado de YouTube (con caché en memoria)
    if (movie.tmdb_id) {
      if (trailerCache.has(movie.tmdb_id)) {
        movie.trailer = trailerCache.get(movie.tmdb_id);
      } else {
        const trailer = await getOfficialTrailer(movie.tmdb_id);
        trailerCache.set(movie.tmdb_id, trailer);
        movie.trailer = trailer;
      }
    } else {
      movie.trailer = null;
    }

    res.setHeader(
      "Cache-Control",
      "public, max-age=3600, stale-while-revalidate=86400",
    );
    return res.status(200).json(movie);
  } catch (err) {
    console.error("❌ Error en getMovieById:", err.message);
    return res.status(500).json({ error: "Error al obtener la película." });
  }
}

const externalCache = new Map(); // tmdb_id -> ficha externa
const EXTERNAL_CACHE_MAX = 500;

/**
 * GET /api/movies/external/:tmdbId
 * Ficha de una película FUERA del catálogo (las de "Fuera de mi archivo" o la búsqueda
 * abierta): sinopsis, géneros, director y tráiler. Sin criterio personal: no la he visto.
 * Si resulta estar en el catálogo, devuelve { in_catalog: id } para abrir la ficha normal.
 */
async function getExternalMovie(req, res) {
  const tmdbId = Number(req.params.tmdbId);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return res.status(400).json({ error: "El tmdbId debe ser un entero positivo." });
  }
  try {
    const { rows } = await query(`SELECT id FROM movies WHERE tmdb_id = $1`, [tmdbId]);
    if (rows.length) return res.status(200).json({ in_catalog: rows[0].id });

    let ficha = externalCache.get(tmdbId);
    if (!ficha) {
      const [d, trailer, critics] = await Promise.all([
        getMovieForEmbedding(tmdbId),
        getOfficialTrailer(tmdbId),
        getCriticRatings(tmdbId),
      ]);
      ficha = {
        tmdb_id: d.tmdb_id,
        title: d.display_title,
        title_es: d.title_es,
        release_year: d.release_year,
        poster_path: d.poster_path,
        director: d.director,
        genres: d.genres,
        overview: d.overview,
        trailer,
        imdb_id: critics.imdb_id || d.imdb_id,
        rt_score: critics.rt_score,
        imdb_rating: critics.imdb_rating,
        metascore: critics.metascore,
        tmdb_vote: d.vote_count >= 50 ? d.vote_average : null, // respaldo si OMDb no la tiene
        external: true,
      };
      // Sin notas por cuota o error de OMDb: se responde igual, pero no se cachea.
      if (critics.fetched) externalCache.set(tmdbId, ficha);
      if (externalCache.size > EXTERNAL_CACHE_MAX) {
        externalCache.delete(externalCache.keys().next().value);
      }
    }
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    return res.status(200).json(ficha);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: "Esa película no existe en TMDB." });
    console.error("❌ Error en getExternalMovie:", err.message);
    return res.status(500).json({ error: "Error al obtener la película." });
  }
}

/**
 * GET /api/movies/search?q=texto
 * Resultados de TMDB, marcando cuáles ya están en el catálogo.
 * Respuesta: { results: [{ tmdb_id, title, release_year, poster_path, in_catalog: { id, status } | null }] }
 */
async function searchExternal(req, res) {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    return res.status(400).json({ error: "Escribe al menos 2 caracteres." });
  }

  try {
    const results = await searchMovies(q);
    if (results.length === 0) return res.status(200).json({ results: [] });

    const { rows } = await query(
      `SELECT id, tmdb_id, status FROM movies WHERE tmdb_id = ANY($1::int[])`,
      [results.map((r) => r.tmdb_id)],
    );
    const byTmdb = new Map(
      rows.map((r) => [r.tmdb_id, { id: r.id, status: r.status }]),
    );

    return res.status(200).json({
      results: results.map((r) => ({
        ...r,
        in_catalog: byTmdb.get(r.tmdb_id) ?? null,
      })),
    });
  } catch (err) {
    console.error("❌ Error en searchExternal:", err.message);
    return res.status(502).json({ error: "No se pudo buscar en TMDB." });
  }
}

module.exports = { getMovieById, searchExternal, getExternalMovie };
