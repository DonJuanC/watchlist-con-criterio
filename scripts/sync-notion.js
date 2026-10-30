// scripts/sync-notion.js
// CINE-10a: sincroniza el catálogo desde Notion ("🎬 Películas & Series") hacia Neon.
//   node scripts/sync-notion.js             → sincroniza lo nuevo/editado (detecta cambios en reseña)
//   node scripts/sync-notion.js --dry-run   → solo muestra qué haría, sin escribir
//   node scripts/sync-notion.js --prune     → además borra de Neon lo que no está en Notion
//   node scripts/sync-notion.js --limit 5   → procesa solo N filas (para probar)
//   node scripts/sync-notion.js --reembed   → regenera embeddings con criterio enriquecido (director + reseña)

require("dotenv").config();
const { query, pool } = require("../src/db");
const { generateEmbedding, buildMovieSemanticText } = require("../src/services/embeddings");

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATA_SOURCE_ID = process.env.NOTION_DATA_SOURCE_ID;
const TMDB_KEY = process.env.TMDB_API_KEY;
if (!NOTION_TOKEN || !DATA_SOURCE_ID)
  throw new Error("Faltan NOTION_TOKEN / NOTION_DATA_SOURCE_ID en .env");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const PRUNE = args.includes("--prune");
const REEMBED = args.includes("--reembed") || args.includes("--force-emb");
const LIMIT = args.includes("--limit")
  ? Number(args[args.indexOf("--limit") + 1])
  : Infinity;

const EMBED_DELAY_MS = 700; // margen para la cuota gratis de Gemini
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Notion ----------
const NOTION_HEADERS = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Notion-Version": "2025-09-03",
  "Content-Type": "application/json",
};

async function notionFetch(path, options = {}) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: NOTION_HEADERS,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Notion ${res.status}: ${body.message}`);
  return body;
}

async function fetchAllRows() {
  const rows = [];
  let cursor;
  do {
    const page = await notionFetch(`/data_sources/${DATA_SOURCE_ID}/query`, {
      method: "POST",
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    rows.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return rows;
}

const text = (prop) =>
  (prop?.title || prop?.rich_text || [])
    .map((t) => t.plain_text)
    .join("")
    .trim();
const select = (prop) => prop?.select?.name ?? null;

const STATUS = { "Visto ✅": "seen", "Pendiente 📌": "pending" };
const RECOMMEND = {
  "Sí sin dudarlo 🟢": 1,
  "Sí con reservas 🟡": 0,
  "No realmente 🔴": -1,
};
const MOVIE_TYPES = new Set(["Película", "Documental"]);

function parseRow(page) {
  const p = page.properties;
  const rating = select(p["Calificación"]);
  return {
    pageId: page.id,
    editedAt: page.last_edited_time,
    title: text(p["Título"]),
    year: p["Año de estreno"]?.number ?? null,
    type: select(p["Tipo"]),
    status: STATUS[select(p["Estado"])] ?? null,
    recommend: RECOMMEND[select(p["¿Recomendarías?"])] ?? null,
    rating: rating ? (rating.match(/⭐/g) || []).length : null,
    review: text(p["Reseña personal"]) || null,
    tmdbId: p["TMDB ID"]?.number ?? null,
    appTitle: text(p["Título en app"]) || null,
  };
}

async function writeBack(pageId, { tmdbId, match, appTitle }) {
  const properties = {
    "TMDB ID": { number: tmdbId },
    Match: { select: { name: match } },
  };
  if (appTitle)
    properties["Título en app"] = {
      rich_text: [{ text: { content: appTitle } }],
    };
  const page = await notionFetch(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
  return page.last_edited_time;
}

// ---------- TMDB ----------
const norm = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function tmdb(path) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(
    `https://api.themoviedb.org/3${path}${sep}api_key=${TMDB_KEY}`,
  );
  if (!res.ok) throw new Error(`TMDB ${res.status} en ${path}`);
  return res.json();
}

/** Busca por título + año (±1). Devuelve { id, match } o null. */
async function findTmdbId(title, year) {
  for (const y of [year, year - 1, year + 1].filter(Boolean)) {
    const { results = [] } = await tmdb(
      `/search/movie?query=${encodeURIComponent(title)}&primary_release_year=${y}&language=en-US`,
    );
    if (!results.length) continue;
    const exact = results.find(
      (r) =>
        norm(r.title) === norm(title) || norm(r.original_title) === norm(title),
    );
    const pick =
      exact || results.sort((a, b) => b.popularity - a.popularity)[0];
    return { id: pick.id, match: exact && y === year ? "OK" : "Revisar" };
  }
  return null;
}

/** Una sola llamada: detalle en español + créditos + traducciones (para el título en inglés). */
async function getDetails(tmdbId) {
  const d = await tmdb(
    `/movie/${tmdbId}?language=es-MX&append_to_response=credits,translations`,
  );
  const tr = (code) =>
    d.translations?.translations?.find(
      (t) =>
        t.iso_639_1 === code.split("-")[0] &&
        t.iso_3166_1 === code.split("-")[1],
    )?.data;
  const en = tr("en-US");
  const crew = d.credits?.crew || [];
  const titleEn = en?.title || d.original_title;
  return {
    tmdb_id: d.id,
    title_es: d.title,
    title_en: titleEn,
    original_title: d.original_title,
    original_language: d.original_language,
    // Regla de JuanC: título en inglés, salvo películas en español → original.
    display_title: d.original_language === "es" ? d.original_title : titleEn,
    overview: d.overview || en?.overview || "",
    release_year: d.release_date ? Number(d.release_date.slice(0, 4)) : null,
    poster_path: d.poster_path,
    genres: (d.genres || []).map((g) => g.name),
    director: crew.find((c) => c.job === "Director")?.name ?? null,
    cinematographer:
      crew.find((c) => c.job === "Director of Photography")?.name ?? null,
  };
}

// ---------- Neon ----------
async function upsertMovie(m, row, embedding) {
  // Si la fila de Notion cambió de TMDB ID, se borra la película anterior de esa página.
  await query(
    "DELETE FROM movies WHERE notion_page_id = $1 AND tmdb_id <> $2",
    [row.pageId, m.tmdb_id],
  );
  await query(
    `INSERT INTO movies (tmdb_id, title, title_es, title_en, original_title, original_language, display_title,
                             overview, release_year, poster_path, director, cinematographer, genres, embedding,
                             status, recommend, rating, review, notion_page_id, notion_edited_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE($14::vector, NULL),$15,$16,$17,$18,$19,$20)
         ON CONFLICT (tmdb_id) DO UPDATE SET
            title = EXCLUDED.title, title_es = EXCLUDED.title_es, title_en = EXCLUDED.title_en,
            original_title = EXCLUDED.original_title, original_language = EXCLUDED.original_language,
            display_title = EXCLUDED.display_title, overview = EXCLUDED.overview,
            release_year = EXCLUDED.release_year, poster_path = EXCLUDED.poster_path,
            director = EXCLUDED.director, cinematographer = EXCLUDED.cinematographer, genres = EXCLUDED.genres,
            embedding = COALESCE(EXCLUDED.embedding, movies.embedding),
            status = EXCLUDED.status, recommend = EXCLUDED.recommend, rating = EXCLUDED.rating,
            review = EXCLUDED.review, notion_page_id = EXCLUDED.notion_page_id,
            notion_edited_at = EXCLUDED.notion_edited_at`,
    [
      m.tmdb_id,
      m.display_title,
      m.title_es,
      m.title_en,
      m.original_title,
      m.original_language,
      m.display_title,
      m.overview,
      m.release_year,
      m.poster_path,
      m.director,
      m.cinematographer,
      m.genres,
      embedding ? JSON.stringify(embedding) : null,
      row.status,
      row.recommend,
      row.rating,
      row.review,
      row.pageId,
      row.editedAt,
    ],
  );
}

// ---------- Orquestación ----------
async function main() {
  const pages = await fetchAllRows();
  const rows = pages.map(parseRow).filter((r) => MOVIE_TYPES.has(r.type));
  const { rows: existing } = await query(
    "SELECT tmdb_id, notion_page_id, notion_edited_at, review, embedding IS NOT NULL AS has_emb FROM movies",
  );
  const byPage = new Map(
    existing.filter((e) => e.notion_page_id).map((e) => [e.notion_page_id, e]),
  );
  const embedded = new Set(
    existing.filter((e) => e.has_emb).map((e) => e.tmdb_id),
  );

  const stats = {
    skipped: 0,
    synced: 0,
    embedded: 0,
    review: 0,
    notFound: 0,
    outOfCatalog: 0,
    errors: 0,
  };
  const keepPageIds = new Set();
  let processed = 0;

  for (const row of rows) {
    if (!row.status) {
      stats.outOfCatalog++;
      continue;
    } // En progreso / Abandonado: fuera del catálogo
    keepPageIds.add(row.pageId);

    const prev = byPage.get(row.pageId);
    const reviewChanged =
      Boolean(prev) &&
      (row.review || "").trim() !== (prev.review || "").trim();

    if (
      !REEMBED &&
      prev &&
      row.tmdbId === prev.tmdb_id &&
      new Date(row.editedAt) <= new Date(prev.notion_edited_at) &&
      !reviewChanged
    ) {
      stats.skipped++;
      continue;
    }
    if (processed++ >= LIMIT) continue; // continue (no break): las filas restantes siguen marcadas como vigentes para --prune

    try {
      let tmdbId = row.tmdbId;
      let match = "OK";
      if (!tmdbId) {
        const found = await findTmdbId(row.title, row.year);
        if (!found) {
          stats.notFound++;
          console.log(`❓ No encontrada: ${row.title} (${row.year})`);
          if (!DRY_RUN)
            await writeBack(row.pageId, {
              tmdbId: null,
              match: "No encontrada",
            });
          continue;
        }
        ({ id: tmdbId, match } = found);
      }
      if (match === "Revisar") stats.review++;

      const movie = await getDetails(tmdbId);
      const needsEmbedding = !embedded.has(tmdbId) || REEMBED || reviewChanged;
      const label = `${row.title} → ${movie.display_title} [${tmdbId}] ${row.status}${needsEmbedding ? " +emb" : ""}${reviewChanged ? " (reseña actualizada)" : ""}`;

      if (DRY_RUN) {
        console.log(`· ${label}`);
        stats.synced++;
        continue;
      }

      let embedding = null;
      if (needsEmbedding) {
        const semanticText = buildMovieSemanticText({
          title: movie.title_es || movie.display_title,
          director: movie.director,
          genres: movie.genres,
          overview: movie.overview,
          review: row.review,
        });
        embedding = await generateEmbedding(semanticText);
        stats.embedded++;
        await sleep(EMBED_DELAY_MS);
      }

      // Write-back primero: así guardamos en Neon el last_edited_time que deja nuestra propia edición
      // y el siguiente sync no vuelve a procesar esta fila.
      row.editedAt = await writeBack(row.pageId, {
        tmdbId,
        match,
        appTitle: row.appTitle ? null : movie.display_title, // respeta lo escrito a mano
      });
      if (row.appTitle) movie.display_title = row.appTitle;

      await upsertMovie(movie, row, embedding);
      stats.synced++;
      console.log(`✅ ${label}`);
    } catch (err) {
      stats.errors++;
      console.error(`❌ ${row.title}: ${err.message}`);
    }
  }

  if (PRUNE) {
    const { rows: stale } = await query(
      "SELECT id, title, notion_page_id FROM movies",
    );
    const toDelete = stale.filter(
      (m) => !m.notion_page_id || !keepPageIds.has(m.notion_page_id),
    );
    console.log(
      `\n🧹 Prune: ${toDelete.length} películas en Neon que no están en Notion`,
    );
    if (!DRY_RUN && toDelete.length) {
      await query("DELETE FROM movies WHERE id = ANY($1::int[])", [
        toDelete.map((m) => m.id),
      ]);
    }
  }

  console.log("\nResumen:", stats, DRY_RUN ? "(dry-run, nada escrito)" : "");
}

main()
  .catch((err) => {
    console.error("❌ Sync falló:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
