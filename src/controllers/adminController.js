// src/controllers/adminController.js
// CINE-11: Controlador del Panel Criterio Studio (Admin).
// Maneja autenticación administrativa, creación y edición de películas con
// sincronización bidireccional inmediata en Notion y recálculo de embeddings en Neon.

const crypto = require("crypto");
const { query } = require("../db");
const {
  getAdminSecret,
  createAdminSessionToken,
} = require("../middleware/auth");
const {
  createNotionPage,
  updateNotionPage,
  archiveNotionPage,
  getDetails,
  upsertMovie,
  generateEmbeddingWithRetry,
  syncNotionCatalog,
} = require("../services/notionSync");
const { buildMovieSemanticText } = require("../services/embeddings");

let isSyncInProgress = false;

/**
 * Iniciar sesión con contraseña administrativa.
 * POST /api/admin/login
 */
async function login(req, res) {
  const { password } = req.body || {};
  const secret = getAdminSecret();

  if (!secret) {
    return res.status(500).json({
      error:
        "No hay una clave administrativa (ADMIN_PASSWORD o SYNC_SECRET) configurada en el servidor.",
    });
  }

  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Proporciona la contraseña de administrador." });
  }

  try {
    const secretBuf = Buffer.from(secret);
    const passBuf = Buffer.from(password.trim());

    if (
      secretBuf.length !== passBuf.length ||
      !crypto.timingSafeEqual(secretBuf, passBuf)
    ) {
      return res.status(401).json({ error: "Contraseña incorrecta." });
    }

    const token = createAdminSessionToken();
    return res.status(200).json({
      success: true,
      token,
      message: "Sesión iniciada con éxito.",
    });
  } catch (err) {
    console.error("❌ Error en admin login:", err);
    return res.status(500).json({ error: "Error procesando autenticación." });
  }
}

/**
 * Validar estado de sesión actual.
 * GET /api/admin/me
 */
async function getMe(req, res) {
  return res.status(200).json({
    authenticated: true,
    role: "admin",
  });
}

/**
 * Obtener listado de películas para el panel de administración.
 * GET /api/admin/movies?status=all|seen|pending&search=...&limit=100&offset=0
 */
async function getAdminMovies(req, res) {
  const status = req.query.status || "all";
  const search = (req.query.search || "").trim();
  const limit = Math.min(Number(req.query.limit) || 100, 300);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const conditions = [];
  const params = [];

  if (status === "seen" || status === "pending") {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    conditions.push(
      `(title ILIKE $${idx} OR original_title ILIKE $${idx} OR director ILIKE $${idx} OR review ILIKE $${idx})`,
    );
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM movies ${whereClause}`,
      params,
    );
    const total = countResult.rows[0]?.total || 0;

    const listQuery = `
      SELECT 
        id, tmdb_id, title, title_es, title_en, original_title, display_title,
        release_year, poster_path, director, genres, status, recommend, rating,
        review, notion_page_id, notion_edited_at, created_at,
        embedding IS NOT NULL AS has_embedding
      FROM movies
      ${whereClause}
      ORDER BY COALESCE(notion_edited_at, created_at) DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const { rows } = await query(listQuery, [...params, limit, offset]);

    return res.status(200).json({
      movies: rows,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error("❌ Error en getAdminMovies:", err);
    return res.status(500).json({ error: "Error obteniendo películas." });
  }
}

/**
 * Crear nueva película con sincronización directa hacia Notion y cálculo de embedding.
 * POST /api/admin/movies
 */
async function createMovie(req, res) {
  const {
    tmdb_id,
    status = "seen",
    rating = null,
    recommend = null,
    review = null,
    syncToNotion = true,
  } = req.body || {};

  if (!tmdb_id || Number.isNaN(Number(tmdb_id))) {
    return res.status(400).json({ error: "Falta un 'tmdb_id' válido." });
  }

  const tmdbIdNum = Number(tmdb_id);
  const tmdbKey = process.env.TMDB_API_KEY;

  if (!tmdbKey) {
    return res.status(500).json({ error: "Falta TMDB_API_KEY en variables de entorno." });
  }

  try {
    // 1. Obtener metadatos completos desde TMDB
    const movieDetails = await getDetails(tmdbIdNum, tmdbKey);

    // 2. Sincronización hacia Notion si está habilitada
    let notionPageId = null;
    let notionEditedAt = new Date().toISOString();
    let notionWarning = null;

    if (syncToNotion) {
      try {
        const notionResult = await createNotionPage({
          title: movieDetails.title_es || movieDetails.display_title,
          year: movieDetails.release_year,
          type: "Película",
          status,
          rating,
          recommend,
          review,
          tmdbId: tmdbIdNum,
          appTitle: movieDetails.display_title,
          match: "OK",
        });
        notionPageId = notionResult.pageId;
        notionEditedAt = notionResult.editedAt;
      } catch (notionErr) {
        console.warn("⚠️ Advertencia al crear página en Notion:", notionErr.message);
        notionWarning = `Guardado localmente, pero falló sincronización con Notion: ${notionErr.message}`;
      }
    }

    // 3. Generar embedding si el estado es 'seen'
    let embedding = null;
    if (status === "seen") {
      const semanticText = buildMovieSemanticText({
        title: movieDetails.title_es || movieDetails.display_title,
        director: movieDetails.director,
        genres: movieDetails.genres,
        overview: movieDetails.overview,
        review,
      });
      embedding = await generateEmbeddingWithRetry(semanticText, console.log);
    }

    // 4. Guardar en PostgreSQL (Neon)
    const row = {
      pageId: notionPageId,
      editedAt: notionEditedAt,
      status,
      recommend,
      rating,
      review,
    };

    await upsertMovie(movieDetails, row, embedding);

    // Consultar registro final guardado
    const { rows: savedRows } = await query(
      "SELECT * FROM movies WHERE tmdb_id = $1",
      [tmdbIdNum],
    );

    return res.status(201).json({
      success: true,
      movie: savedRows[0],
      notionPageId,
      warning: notionWarning,
      message: `"${movieDetails.display_title}" guardada exitosamente.`,
    });
  } catch (err) {
    console.error("❌ Error en createMovie:", err);
    return res.status(500).json({ error: err.message || "Error al crear película." });
  }
}

/**
 * Actualizar una película existente (criterio, estado, reseña) con sincronización hacia Notion.
 * PUT /api/admin/movies/:id
 */
async function updateMovie(req, res) {
  const { id } = req.params;
  const {
    status,
    rating,
    recommend,
    review,
    syncToNotion = true,
  } = req.body || {};

  try {
    // 1. Buscar película actual
    const { rows: existingRows } = await query(
      "SELECT * FROM movies WHERE id = $1 OR tmdb_id = $1",
      [id],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: "Película no encontrada." });
    }

    const current = existingRows[0];
    const newStatus = status !== undefined ? status : current.status;
    const newRating = rating !== undefined ? rating : current.rating;
    const newRecommend = recommend !== undefined ? recommend : current.recommend;
    const newReview = review !== undefined ? review : current.review;

    const reviewChanged = (newReview || "").trim() !== (current.review || "").trim();
    const statusChangedToSeen = current.status !== "seen" && newStatus === "seen";

    // 2. Recalcular embedding si es necesario
    let newEmbedding = null;
    if (newStatus === "seen" && (reviewChanged || statusChangedToSeen || !current.embedding)) {
      const semanticText = buildMovieSemanticText({
        title: current.title_es || current.display_title,
        director: current.director,
        genres: current.genres,
        overview: current.overview,
        review: newReview,
      });
      newEmbedding = await generateEmbeddingWithRetry(semanticText, console.log);
    }

    // 3. Sincronizar hacia Notion si tiene notion_page_id
    let notionEditedAt = current.notion_edited_at;
    let notionWarning = null;

    if (syncToNotion && current.notion_page_id) {
      try {
        const notionResult = await updateNotionPage(current.notion_page_id, {
          status: newStatus,
          rating: newRating,
          recommend: newRecommend,
          review: newReview,
          appTitle: current.display_title,
        });
        notionEditedAt = notionResult.editedAt;
      } catch (notionErr) {
        console.warn("⚠️ Advertencia al actualizar en Notion:", notionErr.message);
        notionWarning = `Actualizado localmente, pero falló sincronización con Notion: ${notionErr.message}`;
      }
    }

    // 4. Actualizar en Neon
    const updateQuery = `
      UPDATE movies SET
        status = $1,
        rating = $2,
        recommend = $3,
        review = $4,
        embedding = COALESCE($5::vector, embedding),
        notion_edited_at = COALESCE($6, notion_edited_at)
      WHERE id = $7
      RETURNING *
    `;

    const { rows: updatedRows } = await query(updateQuery, [
      newStatus,
      newRating,
      newRecommend,
      newReview,
      newEmbedding ? JSON.stringify(newEmbedding) : null,
      notionEditedAt,
      current.id,
    ]);

    return res.status(200).json({
      success: true,
      movie: updatedRows[0],
      reembedded: Boolean(newEmbedding),
      warning: notionWarning,
      message: `"${current.display_title}" actualizada correctamente.`,
    });
  } catch (err) {
    console.error("❌ Error en updateMovie:", err);
    return res.status(500).json({ error: err.message || "Error actualizando película." });
  }
}

/**
 * Eliminar película de la app y archivarla en Notion.
 * DELETE /api/admin/movies/:id
 */
async function deleteMovie(req, res) {
  const { id } = req.params;
  const archiveInNotion = req.query.archive !== "false";

  try {
    const { rows } = await query(
      "SELECT id, title, tmdb_id, notion_page_id FROM movies WHERE id = $1 OR tmdb_id = $1",
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Película no encontrada." });
    }

    const movie = rows[0];

    // 1. Archivar en Notion
    let notionArchived = false;
    let notionWarning = null;

    if (archiveInNotion && movie.notion_page_id) {
      try {
        await archiveNotionPage(movie.notion_page_id);
        notionArchived = true;
      } catch (notionErr) {
        console.warn("⚠️ No se pudo archivar en Notion:", notionErr.message);
        notionWarning = `Eliminado de la app, pero no se pudo archivar en Notion: ${notionErr.message}`;
      }
    }

    // 2. Eliminar de PostgreSQL
    await query("DELETE FROM movies WHERE id = $1", [movie.id]);

    return res.status(200).json({
      success: true,
      notionArchived,
      warning: notionWarning,
      message: `Película "${movie.title}" eliminada de la base de datos${notionArchived ? " y archivada en Notion." : "."}`,
    });
  } catch (err) {
    console.error("❌ Error en deleteMovie:", err);
    return res.status(500).json({ error: err.message || "Error al eliminar película." });
  }
}

/**
 * Sincronizar catálogo desde Notion hacia la app bajo demanda.
 * POST /api/admin/sync
 */
async function triggerAdminSync(req, res) {
  if (isSyncInProgress) {
    return res.status(409).json({
      error: "Ya hay una sincronización en curso. Espera a que termine.",
    });
  }

  const dryRun = Boolean(req.body?.dryRun || req.query?.dryRun === "true");
  const prune = Boolean(req.body?.prune || req.query?.prune === "true");
  const reembed = Boolean(req.body?.reembed || req.query?.reembed === "true");
  const limit = req.body?.limit ? Number(req.body.limit) : Infinity;

  isSyncInProgress = true;
  const logs = [];
  const logCapture = (msg) => {
    logs.push(msg);
    console.log(msg);
  };

  try {
    logCapture("🚀 Iniciando sincronización desde Notion vía Criterio Studio...");
    const result = await syncNotionCatalog({
      dryRun,
      prune,
      limit,
      reembed,
      log: logCapture,
    });

    return res.status(200).json({
      success: true,
      stats: result.stats,
      durationMs: result.durationMs,
      dryRun: result.dryRun,
      logs: logs.slice(-25),
    });
  } catch (err) {
    logCapture(`❌ Error en sincronización: ${err.message}`);
    return res.status(500).json({
      error: err.message,
      logs: logs.slice(-15),
    });
  } finally {
    isSyncInProgress = false;
  }
}

module.exports = {
  login,
  getMe,
  getAdminMovies,
  createMovie,
  updateMovie,
  deleteMovie,
  triggerAdminSync,
};
