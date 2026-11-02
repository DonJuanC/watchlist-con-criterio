// src/services/tmdb.js
// CINE-02: Ingesta de datos desde TMDB (búsqueda + detalles con créditos).

require("dotenv").config();

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY;

if (!API_KEY) {
  throw new Error("Falta TMDB_API_KEY en el archivo .env");
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
    (r.title || "").trim().toLowerCase() === normalizedQuery ||
    (r.original_title || "").trim().toLowerCase() === normalizedQuery;

  const exactMatches = results.filter(
    (r) => isExactMatch(r) && (r.popularity || 0) >= MIN_EXACT_MATCH_POPULARITY,
  );

  const withPoster = results.filter((r) => r.poster_path);
  const pool =
    exactMatches.length > 0
      ? exactMatches
      : withPoster.length > 0
        ? withPoster
        : results;
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
      throw new Error(
        `TMDB getMovieDetails falló (${res.status}) para tmdb_id=${tmdbId}`,
      );
    }
    return res.json();
  };

  let data = await fetchDetails("es-MX");
  if (!data.overview) {
    // Fallback a inglés cuando no hay sinopsis traducida.
    data = await fetchDetails("en-US");
  }

  const crew = (data.credits && data.credits.crew) || [];
  const director = crew.find((c) => c.job === "Director");
  const cinematographer = crew.find((c) => c.job === "Director of Photography");

  return {
    tmdb_id: data.id,
    title: data.title,
    overview: data.overview || "",
    release_year: data.release_date
      ? parseInt(data.release_date.slice(0, 4), 10)
      : null,
    poster_path: data.poster_path || null,
    genres: (data.genres || []).map((g) => g.name),
    director: director ? director.name : null,
    cinematographer: cinematographer ? cinematographer.name : null,
  };
}

/**
 * CINE-10: búsqueda abierta en TMDB para sugerencias mientras se escribe.
 * Títulos con la regla de la app: inglés por defecto, original si es en español.
 * @param {string} query
 * @param {number} limit
 */
async function searchMovies(query, limit = 8) {
  const url = `${TMDB_BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=en-US&include_adult=false`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TMDB search falló (${res.status}) para "${query}"`);
  }
  const data = await res.json();
  return (data.results || [])
    // Fuera entradas casi vacías: sin póster o con muy pocos votos (cortos/homónimos).
    // Se respeta el orden de relevancia de TMDB: ordenar por popularidad subía resultados
    // que solo coinciden de lejos (ej. "dune" → Anatomy of a Fall antes que Dune 1984).
    .filter((r) => r.poster_path && (r.vote_count || 0) >= 20)
    .slice(0, limit)
    .map((r) => ({
      tmdb_id: r.id,
      title: r.original_language === "es" ? r.original_title : r.title,
      release_year: r.release_date ? Number(r.release_date.slice(0, 4)) : null,
      poster_path: r.poster_path,
    }));
}

/**
 * CINE-10: detalle de una película fuera del catálogo, con la misma forma y el mismo
 * idioma que usa scripts/sync-notion.js (es-MX + título en inglés por traducciones),
 * para que su embedding sea comparable con los del catálogo.
 * Nota: duplica getDetails() de sync-notion.js; unificar cuando el sync use este servicio.
 * @param {number} tmdbId
 */
async function getMovieForEmbedding(tmdbId) {
  const url = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${API_KEY}&language=es-MX&append_to_response=credits,translations`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`TMDB detalle falló (${res.status}) para tmdb_id=${tmdbId}`);
    err.status = res.status; // el controller distingue 404 (no existe) de otros fallos
    throw err;
  }
  const d = await res.json();
  const en = d.translations?.translations?.find(
    (t) => t.iso_639_1 === "en" && t.iso_3166_1 === "US",
  )?.data;
  const titleEn = en?.title || d.original_title;
  const crew = d.credits?.crew || [];
  return {
    tmdb_id: d.id,
    title_es: d.title,
    // Regla de la app: título en inglés, salvo películas en español → original.
    display_title: d.original_language === "es" ? d.original_title : titleEn,
    overview: d.overview || en?.overview || "",
    release_year: d.release_date ? Number(d.release_date.slice(0, 4)) : null,
    poster_path: d.poster_path,
    genres: (d.genres || []).map((g) => g.name),
    director: crew.find((c) => c.job === "Director")?.name ?? null,
    imdb_id: d.imdb_id || null,
    vote_average: d.vote_average ?? null,
    vote_count: d.vote_count ?? 0,
  };
}

/**
 * Dónde ver una película, por país (datos de JustWatch vía TMDB).
 * @param {number} tmdbId
 * @returns {Promise<object>} { CO: { link, flatrate, rent, buy, free, ads }, US: … }
 */
async function getWatchProviders(tmdbId) {
  const url = `${TMDB_BASE_URL}/movie/${tmdbId}/watch/providers?api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`TMDB watch/providers falló (${res.status}) para tmdb_id=${tmdbId}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.results || {};
}

/**
 * Catálogo de plataformas de un país, con su prioridad de despliegue (más popular primero).
 * @param {string} country código ISO de 2 letras
 * @returns {Promise<Array<{provider_id, provider_name, logo_path, display_priority, display_priorities}>>}
 */
async function getRegionProviders(country) {
  const fetchList = async (qs) => {
    const res = await fetch(`${TMDB_BASE_URL}/watch/providers/movie?api_key=${API_KEY}${qs}`);
    if (!res.ok) {
      const err = new Error(`TMDB watch/providers/movie falló (${res.status}) para ${country}`);
      err.status = res.status;
      throw err;
    }
    return (await res.json()).results || [];
  };
  const regional = await fetchList(`&watch_region=${encodeURIComponent(country)}`);
  if (regional.length) return regional;
  // TMDB a veces devuelve vacío para un país con datos (pasa con MX). El catálogo global
  // trae la prioridad de cada país en display_priorities: se usa como respaldo.
  const global = await fetchList("");
  return global.filter((p) => p.display_priorities && country in p.display_priorities);
}

/**
 * Tráiler oficial en YouTube desde TMDB.
 * Filtra ESTRICTAMENTE por official === true, site === "YouTube" y type === "Trailer".
 * @param {number} tmdbId
 * @returns {Promise<{ key: string, name: string, site: string, lang: string } | null>}
 */
async function getOfficialTrailer(tmdbId) {
  if (!tmdbId) return null;
  const url = `${TMDB_BASE_URL}/movie/${tmdbId}/videos?api_key=${API_KEY}&include_video_language=es,en,null`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results || [];

    // Filtro estricto: SIEMPRE oficial, en YouTube y de tipo Trailer
    const officialTrailers = results.filter(
      (v) =>
        v.site === "YouTube" &&
        v.official === true &&
        v.type === "Trailer" &&
        v.key,
    );
    if (!officialTrailers.length) return null;

    // Priorizar tráiler principal y versión oficial en español si existe
    const score = (v) => {
      let s = 0;
      const name = (v.name || "").toLowerCase();
      if (/official (main )?trailer|tráiler oficial|trailer oficial/i.test(name)) s += 30;
      if (/final trailer/i.test(name)) s += 25;
      if (/official us trailer|official trailer/i.test(name)) s += 20;
      if (v.iso_639_1 === "es") s += 15;
      if (/b&w|black & white|anniversary|re-release/i.test(name)) s -= 20;
      if (v.size >= 1080) s += 5;
      return s;
    };

    const best = officialTrailers.sort((a, b) => score(b) - score(a))[0];
    return {
      key: best.key,
      name: best.name,
      site: best.site,
      lang: best.iso_639_1,
    };
  } catch (err) {
    console.warn(`[getOfficialTrailer] Falló para tmdb_id=${tmdbId}:`, err.message);
    return null;
  }
}

const recsCache = new Map(); // tmdbId -> { at, items }
const RECS_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * "Fuera de mi archivo": recomendaciones de TMDB para una película (página 1, ~20).
 * Título con la misma regla que searchMovies (inglés salvo originales en español) y
 * sinopsis en es-MX. Caché en memoria 12 h por película.
 * @param {number} tmdbId
 * @returns {Promise<Array<{tmdb_id, title, release_year, poster_path, overview, vote_average, vote_count}>>}
 */
async function getRecommendations(tmdbId) {
  const hit = recsCache.get(tmdbId);
  if (hit && Date.now() - hit.at < RECS_TTL_MS) return hit.items;

  const get = async (lang) => {
    const url = `${TMDB_BASE_URL}/movie/${tmdbId}/recommendations?api_key=${API_KEY}&language=${lang}&page=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB recommendations falló (${res.status}) para ${tmdbId}`);
    return (await res.json()).results || [];
  };
  const [en, es] = await Promise.all([get("en-US"), get("es-MX")]);
  const esById = new Map(es.map((r) => [r.id, r]));
  const items = en
    .filter((r) => r.poster_path && !r.adult)
    .map((r) => ({
      tmdb_id: r.id,
      title: r.original_language === "es" ? r.original_title : r.title,
      release_year: r.release_date ? Number(r.release_date.slice(0, 4)) : null,
      poster_path: r.poster_path,
      overview: esById.get(r.id)?.overview || r.overview || "",
      vote_average: r.vote_average ?? null,
      vote_count: r.vote_count ?? 0,
    }));
  recsCache.set(tmdbId, { at: Date.now(), items });
  return items;
}

const directorFilmographyCache = new Map(); // normalizedName -> { director, movies }

/**
 * Busca un director en TMDB por nombre y devuelve su perfil más sus películas dirigidas.
 * @param {string} name
 */
async function getDirectorFilmographyFromTmdb(name) {
  const cleanName = (name || "").trim();
  if (!cleanName) return { director: null, movies: [] };

  const cacheKey = cleanName.toLowerCase();
  if (directorFilmographyCache.has(cacheKey)) {
    return directorFilmographyCache.get(cacheKey);
  }

  const searchUrl = `${TMDB_BASE_URL}/search/person?api_key=${API_KEY}&query=${encodeURIComponent(cleanName)}&language=es-MX&include_adult=false`;
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) throw new Error(`TMDB search person falló (${searchRes.status})`);
  const searchData = await searchRes.json();
  const results = searchData.results || [];
  if (results.length === 0) return { director: null, movies: [] };

  // Priorizar persona cuyo departamento conocido sea "Directing"
  const person = results.find((p) => p.known_for_department === "Directing") || results[0];

  const creditsUrl = `${TMDB_BASE_URL}/person/${person.id}/movie_credits?api_key=${API_KEY}&language=es-MX`;
  const creditsRes = await fetch(creditsUrl);
  if (!creditsRes.ok) throw new Error(`TMDB movie credits falló (${creditsRes.status})`);
  const creditsData = await creditsRes.json();

  const seenIds = new Set();
  const movies = (creditsData.crew || [])
    .filter((c) => c.job === "Director" && c.poster_path)
    .filter((m) => {
      if (seenIds.has(m.id)) return false;
      seenIds.add(m.id);
      return true;
    })
    .map((m) => ({
      tmdb_id: m.id,
      title: m.original_language === "es" ? m.original_title : (m.title || m.original_title),
      release_year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
      poster_path: m.poster_path,
      overview: m.overview || "",
      vote_average: m.vote_average ?? null,
      vote_count: m.vote_count ?? 0,
    }))
    .sort((a, b) => (b.release_year || 0) - (a.release_year || 0));

  const result = {
    director: {
      id: person.id,
      name: person.name,
      profile_path: person.profile_path,
    },
    movies,
  };

  directorFilmographyCache.set(cacheKey, result);
  return result;
}

module.exports = {
  getRecommendations,
  searchMovie,
  getMovieDetails,
  searchMovies,
  getMovieForEmbedding,
  getWatchProviders,
  getRegionProviders,
  getOfficialTrailer,
  getDirectorFilmographyFromTmdb,
};
