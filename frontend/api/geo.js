// frontend/api/geo.js
// Función de Vercel: devuelve el país del visitante según su IP (header que pone Vercel).
// Solo se usa para preseleccionar el país de "Dónde verla"; no guarda nada.

export default function handler(req, res) {
  const raw = req.headers["x-vercel-ip-country"];
  const country = typeof raw === "string" && /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : null;
  res.setHeader("Cache-Control", "private, no-store");
  res.status(200).json({ country });
}
