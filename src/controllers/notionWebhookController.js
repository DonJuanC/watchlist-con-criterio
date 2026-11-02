// src/controllers/notionWebhookController.js
// Sincronización automática Notion → App vía webhooks de la integración de Notion.
// Notion avisa cada vez que se crea, edita o borra una página del catálogo; aquí se
// verifica la firma, se agrupan los eventos (debounce) y se corre el sync incremental.

const crypto = require("crypto");
const { syncNotionCatalog } = require("../services/notionSync");

// Notion manda varios eventos seguidos mientras editas una fila (cada propiedad cuenta).
// Se espera a que pasen DEBOUNCE_MS sin eventos nuevos y se sincroniza una sola vez.
const DEBOUNCE_MS = 20 * 1000;
// Un borrado automático nunca elimina más de esto de una vez; si pasa, se omite y se avisa.
const MAX_AUTO_PRUNE = 5;

let timer = null;
let pendingPrune = false;
let isRunning = false;
let rerunRequested = false;

const lastRun = {
  at: null,
  trigger: null,
  stats: null,
  error: null,
};

function verifySignature(rawBody, signatureHeader) {
  const secret = process.env.NOTION_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signatureHeader));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function runSync(trigger) {
  if (isRunning) {
    rerunRequested = true;
    return;
  }
  isRunning = true;
  const prune = pendingPrune;
  pendingPrune = false;

  try {
    console.log(`🔔 Sync automático (${trigger}${prune ? ", con prune" : ""})`);
    const result = await syncNotionCatalog({
      prune,
      pruneLimit: MAX_AUTO_PRUNE,
      log: (msg) => console.log(`[webhook] ${msg}`),
    });
    Object.assign(lastRun, {
      at: new Date().toISOString(),
      trigger,
      stats: result.stats,
      error: null,
    });
  } catch (err) {
    console.error("❌ Sync automático falló:", err.message);
    Object.assign(lastRun, {
      at: new Date().toISOString(),
      trigger,
      stats: null,
      error: err.message,
    });
  } finally {
    isRunning = false;
    if (rerunRequested) {
      rerunRequested = false;
      scheduleSync("rerun");
    }
  }
}

function scheduleSync(trigger) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    runSync(trigger);
  }, DEBOUNCE_MS);
}

/**
 * POST /api/webhooks/notion  (body crudo, ver server.js)
 */
function handleNotionWebhook(req, res) {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8") || "{}");
  } catch {
    return res.status(400).json({ error: "JSON inválido." });
  }

  // Paso único al crear la suscripción: Notion manda un verification_token.
  // Se imprime en los logs de Render para copiarlo en Notion y en NOTION_WEBHOOK_SECRET.
  if (payload.verification_token) {
    console.log(`🔑 Notion verification_token: ${payload.verification_token}`);
    return res.status(200).json({ ok: true });
  }

  if (!verifySignature(rawBody, req.headers["x-notion-signature"])) {
    return res.status(401).json({ error: "Firma inválida." });
  }

  const type = String(payload.type || "");
  if (!/^(page|data_source|database)\./.test(type)) {
    return res.status(200).json({ ok: true, ignored: type });
  }

  if (type === "page.deleted" || type === "page.moved") {
    pendingPrune = true;
  }

  // Se responde ya; Notion reintenta si no recibe 200 rápido.
  scheduleSync(type);
  return res.status(202).json({ ok: true, scheduled: true });
}

function getAutoSyncStatus() {
  return { ...lastRun, running: isRunning, scheduled: Boolean(timer) };
}

module.exports = { handleNotionWebhook, getAutoSyncStatus };
