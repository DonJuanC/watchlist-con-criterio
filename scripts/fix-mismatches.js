// scripts/fix-mismatches.js
// CINE-06 (ajuste en vivo): 9 títulos quedaron mal emparejados por la heurística de
// searchMovie() — para películas con original_title no inglés, el título localizado
// (es-MX) casi nunca calza exacto contra el query en inglés, así que homónimos en
// inglés con buena popularidad (ej. "Parasite" 1982, B-movie) ganaban el match.
// Aquí se resuelve cada caso buscando por título y filtrando candidatos por director
// esperado (vía créditos), en vez de por igualdad de texto. Se borra la fila incorrecta
// (tmdb_id equivocado) y se inserta la correcta.

require('dotenv').config();
const { query, pool } = require('../src/db');
const { getMovieDetails } = require('../src/services/tmdb');
const { generateEmbedding } = require('../src/services/embeddings');

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = process.env.TMDB_API_KEY;

const FIXES = [
    { wrongTmdbId: 48311, query: 'Parasite', expectedDirector: 'Bong Joon Ho', expectedYear: 2019 },
    { wrongTmdbId: 87516, query: 'Oldboy', expectedDirector: 'Park Chan-wook', expectedYear: 2003 },
    { wrongTmdbId: 1292123, query: 'Mother', expectedDirector: 'Bong Joon Ho', expectedYear: 2009 },
    { wrongTmdbId: 72710, query: 'The Host', expectedDirector: 'Bong Joon Ho', expectedYear: 2006 },
    { wrongTmdbId: 506815, query: 'A Separation', expectedDirector: 'Asghar Farhadi', expectedYear: 2011 },
    { wrongTmdbId: 13767, query: 'Force Majeure', expectedDirector: 'Ruben Östlund', expectedYear: 2014 },
    { wrongTmdbId: 46812, query: 'Thirst', expectedDirector: 'Park Chan-wook', expectedYear: 2009 },
    { wrongTmdbId: 1425045, query: 'Brick', expectedDirector: 'Rian Johnson', expectedYear: 2005 },
    { wrongTmdbId: 1058537, query: 'Fallen Angels', expectedDirector: 'Wong Kar-Wai', expectedYear: 1995 },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchCandidates(titleQuery) {
    const url = `${TMDB_BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(titleQuery)}&language=es-MX&include_adult=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB search falló (${res.status}) para "${titleQuery}"`);
    const data = await res.json();
    return data.results || [];
}

async function getCredits(tmdbId) {
    const url = `${TMDB_BASE_URL}/movie/${tmdbId}/credits?api_key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
}

function normalize(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

async function findByDirector(titleQuery, expectedDirector, expectedYear) {
    const candidates = await searchCandidates(titleQuery);
    const normExpected = normalize(expectedDirector);

    for (const c of candidates) {
        await sleep(150);
        const credits = await getCredits(c.id);
        if (!credits) continue;
        const director = (credits.crew || []).find((p) => p.job === 'Director');
        if (director && normalize(director.name).includes(normExpected.split(' ')[0])) {
            return c;
        }
    }
    // Fallback: filtrar por año si el matching por director no encontró nada.
    if (expectedYear) {
        const byYear = candidates.find((c) => (c.release_date || '').startsWith(String(expectedYear)));
        if (byYear) return byYear;
    }
    return null;
}

async function upsertMovie(movie, embedding) {
    const vectorLiteral = JSON.stringify(embedding);
    const sql = `
        INSERT INTO movies (
            tmdb_id, title, overview, release_year, poster_path,
            director, cinematographer, genres, embedding
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)
        ON CONFLICT (tmdb_id) DO UPDATE SET
            title = EXCLUDED.title,
            overview = EXCLUDED.overview,
            release_year = EXCLUDED.release_year,
            poster_path = EXCLUDED.poster_path,
            director = EXCLUDED.director,
            cinematographer = EXCLUDED.cinematographer,
            genres = EXCLUDED.genres,
            embedding = EXCLUDED.embedding;
    `;
    await query(sql, [
        movie.tmdb_id, movie.title, movie.overview, movie.release_year,
        movie.poster_path, movie.director, movie.cinematographer, movie.genres, vectorLiteral,
    ]);
}

async function run() {
    for (const fix of FIXES) {
        console.log(`\n--- Corrigiendo "${fix.query}" (esperado: ${fix.expectedDirector}) ---`);
        try {
            const candidate = await findByDirector(fix.query, fix.expectedDirector, fix.expectedYear);
            if (!candidate) {
                console.error(`❌ No se encontró candidato válido para "${fix.query}"`);
                continue;
            }

            const movie = await getMovieDetails(candidate.id);
            const semanticText = `${movie.title}. Géneros: ${movie.genres.join(', ')}. Sinopsis: ${movie.overview}`;
            const embedding = await generateEmbedding(semanticText);
            await upsertMovie(movie, embedding);

            if (fix.wrongTmdbId !== movie.tmdb_id) {
                await query('DELETE FROM movies WHERE tmdb_id = $1;', [fix.wrongTmdbId]);
                console.log(`🗑️  Borrada fila incorrecta (tmdb_id=${fix.wrongTmdbId}).`);
            }
            console.log(`✅ "${movie.title}" (tmdb_id=${movie.tmdb_id}, director=${movie.director}) — corregida.`);
        } catch (err) {
            console.error(`❌ Error corrigiendo "${fix.query}":`, err.message);
        }
        await sleep(300);
    }
}

run()
    .catch((err) => {
        console.error('Error fatal:', err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
