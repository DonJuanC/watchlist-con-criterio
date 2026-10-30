// src/controllers/syncController.js
// Endpoint seguro para disparar la sincronización de Notion desde webhooks,
// GitHub Actions, automatizaciones o peticiones HTTP autorizadas.

const { syncNotionCatalog } = require("../services/notionSync");

let isSyncing = false;

function isAuthorized(req) {
  const syncSecret = process.env.SYNC_SECRET;
  const notionToken = process.env.NOTION_TOKEN;
  const validSecrets = [syncSecret, notionToken].filter(Boolean);

  if (validSecrets.length === 0) return false;

  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const querySecret = req.query?.secret?.trim();

  const provided = bearerToken || querySecret;
  return Boolean(provided && validSecrets.includes(provided));
}

async function triggerSync(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({
      error: "No autorizado. Proporciona un secret válido en 'Authorization: Bearer <token>' o '?secret=<token>'.",
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
