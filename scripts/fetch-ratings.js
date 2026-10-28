// scripts/fetch-ratings.js
// Notas de la crítica desde OMDb (Rotten Tomatoes %, IMDb, Metascore) para la ficha.
// Incremental: solo consulta las películas que aún no tienen ratings_fetched_at.
//   npm run ratings                  → hasta 900 películas (la cuota gratis es 1.000/día)
//   npm run ratings -- --dry-run     → consulta y muestra, sin escribir en Neon
//   npm run ratings -- --limit 5     → solo N películas
//   npm run ratings -- --refresh     → vuelve a consultar todas (notas actualizadas)
// Correrlo después de `npm run sync` para que las películas nuevas tengan notas.

require("dotenv").config();
const { query, pool } = require("../src/db");

const OMDB_KEY = process.env.OMDB_API_KEY;
const TMDB_KEY = process.env.TMDB_API_KEY;
if (!OMDB_KEY) throw new Error("Falta OMDB_API_KEY en .env");
if (!TMDB_KEY) throw new Error("Falta TMDB_API_KEY en .env");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const REFRESH = args.includes("--refresh");
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : 900;
const DELAY_MS = 120;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class QuotaError extends Error {}

/** IMDb ID desde TMDB (OMDb busca por ese ID: sin ambigüedad de títulos). */
async function getImdbId(tmdbId) {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids?api_key=${TMDB_KEY}`,
  );
  if (!res.ok) throw new Error(`TMDB external_ids ${res.status}`);
  const d = await res.json();
  return d.imdb_id || null;
}

/** Notas de OMDb normalizadas a números (null si no hay). */
async function getOmdbRatings(imdbId) {
  const res = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${imdbId}`);
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    if (/limit/i.test(body.Error || "")) throw new QuotaError(body.Error);
    throw new Error(`OMDb 401: ${body.Error || "key inválida"}`);
  }
  if (!res.ok) throw new Error(`OMDb ${res.status}`);
  const d = await res.json();
  if (d.Response === "False") {
    if (/limit/i.test(d.Error || "")) throw new QuotaError(d.Error);
    return { rt: null, imdb: null, meta: null }; // OMDb no la conoce
  }
  const rtRaw = (d.Ratings || []).find((r) => r.Source === "Rotten Tomatoes")?.Value;
  const num = (v) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    rt: rtRaw ? num(rtRaw) : null, // "93%" → 93
    imdb: num(d.imdbRating), // "7.9" → 7.9 ("N/A" → null)
    meta: num(d.Metascore), // "84" → 84
  };
}

async function main() {
  const { rows } = await query(
    `SELECT id, tmdb_id, title, imdb_id FROM movies
     WHERE tmdb_id IS NOT NULL ${REFRESH ? "" : "AND ratings_fetched_at IS NULL"}
     ORDER BY (status = 'seen') DESC, id
     LIMIT $1`,
    [LIMIT],
  );
  console.log(`🎬 ${rows.length} películas por consultar${DRY_RUN ? " (dry-run)" : ""}`);

  const stats = { updated: 0, withRt: 0, noImdbId: 0, noRatings: 0, errors: 0 };
  for (const m of rows) {
    try {
      const imdbId = m.imdb_id || (await getImdbId(m.tmdb_id));
      let r = { rt: null, imdb: null, meta: null };
      if (imdbId) r = await getOmdbRatings(imdbId);
      else stats.noImdbId++;
      if (imdbId && r.rt == null && r.imdb == null && r.meta == null) stats.noRatings++;
      if (r.rt != null) stats.withRt++;

      const parts = [r.rt != null && `🍅 ${r.rt}%`, r.imdb != null && `IMDb ${r.imdb}`, r.meta != null && `MC ${r.meta}`]
        .filter(Boolean)
        .join(" · ");
      console.log(`${DRY_RUN ? "·" : "✅"} ${m.title} [${imdbId ?? "sin IMDb"}] ${parts || "sin notas"}`);

      if (!DRY_RUN) {
        await query(
          `UPDATE movies SET imdb_id = $2, rt_score = $3, imdb_rating = $4, metascore = $5,
                  ratings_fetched_at = NOW()
           WHERE id = $1`,
          [m.id, imdbId, r.rt, r.imdb, r.meta],
        );
      }
      stats.updated++;
      await sleep(DELAY_MS);
    } catch (err) {
      if (err instanceof QuotaError) {
        console.log(`⛔ Cuota de OMDb agotada (${err.message}). Corre de nuevo mañana: sigue donde quedó.`);
        break;
      }
      stats.errors++;
      console.error(`❌ ${m.title}: ${err.message}`);
    }
  }
  console.log("\nResumen:", stats, DRY_RUN ? "(dry-run, nada escrito)" : "");
}

main()
  .catch((err) => {
    console.error("❌ Ratings falló:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
