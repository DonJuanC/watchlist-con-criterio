// src/controllers/syncController.js
// Endpoint seguro para disparar la sincronización de Notion desde webhooks,
// GitHub Actions, automatizaciones o peticiones HTTP autorizadas.

const crypto = require("crypto");
const { syncNotionCatalog } = require("../services/notionSync");

let isSyncing = false;

function isAuthorized(req) {
  const syncSecret = process.env.SYNC_SECRET || process.env.NOTION_TOKEN;
  if (!syncSecret) {
    console.error(
      "❌ Ni SYNC_SECRET ni NOTION_TOKEN están configurados en el entorno.",
    );
    return false;
  }

  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!bearerToken) {
    return false;
  }

  const secretBuf = Buffer.from(syncSecret);
  const providedBuf = Buffer.from(bearerToken);

  if (secretBuf.length !== providedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(secretBuf, providedBuf);
}

async function triggerSync(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({
      error:
        "No autorizado. Proporciona un secret válido en la cabecera 'Authorization: Bearer <token>'.",
    });
  }

  if (isSyncing) {
    return res.status(409).json({
      error: "Ya hay una sincronización en curso. Por favor espera a que termine.",
    });
  }

  const dryRun = Boolean(req.body?.dryRun || req.query?.dryRun === "true");
  const prune = Boolean(req.body?.prune || req.query?.prune === "true");
  const reembed = Boolean(req.body?.reembed || req.query?.reembed === "true");
  const limit = req.body?.limit ? Number(req.body.limit) : Infinity;

  isSyncing = true;
  const logs = [];
  const captureLog = (msg) => {
    logs.push(msg);
    console.log(msg);
  };

  try {
    captureLog("🚀 Sincronización iniciada vía API...");
    const result = await syncNotionCatalog({
      dryRun,
      prune,
      limit,
      reembed,
      log: captureLog,
    });

    return res.status(200).json({
      success: true,
      stats: result.stats,
      durationMs: result.durationMs,
      dryRun: result.dryRun,
      recentLogs: logs.slice(-10),
    });
  } catch (err) {
    console.error("❌ Error en triggerSync:", err);
    return res.status(500).json({
      error: `Error ejecutando sincronización: ${err.message}`,
      recentLogs: logs.slice(-10),
    });
  } finally {
    isSyncing = false;
  }
}

module.exports = {
  triggerSync,
};
