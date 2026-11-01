// src/middleware/auth.js
// CINE-11: Middleware de autenticación para el Panel Criterio Studio (Admin).
// Valida tokens de sesión firmados o el token maestro / ADMIN_PASSWORD directo.

const crypto = require("crypto");

function getAdminSecret() {
  return (
    process.env.ADMIN_PASSWORD ||
    process.env.SYNC_SECRET ||
    process.env.NOTION_TOKEN
  );
}

/**
 * Genera un token firmado con HMAC-SHA256 con fecha de expiración (30 días por defecto).
 */
function createAdminSessionToken(expiresInMs = 30 * 24 * 60 * 60 * 1000) {
  const secret = getAdminSecret();
  if (!secret) {
    throw new Error("No hay una clave administrativa configurada en el entorno.");
  }

  const payload = {
    role: "admin",
    iat: Date.now(),
    exp: Date.now() + expiresInMs,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadBase64)
    .digest("base64url");

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifica si un token firmado o token maestro es válido.
 */
function verifyAdminToken(token) {
  const secret = getAdminSecret();
  if (!secret || !token) return false;

  // 1. Soporte directo: el token coincide exactamente con la clave maestra
  try {
    const secretBuf = Buffer.from(secret);
    const providedBuf = Buffer.from(token);
    if (
      secretBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(secretBuf, providedBuf)
    ) {
      return true;
    }
  } catch (_) {
    // ignorar y pasar a verificación de firma
  }

  // 2. Verificación de token firmado (payload.signature)
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [payloadBase64, signature] = parts;
  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payloadBase64)
      .digest("base64url");

    const expectedBuf = Buffer.from(expectedSignature);
    const providedSigBuf = Buffer.from(signature);

    if (
      expectedBuf.length !== providedSigBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedSigBuf)
    ) {
      return false;
    }

    const payload = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf-8"),
    );

    if (payload.exp && Date.now() > payload.exp) {
      return false; // expirado
    }

    return payload.role === "admin";
  } catch (err) {
    return false;
  }
}

/**
 * Middleware de Express para proteger rutas que requieren permisos de administración.
 */
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : req.headers["x-admin-token"]?.toString().trim();

  if (!bearerToken) {
    return res.status(401).json({
      error: "Acceso no autorizado. Proporciona credenciales de administrador.",
    });
  }

  if (!verifyAdminToken(bearerToken)) {
    return res.status(401).json({
      error: "Sesión inválida o expirada. Por favor ingresa nuevamente.",
    });
  }

  next();
}

module.exports = {
  getAdminSecret,
  createAdminSessionToken,
  verifyAdminToken,
  requireAdminAuth,
};
