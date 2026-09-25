// src/services/tmdb.js
// CINE-02: Ingesta de datos desde TMDB (búsqueda + detalles con créditos).

require('dotenv').config();

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = process.env.TMDB_API_KEY;

if (!API_KEY) {
    throw new Error('Falta TMDB_API_KEY en el archivo .env');
}

/**
 * Busca una película por título y devuelve el match más plausible.
 *
 * AJUSTE (ejecutado en vivo, dos vueltas):
 * 1) Tomar `results[0]` tal cual lo devuelve TMDB producía falsos positivos
 *    ("The Piano Teacher", "Amour", "Portrait of a Lady on Fire" matcheaban con
 *    documentales/cortos homónimos casi desconocidos).
 * 2) Ordenar solo por `popularity` tampoco alcanza: para títulos cortos que son
 *    substring de otro más popular ("Roma" ⊂ "Habitación en Roma"; "Drive" ⊂
 *    "Mulholland Drive"), el título correcto quedaba tapado por el más popular.
 *
 * Heurística final: entre los resultados, priorizar los que matchean el título
 * EXACTO (`original_title`, case-insensitive) y, dentro de ese subconjunto (o de
 * todos si ninguno matchea exacto), desempatar por `popularity` descendente.
 * Verificado en vivo contra TMDB con los 30 títulos de seed.
 *
 * @param {string} title
 * @returns {Promise<object|null>} resultado crudo de TMDB o null si no hay match
 */
async function searchMovie(title) {
    const url = `${TMDB_BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(title)}&language=es-MX&include_adult=false`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`TMDB search falló (${res.status}) para "${title}"`);
    }
    const data = await res.json();
    const results = data.results || [];
    if (results.length === 0) return null;

    // Nota: algunos títulos "buscables" en inglés no son el `original_title` real
    // de la película (ej. "The Piano Teacher" → original_title "La Pianiste", en
    // francés). En esos casos, el único resultado con match exacto de texto puede
    // ser una entrada casi vacía (sin póster, popularidad ~1) y no la película real.
    // Por eso el match exacto solo se acepta si además supera un piso mínimo de
    // popularidad; si no, se cae al ranking general por popularidad+póster.
    const MIN_EXACT_MATCH_POPULARITY = 3;
    const normalizedQuery = title.trim().toLowerCase();
    const isExactMatch = (r) =>
        (r.title || '').trim().toLowerCase() === normalizedQuery ||
        (r.original_title || '').trim().toLowerCase() === normalizedQuery;

    const exactMatches = results.filter(
        (r) => isExactMatch(r) && (r.popularity || 0) >= MIN_EXACT_MATCH_POPULARITY
    );

    const withPoster = results.filter((r) => r.poster_path);
    const pool = exactMatches.length > 0 ? exactMatches : withPoster.length > 0 ? withPoster : results;
    pool.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    return pool[0];
}

/**
 * Obtiene el detalle completo de una película, incluyendo créditos (director y
 * director de fotografía). Hace fallback a inglés si el overview en es-MX viene vacío.
 * @param {number} tmdbId
 */
async function getMovieDetails(tmdbId) {
    const fetchDetails = async (lang) => {
        const url = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${API_KEY}&append_to_response=credits&language=${lang}`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`TMDB getMovieDetails falló (${res.status}) para tmdb_id=${tmdbId}`);
        }
        return res.json();
    };

    let data = await fetchDetails('es-MX');
    if (!data.overview) {
        // Fallback a inglés cuando no hay sinopsis traducida.
        data = await fetchDetails('en-US');
    }

    const crew = (data.credits && data.credits.crew) || [];
    const director = crew.find((c) => c.job === 'Director');
    const cinematographer = crew.find((c) => c.job === 'Director of Photography');

    return {
        tmdb_id: data.id,
        title: data.title,
        overview: data.overview || '',
        release_year: data.release_date ? parseInt(data.release_date.slice(0, 4), 10) : null,
        poster_path: data.poster_path || null,
        genres: (data.genres || []).map((g) => g.name),
        director: director ? director.name : null,
        cinematographer: cinematographer ? cinematographer.name : null,
    };
}

module.exports = { searchMovie, getMovieDetails };
