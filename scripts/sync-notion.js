// scripts/sync-notion.js
// CINE-10a: CLI para sincronizar el catálogo desde Notion ("🎬 Películas & Series") hacia Neon.
//   node scripts/sync-notion.js             → sincroniza lo nuevo/editado (detecta cambios en reseña)
//   node scripts/sync-notion.js --dry-run   → solo muestra qué haría, sin escribir
//   node scripts/sync-notion.js --prune     → además borra de Neon lo que no está en Notion
//   node scripts/sync-notion.js --limit 5   → procesa solo N filas (para probar)
//   node scripts/sync-notion.js --reembed   → regenera embeddings con criterio enriquecido (director + reseña)

require("dotenv").config();
const { pool } = require("../src/db");
const { syncNotionCatalog } = require("../src/services/notionSync");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const prune = args.includes("--prune");
const reembed = args.includes("--reembed") || args.includes("--force-emb");
const limit = args.includes("--limit")
  ? Number(args[args.indexOf("--limit") + 1])
  : Infinity;

async function main() {
  const result = await syncNotionCatalog({
    dryRun,
    prune,
    limit,
    reembed,
    log: console.log,
  });

  console.log("\nResumen:", result.stats, dryRun ? "(dry-run, nada escrito)" : "");
}

main()
  .catch((err) => {
    console.error("❌ Sync falló:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
