// src/server.js
// CINE-05/06: Servidor principal Express. CORS restringido a los orígenes del proyecto
// en Vercel (dominio de producción + cualquier preview deploy) y localhost para dev.

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 4000;

// Orígenes exactos siempre permitidos.
const DEFAULT_ALLOWED_ORIGINS = [
    'https://frontend-inky-two-2rypkrcnmd.vercel.app', // preview deploy inicial
    'https://frontend-juan-selector.vercel.app', // dominio de producción del proyecto en Vercel
    'http://localhost:5173',
];

// Cada deploy/preview en Vercel genera una URL con hash distinto
// (frontend-<hash>-juan-selector.vercel.app o frontend-<hash>.vercel.app), así que además
// del listado exacto se permite cualquier subdominio *.vercel.app que empiece con "frontend-"
// (el nombre del proyecto), en vez de tener que ir agregando cada URL nueva a mano.
const VERCEL_PREVIEW_PATTERN = /^https:\/\/frontend-[a-z0-9-]+\.vercel\.app$/;

const allowedOrigins = process.env.FRONTEND_URL
    ? [...DEFAULT_ALLOWED_ORIGINS, process.env.FRONTEND_URL]
    : DEFAULT_ALLOWED_ORIGINS;

app.use(cors({
    origin: (origin, callback) => {
        // Permite requests sin origin (curl, health checks de Render).
        if (!origin || allowedOrigins.includes(origin) || VERCEL_PREVIEW_PATTERN.test(origin)) {
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
