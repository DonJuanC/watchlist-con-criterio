// scripts/seed.js
// CINE-02: Pipeline de ingesta por lotes — TMDB -> embedding -> UPSERT en Neon.

require('dotenv').config();
const { query, pool } = require('../src/db');
const { searchMovie, getMovieDetails } = require('../src/services/tmdb');
const { generateEmbedding } = require('../src/services/embeddings');

// CINE-06: dataset ampliado a ~114 títulos agrupados por clúster temático/autoral,
// para maximizar aristas densas por 'same_director' y 'semantic_similarity' en el grafo.
const SEED_TITLES = [
    // --- Base original (CINE-02) ---
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

    // --- Clúster: Christopher Nolan (thriller estructural / no-lineal) ---
    'Memento',
    'Insomnia',
    'The Prestige',
    'Inception',
    'Interstellar',
    'Dunkirk',

    // --- Clúster: David Fincher ---
    'Gone Girl',
    'The Social Network',
    'The Game',
    'Panic Room',

    // --- Clúster: Denis Villeneuve ---
    'Sicario',
    'Incendies',
    'Dune',
    'Polytechnique',

    // --- Clúster: Bong Joon-ho ---
    'Mother',
    'The Host',
    'Snowpiercer',

    // --- Clúster: Yorgos Lanthimos ---
    'The Lobster',
    'The Favourite',
    'Dogtooth',
    'Poor Things',
    'The Killing of a Sacred Deer',

    // --- Clúster: David Lynch ---
    'Blue Velvet',
    'Lost Highway',
    'Eraserhead',
    'Twin Peaks: Fire Walk with Me',
    'Wild at Heart',

    // --- Clúster: Sci-fi reflexivo ---
    'Ex Machina',
    'Her',
    'Under the Skin',
    'Annihilation',
    'Solaris',
    'Stalker',
    '2001: A Space Odyssey',
    'Children of Men',
    'Moon',
    'Coherence',
    'Primer',
    'A Clockwork Orange',

    // --- Clúster: Drama de autor contemporáneo ---
    'Manchester by the Sea',
    'A Separation',
    'The Father',
    'Nomadland',
    'Synecdoche, New York',
    'Boyhood',
    'Marriage Story',
    'Call Me by Your Name',
    'The Tree of Life',
    'Aftersun',
    'The Worst Person in the World',
    'Anatomy of a Fall',
    'The Zone of Interest',
    'Perfect Days',
    'Past Lives',

    // --- Clúster: Noir y crimen ---
    'L.A. Confidential',
    'Chinatown',
    'The Third Man',
    'Blood Simple',
    'Nightcrawler',
    'A History of Violence',
    'Brick',
    'Sin City',
    'Uncut Gems',
    'Heat',

    // --- Clúster: Wong Kar-wai / Park Chan-wook (extensión) ---
    'Fallen Angels',
    '2046',
    'Happy Together',
    'Lady Vengeance',
    'Thirst',
    'Decision to Leave',

    // --- Clúster: Haneke / cine europeo de autor ---
    'Funny Games',
    'The White Ribbon',
    'Toni Erdmann',
    'Force Majeure',
    'The Square',

    // --- Clúster: Terror psicológico / atmosférico ---
    'Hereditary',
    'Midsommar',
    'The Witch',
    'It Follows',
    'The Others',
    'Get Out',

    // --- Clúster: Kubrick (extensión) ---
    'Barry Lyndon',
    'Full Metal Jacket',
    'Eyes Wide Shut',
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

async function seed(titles = SEED_TITLES) {
    console.log(`Iniciando seed de ${titles.length} títulos...\n`);
    const results = { ok: 0, failed: 0 };

    for (const title of titles) {
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

// CINE-06: soporta ejecución en lotes por rango de índice — `node scripts/seed.js <start> <end>` —
// para caber dentro de límites de tiempo de ejecución (ej. shells con timeout corto).
// UPSERT en `movies` es idempotente por `tmdb_id`, así que los lotes se pueden re-correr sin duplicar.
if (require.main === module) {
    const [startArg, endArg] = process.argv.slice(2);
    const start = startArg !== undefined ? parseInt(startArg, 10) : 0;
    const end = endArg !== undefined ? parseInt(endArg, 10) : SEED_TITLES.length;
    const batch = SEED_TITLES.slice(start, end);

    console.log(`Lote: índices [${start}, ${end}) de ${SEED_TITLES.length} — ${batch.length} títulos.\n`);

    seed(batch)
        .catch((err) => {
            console.error('Error fatal en el seed:', err);
            process.exitCode = 1;
        })
        .finally(() => pool.end());
}

module.exports = { seed, seedOne };
