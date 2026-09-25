// scripts/seed.js
// CINE-02: Pipeline de ingesta por lotes — TMDB -> embedding -> UPSERT en Neon.

require('dotenv').config();
const { query, pool } = require('../src/db');
const { searchMovie, getMovieDetails } = require('../src/services/tmdb');
const { generateEmbedding } = require('../src/services/embeddings');

// Lista inicial de referencia: cine de autor, thrillers psicológicos y cine diverso,
// pensada para generar conexiones semánticas ricas en el grafo (director, DoP, tono, tema).
const SEED_TITLES = [
    'Parasite',
    'Oldboy',
    'Memories of Murder',
    'In the Mood for Love',
    'Chungking Express',
    'There Will Be Blood',
    'No Country for Old Men',
    'The Shining',
    'Blade Runner 2049',
    'Arrival',
    'Enemy',
    'Prisoners',
    'Zodiac',
    'Se7en',
    'Fight Club',
    'Mulholland Drive',
    'Black Swan',
    'Requiem for a Dream',
    'Pan\'s Labyrinth',
    'The Handmaiden',
    'Burning',
    'Amour',
    'The Piano Teacher',
    'City of God',
    'Amores Perros',
    'Roma',
    'The Grand Budapest Hotel',
    'Moonlight',
    'Portrait of a Lady on Fire',
    'Drive',
];

const RATE_LIMIT_DELAY_MS = 300;

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
    const params = [
        movie.tmdb_id,
        movie.title,
        movie.overview,
        movie.release_year,
        movie.poster_path,
        movie.director,
        movie.cinematographer,
        movie.genres,
        vectorLiteral,
    ];
    await query(sql, params);
}

async function seedOne(titleQuery) {
    const found = await searchMovie(titleQuery);
    if (!found) {
        console.warn(`⚠️  Sin resultados en TMDB para "${titleQuery}", se omite.`);
        return { ok: false, title: titleQuery };
    }

    const movie = await getMovieDetails(found.id);

    const semanticText = `${movie.title}. Géneros: ${movie.genres.join(', ')}. Sinopsis: ${movie.overview}`;
    const embedding = await generateEmbedding(semanticText);

    await upsertMovie(movie, embedding);
    console.log(`✅ ${movie.title} (tmdb_id=${movie.tmdb_id}) — insertada/actualizada.`);
    return { ok: true, title: movie.title };
}

async function seed() {
    console.log(`Iniciando seed de ${SEED_TITLES.length} títulos...\n`);
    const results = { ok: 0, failed: 0 };

    for (const title of SEED_TITLES) {
        try {
            const res = await seedOne(title);
            res.ok ? results.ok++ : results.failed++;
        } catch (err) {
            results.failed++;
            console.error(`❌ Error procesando "${title}":`, err.message);
        }
        // Rate-limiting básico para respetar los free tiers de TMDB y Gemini.
        await sleep(RATE_LIMIT_DELAY_MS);
    }

    console.log(`\nSeed finalizado. OK: ${results.ok} | Fallidas: ${results.failed}`);
}

if (require.main === module) {
    seed()
        .catch((err) => {
            console.error('Error fatal en el seed:', err);
            process.exitCode = 1;
        })
        .finally(() => pool.end());
}

module.exports = { seed, seedOne };
