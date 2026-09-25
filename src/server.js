// src/server.js
// CINE-05: Servidor principal Express. CORS restringido a los orígenes permitidos
// (frontend en Vercel + localhost para dev), configurable vía FRONTEND_URL.

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 4000;

const DEFAULT_ALLOWED_ORIGINS = [
    'https://frontend-inky-two-2rypkrcnmd.vercel.app',
    'http://localhost:5173',
];

const allowedOrigins = process.env.FRONTEND_URL
    ? [...DEFAULT_ALLOWED_ORIGINS, process.env.FRONTEND_URL]
    : DEFAULT_ALLOWED_ORIGINS;

app.use(cors({
    origin: (origin, callback) => {
        // Permite requests sin origin (curl, health checks de Render) y los orígenes listados.
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS bloqueado para origin: ${origin}`));
        }
    },
    methods: ['GET', 'POST'],
}));
app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.use('/api', apiRouter);

// Manejador de errores genérico (por si un middleware/controlador olvida capturar).
app.use((err, req, res, next) => {
    console.error('❌ Error no controlado:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
    console.log(`🚀 API escuchando en http://localhost:${PORT}`);
});

module.exports = app;
