// src/server.js
// CINE-05/06: Servidor principal Express. CORS restringido a los orígenes del proyecto
// en Vercel (dominio de producción + cualquier preview deploy) y localhost para dev.

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const apiRouter = require("./routes/api");
const { renderMoviePreview } = require("./controllers/shareController");

const app = express();
const PORT = process.env.PORT || 4000;

// Ocultar X-Powered-By y confiar en 1 nivel de reverse proxy (Render / Cloudflare)
app.disable("x-powered-by");
app.set("trust proxy", 1);

// Cabeceras de seguridad HTTP básicas vía Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // SPA frontend en Vercel; Express provee la API y la vista /m/:id
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Orígenes exactos siempre permitidos.
const DEFAULT_ALLOWED_ORIGINS = [
  "https://frontend-inky-two-2rypkrcnmd.vercel.app", // preview deploy inicial
  "https://watchlistconcriterio.vercel.app", // dominio de producción público
  "http://localhost:5173",
];

// Cada deploy/preview en Vercel genera una URL con hash distinto
// (<proyecto>-<hash>-juan-selector.vercel.app o <proyecto>-git-<rama>-juan-selector.vercel.app).
// El proyecto se llamó "frontend" y hoy se llama "watchlist-con-criterio": se aceptan ambos
// prefijos, solo bajo el team juan-selector. Las URLs sin sufijo de team van en el listado exacto.
const VERCEL_PREVIEW_PATTERN =
  /^https:\/\/(frontend|watchlist-con-criterio)-[a-z0-9-]+-juan-selector\.vercel\.app$/;
const LOCALHOST_PATTERN = /^http:\/\/localhost(:\d+)?$/;
const allowedOrigins = process.env.FRONTEND_URL
  ? [...DEFAULT_ALLOWED_ORIGINS, process.env.FRONTEND_URL]
  : DEFAULT_ALLOWED_ORIGINS;

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requests sin origin (curl, health checks de Render),
      // orígenes en lista, previews de Vercel o cualquier puerto de localhost.
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        VERCEL_PREVIEW_PATTERN.test(origin) ||
        LOCALHOST_PATTERN.test(origin)
      ) {
        callback(null, true);
      } else {
        // Sin cabeceras CORS: el navegador bloquea la respuesta, sin convertirla en 500.
        callback(null, false);
      }
    },
    methods: ["GET", "POST"],
  }),
);
app.use(express.json({ limit: "50kb" }));

// Limitador de peticiones global para la API (300 peticiones / 15 minutos por IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones. Por favor intenta más tarde." },
});

// Limitador estricto para endpoints que consumen cuota de IA (30 peticiones / minuto por IP)
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Has superado el límite de consultas con IA por minuto. Por favor espera un momento.",
  },
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Enlace corto y dinámico para compartir con metatags Open Graph (WhatsApp, Telegram, etc.)
app.get("/m/:id", renderMoviePreview);

// Protección específica contra abuso en endpoints de IA
app.use("/api/search/semantic", aiLimiter);
app.use("/api/recommend", aiLimiter);

// Aplicar rate limiting general a todas las rutas bajo /api
app.use("/api", apiLimiter, apiRouter);

// Manejador de errores genérico (por si un middleware/controlador olvida capturar).
app.use((err, req, res, next) => {
  console.error("❌ Error no controlado:", err);
  res.status(500).json({ error: "Error interno del servidor." });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 API escuchando en http://localhost:${PORT}`);
  });
}

module.exports = app;
