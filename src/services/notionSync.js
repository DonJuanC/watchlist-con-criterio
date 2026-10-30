// src/services/notionSync.js
// Servicio de sincronización incremental del catálogo desde Notion hacia Neon:
// Procesa películas nuevas o editadas, busca en TMDB, genera embeddings de 768 dimensiones
// con reintentos y escribe los metadatos y reseñas personales en PostgreSQL.

const { query } = require("../db");
const { generateEmbedding, buildMovieSemanticText } = require("./embeddings");

const EMBED_DELAY_MS = 350; // margen seguro para la cuota de Gemini API
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generateEmbeddingWithRetry(text, log) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await generateEmbedding(text);
    } catch (err) {
      if (attempt === 3) throw err;
      log(`⚠️ Reintento Gemini (${attempt}/3): ${err.message}`);
      await sleep(1500 * attempt);
    }
  }
}

// ---------- Notion ----------
function getNotionHeaders(notionToken) {
  return {
    Authorization: `Bearer ${notionToken}`,
    "Notion-Version": "2025-09-03",
    "Content-Type": "application/json",
  };
}

async function notionFetch(path, options = {}, notionToken) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: getNotionHeaders(notionToken),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Notion ${res.status}: ${body.message}`);
  return body;
}

async function fetchAllRows(dataSourceId, notionToken) {
  const rows = [];
  let cursor;
  do {
    const page = await notionFetch(
      `/data_sources/${dataSourceId}/query`,
      {
        method: "POST",
        body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
      },
      notionToken,
    );
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

async function writeBack(pageId, { tmdbId, match, appTitle }, notionToken) {
  const properties = {
    "TMDB ID": { number: tmdbId },
    Match: { select: { name: match } },
  };
  if (appTitle) {
    properties["Título en app"] = {
      rich_text: [{ text: { content: appTitle } }],
    };
  }
  const page = await notionFetch(
    `/pages/${pageId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    },
    notionToken,
  );
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

async function tmdbFetch(path, tmdbKey) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(
    `https://api.themoviedb.org/3${path}${sep}api_key=${tmdbKey}`,
  );
  if (!res.ok) throw new Error(`TMDB ${res.status} en ${path}`);
  return res.json();
}

async function findTmdbId(title, year, tmdbKey) {
  for (const y of [year, year - 1, year + 1].filter(Boolean)) {
    const { results = [] } = await tmdbFetch(
      `/search/movie?query=${encodeURIComponent(title)}&primary_release_year=${y}&language=en-US`,
      tmdbKey,
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

async function getDetails(tmdbId, tmdbKey) {
  const d = await tmdbFetch(
    `/movie/${tmdbId}?language=es-MX&append_to_response=credits,translations`,
    tmdbKey,
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

/**
 * Función principal para sincronizar Notion con Neon de forma incremental.
 * @param {object} [options]
 * @param {boolean} [options.dryRun=false]
 * @param {boolean} [options.prune=false]
 * @param {number} [options.limit=Infinity]
 * @param {boolean} [options.reembed=false]
 * @param {(msg: string) => void} [options.log=console.log]
 */
async function syncNotionCatalog({
  dryRun = false,
  prune = false,
  limit = Infinity,
  reembed = false,
  log = console.log,
} = {}) {
  const startTime = Date.now();
  const notionToken = process.env.NOTION_TOKEN;
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID;
  const tmdbKey = process.env.TMDB_API_KEY;

  if (!notionToken || !dataSourceId) {
    throw new Error("Faltan NOTION_TOKEN / NOTION_DATA_SOURCE_ID en variables de entorno.");
  }
  if (!tmdbKey) {
    throw new Error("Falta TMDB_API_KEY en variables de entorno.");
  }

  log("🔍 Consultando filas en Notion...");
  const pages = await fetchAllRows(dataSourceId, notionToken);
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
    }
    keepPageIds.add(row.pageId);

    const prev = byPage.get(row.pageId);
    const reviewChanged =
      Boolean(prev) &&
      (row.review || "").trim() !== (prev.review || "").trim();

    if (
      !reembed &&
      prev &&
      row.tmdbId === prev.tmdb_id &&
      new Date(row.editedAt) <= new Date(prev.notion_edited_at) &&
      !reviewChanged
    ) {
      stats.skipped++;
      continue;
    }

    if (processed++ >= limit) continue;

    try {
      let tmdbId = row.tmdbId;
      let match = "OK";
      if (!tmdbId) {
        const found = await findTmdbId(row.title, row.year, tmdbKey);
        if (!found) {
          stats.notFound++;
          log(`❓ No encontrada en TMDB: ${row.title} (${row.year})`);
          if (!dryRun) {
            await writeBack(
              row.pageId,
              { tmdbId: null, match: "No encontrada" },
              notionToken,
            );
          }
          continue;
        }
        ({ id: tmdbId, match } = found);
      }
      if (match === "Revisar") stats.review++;

      const movie = await getDetails(tmdbId, tmdbKey);
      const needsEmbedding = !embedded.has(tmdbId) || reembed || reviewChanged;
      const label = `${row.title} → ${movie.display_title} [${tmdbId}] ${row.status}${needsEmbedding ? " +emb" : ""}${reviewChanged ? " (reseña actualizada)" : ""}`;

      if (dryRun) {
        log(`· [DRY RUN] ${label}`);
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
        embedding = await generateEmbeddingWithRetry(semanticText, log);
        stats.embedded++;
        await sleep(EMBED_DELAY_MS);
      }

      const needsWriteBack = !row.tmdbId || (!row.appTitle && movie.display_title);
      if (needsWriteBack) {
        row.editedAt = await writeBack(
          row.pageId,
          {
            tmdbId,
            match,
            appTitle: row.appTitle ? null : movie.display_title,
          },
          notionToken,
        );
      }
      if (row.appTitle) movie.display_title = row.appTitle;

      await upsertMovie(movie, row, embedding);
      stats.synced++;
      log(`✅ [${stats.synced}/${rows.length}] ${label}`);
    } catch (err) {
      stats.errors++;
      log(`❌ Error procesando ${row.title}: ${err.message}`);
    }
  }

  if (prune) {
    const { rows: stale } = await query(
      "SELECT id, title, notion_page_id FROM movies",
    );
    const toDelete = stale.filter(
      (m) => !m.notion_page_id || !keepPageIds.has(m.notion_page_id),
    );
    log(`🧹 Prune: ${toDelete.length} películas en Neon que no están en Notion`);
    if (!dryRun && toDelete.length) {
      await query("DELETE FROM movies WHERE id = ANY($1::int[])", [
        toDelete.map((m) => m.id),
      ]);
    }
  }

  const durationMs = Date.now() - startTime;
  log(`🏁 Sincronización completada en ${(durationMs / 1000).toFixed(1)}s`);
  return { stats, durationMs, dryRun };
}

module.exports = {
  syncNotionCatalog,
};
