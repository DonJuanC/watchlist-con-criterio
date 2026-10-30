// scripts/dev.js
// Inicia backend (API en :4000) y frontend (Vite en :5173) en paralelo con un solo comando.

const { spawn } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const frontendDir = path.resolve(rootDir, "frontend");

console.log("\x1b[36m%s\x1b[0m", "🎬 Iniciando Watchlist con Criterio (Backend + Frontend)...\n");

const backend = spawn("node", ["src/server.js"], {
  cwd: rootDir,
  stdio: "inherit",
  shell: process.platform === "win32",
});

const frontend = spawn("npm", ["run", "dev"], {
  cwd: frontendDir,
  stdio: "inherit",
  shell: process.platform === "win32",
});

function cleanup() {
  console.log("\n\x1b[33m%s\x1b[0m", "Deteniendo Backend y Frontend...");
  try {
    backend.kill("SIGTERM");
  } catch {}
  try {
    frontend.kill("SIGTERM");
  } catch {}
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

backend.on("exit", (code) => {
  if (code && code !== 0) {
    console.error(`\x1b[31m[Backend finalizó con código ${code}]\x1b[0m`);
  }
});

frontend.on("exit", (code) => {
  if (code && code !== 0) {
    console.error(`\x1b[31m[Frontend finalizó con código ${code}]\x1b[0m`);
  }
});
