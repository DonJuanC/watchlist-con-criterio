// src/server.js
// CINE-03: Servidor principal Express, con CORS abierto para el frontend (dev local).

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 4000;

// CORS abierto — en dev local no hay restricción de origen; ajustar en producción
// (Render/Fly.io) a la URL real del frontend en Vercel/Cloudflare Pages.
app.use(cors());
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
