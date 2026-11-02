// scripts/fetch-availability.js
// Dónde ver cada película del catálogo, por país (JustWatch vía TMDB), guardado en Neon.
// Incremental: solo consulta las que no tienen datos o los tienen de hace más de 7 días.
//   npm run availability                  → todas las pendientes de refresco
//   npm run availability -- --dry-run     → consulta y muestra, sin escribir en Neon
//   npm run availability -- --limit 5     → solo N películas
//   npm run availability -- --refresh     → vuelve a consultar todas
// Corre también en el workflow de sincronización, después de `npm run sync`.

require("dotenv").config();
const { query, pool } = require("../src/db");
const { refreshAvailability, DB_TTL_DAYS } = require("../src/services/availability");
const { getWatchProviders } = require("../src/services/tmdb");

if (!process.env.TMDB_API_KEY) throw new Error("Falta TMDB_API_KEY en .env");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const REFRESH = args.includes("--refresh");
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : 2000;
const CONCURRENCY = 5; // TMDB permite ~50 req/s; Neon es el cuello: varias a la vez

async function main() {
  const { rows } = await query(
    `SELECT m.tmdb_id, MIN(m.title) AS title
     FROM movies m
     LEFT JOIN watch_fetched f ON f.tmdb_id = m.tmdb_id
     WHERE m.tmdb_id IS NOT NULL
       ${REFRESH ? "" : "AND (f.fetched_at IS NULL OR f.fetched_at < NOW() - make_interval(days => $2))"}
     GROUP BY m.tmdb_id
     ORDER BY MIN(f.fetched_at) NULLS FIRST, m.tmdb_id
     LIMIT $1`,
    REFRESH ? [LIMIT] : [LIMIT, DB_TTL_DAYS],
  );
  console.log(`📺 ${rows.length} películas por consultar${DRY_RUN ? " (dry-run)" : ""}`);

  const stats = { updated: 0, withCO: 0, errors: 0 };
  const one = async (m) => {
    try {
      if (DRY_RUN) {
        const r = await getWatchProviders(m.tmdb_id);
        const co = (r.CO?.flatrate || []).map((p) => p.provider_name).join(", ") || "—";
        console.log(`  ${m.title}: ${Object.keys(r).length} países · CO: ${co}`);
      } else {
        const byCountry = await refreshAvailability(m.tmdb_id);
        if (byCountry.CO?.stream.length) stats.withCO++;
      }
      stats.updated++;
      if (stats.updated % 50 === 0) console.log(`  … ${stats.updated}/${rows.length}`);
    } catch (err) {
      stats.errors++;
      console.warn(`  ⚠️ ${m.title} (${m.tmdb_id}): ${err.message}`);
    }
  };
  // Cola simple: CONCURRENCY trabajadores sacan películas de la lista hasta vaciarla.
  const queue = [...rows];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) await one(queue.shift());
    }),
  );

  console.log(
    `✅ ${stats.updated} consultadas · ${stats.withCO} en alguna suscripción en Colombia · ${stats.errors} errores`,
  );
}

main()
  .catch((err) => {
    console.error("❌", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
