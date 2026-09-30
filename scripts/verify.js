// scripts/verify.js
// CINE-06: query analítico post-seed — conteo de películas, aristas por tipo
// (same_director / semantic_similarity, replicando la lógica de graphController)
// y los 3 pares con mayor afinidad semántica.

require('dotenv').config();
const { query, pool } = require('../src/db');

const SEMANTIC_MIN_SIMILARITY = 0.65;
const SEMANTIC_TOP_K = 2;

async function verify() {
    const { rows: movieCountRows } = await query('SELECT COUNT(*)::int AS count FROM movies;');
    const totalMovies = movieCountRows[0].count;

    const { rows: directorEdgeRows } = await query(`
        SELECT COUNT(*)::int AS count
        FROM movies m1
        JOIN movies m2 ON m1.director = m2.director AND m1.id < m2.id
        WHERE m1.director IS NOT NULL;
    `);
    const totalDirectorEdges = directorEdgeRows[0].count;

    const { rows: semanticEdgeRows } = await query(
        `
        SELECT COUNT(*)::int AS count
        FROM (
            SELECT m1.id AS source, knn.id AS target,
                   (1 - (m1.embedding <=> knn.embedding)) AS similarity
            FROM movies m1
            CROSS JOIN LATERAL (
                SELECT m2.id, m2.embedding
                FROM movies m2
                WHERE m2.id <> m1.id
                ORDER BY m1.embedding <=> m2.embedding ASC
                LIMIT $1
            ) knn
            WHERE (1 - (m1.embedding <=> knn.embedding)) >= $2
              AND m1.id < knn.id
        ) semantic_edges;
        `,
        [SEMANTIC_TOP_K, SEMANTIC_MIN_SIMILARITY]
    );
    const totalSemanticEdges = semanticEdgeRows[0].count;

    const { rows: topPairs } = await query(
        `
        SELECT m1.title AS title_a, knn_title.title AS title_b,
               ROUND((1 - (m1.embedding <=> knn_title.embedding))::numeric, 4) AS similarity
        FROM movies m1
        CROSS JOIN LATERAL (
            SELECT m2.id, m2.title, m2.embedding
            FROM movies m2
            WHERE m2.id <> m1.id
            ORDER BY m1.embedding <=> m2.embedding ASC
            LIMIT $1
        ) knn_title
        WHERE (1 - (m1.embedding <=> knn_title.embedding)) >= $2
          AND m1.id < knn_title.id
        ORDER BY similarity DESC
        LIMIT 3;
        `,
        [SEMANTIC_TOP_K, SEMANTIC_MIN_SIMILARITY]
    );

    console.log('=== Reporte de verificación CINE-06 ===\n');
    console.log(`Total películas en 'movies': ${totalMovies}`);
    console.log(`Aristas 'same_director': ${totalDirectorEdges}`);
    console.log(`Aristas 'semantic_similarity' (top-${SEMANTIC_TOP_K}, piso ${SEMANTIC_MIN_SIMILARITY}): ${totalSemanticEdges}`);
    console.log(`Total de aristas combinadas: ${totalDirectorEdges + totalSemanticEdges}\n`);
    console.log('Top 3 pares por afinidad semántica:');
    topPairs.forEach((p, i) => {
        console.log(`  ${i + 1}. "${p.title_a}" <-> "${p.title_b}" — similitud: ${p.similarity}`);
    });
}

if (require.main === module) {
    verify()
        .catch((err) => {
            console.error('Error fatal en verify:', err);
            process.exitCode = 1;
        })
        .finally(() => pool.end());
}

module.exports = { verify };
