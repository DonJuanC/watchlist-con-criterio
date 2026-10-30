// src/controllers/shareController.js
// Genera vistas previas dinámicas enriquecidas (Open Graph y Twitter Cards)
// para enlaces compartidos en WhatsApp, Telegram, iMessage, Twitter/X y redes sociales.
// Cuando un usuario humano abre el enlace, se redirige instantáneamente a la app en Vercel.

const { query } = require("../db");

const DEFAULT_FRONTEND = "https://watchlistconcriterio.vercel.app";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function renderMoviePreview(req, res) {
  const movieId = Number.parseInt(req.params.id, 10);
  const frontendUrl = process.env.FRONTEND_URL || DEFAULT_FRONTEND;

  if (!Number.isInteger(movieId) || movieId <= 0) {
    return res.redirect(frontendUrl);
  }

  try {
    const { rows } = await query(
      `SELECT id, title, display_title, release_year, director, poster_path, rating, review, overview
       FROM movies
       WHERE id = $1
       LIMIT 1`,
      [movieId],
    );

    if (rows.length === 0) {
      return res.redirect(frontendUrl);
    }

    const movie = rows[0];
    const movieTitle = movie.display_title || movie.title;
    const yearStr = movie.release_year ? ` (${movie.release_year})` : "";
    const directorStr = movie.director ? ` · Dir. ${movie.director}` : "";
    const pageTitle = `${movieTitle}${yearStr}${directorStr} · Watchlist con Criterio`;

    const ratingPrefix = movie.rating ? `⭐ ${movie.rating}/5 — ` : "";
    const rawDescription = movie.review
      ? `${ratingPrefix}“${movie.review}”`
      : movie.overview || `Explora las 6 conexiones directas de ${movieTitle} en el archivo cinematográfico de Juan Camilo.`;

    // Truncar para descripciones de WhatsApp / Twitter
    const description = rawDescription.length > 280
      ? `${rawDescription.slice(0, 277)}...`
      : rawDescription;

    const posterUrl = movie.poster_path
      ? `https://image.tmdb.org/t/p/w780${movie.poster_path}`
      : `${frontendUrl}/og-cover.png`;

    const targetAppUrl = `${frontendUrl}/#/movie/${movie.id}`;

    const safeTitle = escapeHtml(pageTitle);
    const safeDesc = escapeHtml(description);
    const safePoster = escapeHtml(posterUrl);
    const safeTarget = escapeHtml(targetAppUrl);

    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>

  <!-- Metatags para Crawlers de WhatsApp, Telegram, Twitter/X, Discord, iMessage -->
  <meta name="description" content="${safeDesc}">
  <meta property="og:site_name" content="Watchlist con Criterio">
  <meta property="og:type" content="video.movie">
  <meta property="og:url" content="${safeTarget}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${safePoster}">
  <meta property="og:image:width" content="780">
  <meta property="og:image:height" content="1170">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${safePoster}">

  <!-- Redirección inmediata (0 ms) para usuarios humanos -->
  <meta http-equiv="refresh" content="0;url=${safeTarget}">
  <script>
    window.location.replace("${safeTarget}");
  </script>
</head>
<body style="background-color: #0a0a0a; color: #ededed; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; text-align: center;">
  <div style="max-width: 400px; padding: 24px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.03);">
    <h1 style="font-size: 1.25rem; font-weight: 600; margin: 0 0 8px 0; color: #ffffff;">${escapeHtml(movieTitle)}</h1>
    <p style="font-size: 0.85rem; color: #a3a3a3; margin: 0 0 16px 0;">Abriendo constelación cinematográfica...</p>
    <a href="${safeTarget}" style="display: inline-block; padding: 8px 18px; border-radius: 9999px; background: #ffffff; color: #000000; text-decoration: none; font-size: 0.8rem; font-weight: 600;">Abrir en la app</a>
  </div>
</body>
</html>`;

    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
    return res.type("html").send(html);
  } catch (err) {
    console.error("❌ Error en renderMoviePreview:", err.message);
    return res.redirect(frontendUrl);
  }
}

module.exports = {
  renderMoviePreview,
};
