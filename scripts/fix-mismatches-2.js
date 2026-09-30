// scripts/fix-mismatches-2.js
// CINE-06 (ajuste en vivo, ronda 2): IDs de TMDB verificados manualmente (búsqueda en
// inglés + créditos de director) para los 6 casos que la heurística automática no
// resolvió: Parasite, Mother, The Host, Thirst, Fallen Angels, A Separation.

require('dotenv').config();
const { query, pool } = require('../src/db');
const { getMovieDetails } = require('../src/services/tmdb');
const { generateEmbedding } = require('../src/services/embeddings');

const FIXES = [
    { wrongTmdbId: null, correctTmdbId: 496243, label: 'Parasite (2019, Bong Joon Ho)' },
    { wrongTmdbId: null, correctTmdbId: 30018, label: 'Mother (2009, Bong Joon Ho)' },
    { wrongTmdbId: null, correctTmdbId: 1255, label: 'The Host (2006, Bong Joon Ho)' },
    { wrongTmdbId: null, correctTmdbId: 22536, label: 'Thirst (2009, Park Chan-wook)' },
    { wrongTmdbId: null, correctTmdbId: 11220, label: 'Fallen Angels (1995, Wong Kar-Wai)' },
    { wrongTmdbId: 307381, correctTmdbId: 60243, label: 'A Separation (2011, Asghar Farhadi)' },
];

// tmdb_id incorrectos que quedaron insertados en la corrida original y deben borrarse
// (los que no fueron tocados en la ronda 1 de fix-mismatches.js).
const STALE_WRONG_IDS = [48311, 1292123, 72710, 46812, 1058537];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
        console.log(`\n--- ${fix.label} ---`);
        try {
            const movie = await getMovieDetails(fix.correctTmdbId);
            const semanticText = `${movie.title}. Géneros: ${movie.genres.join(', ')}. Sinopsis: ${movie.overview}`;
            const embedding = await generateEmbedding(semanticText);
            await upsertMovie(movie, embedding);
            if (fix.wrongTmdbId && fix.wrongTmdbId !== movie.tmdb_id) {
                await query('DELETE FROM movies WHERE tmdb_id = $1;', [fix.wrongTmdbId]);
            }
            console.log(`✅ "${movie.title}" (tmdb_id=${movie.tmdb_id}, director=${movie.director}) — insertada.`);
        } catch (err) {
            console.error(`❌ Error en "${fix.label}":`, err.message);
        }
        await sleep(300);
    }

    console.log('\n--- Limpiando filas incorrectas remanentes ---');
    const { rowCount } = await query('DELETE FROM movies WHERE tmdb_id = ANY($1::int[]);', [STALE_WRONG_IDS]);
    console.log(`🗑️  ${rowCount} filas incorrectas borradas.`);
}

run()
    .catch((err) => {
        console.error('Error fatal:', err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
