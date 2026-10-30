// src/server.js
// CINE-05/06: Servidor principal Express. CORS restringido a los orígenes del proyecto
// en Vercel (dominio de producción + cualquier preview deploy) y localhost para dev.

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const apiRouter = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 4000;

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
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api", apiRouter);

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
