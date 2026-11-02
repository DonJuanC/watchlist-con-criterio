// src/lib/platforms.js
// Clave de plataforma para cruzar "mis plataformas" con lo que trae cada película.
// El backend ya manda `key`; esta copia del normalizador cubre respuestas sin ella
// (caché del navegador o un backend anterior). Copia de src/services/platforms.js.

const SUFFIXES = / (Amazon Channel|Apple TV Channel|Roku Premium Channel|Standard with Ads|Basic with Ads|with Ads)$/i;
const TIERS = /^(Paramount Plus) (Premium|Essential)$/i;

export function normalizePlatformName(name = "") {
  let n = String(name).trim();
  for (let i = 0; i < 3 && SUFFIXES.test(n); i++) n = n.replace(SUFFIXES, "").trim();
  return n.replace(TIERS, "$1");
}

export function keyOfName(name) {
  return normalizePlatformName(name)
    .toLowerCase()
    .replace(/\s+plus\b/g, "+")
    .replace(/\++/g, "+")
    .trim();
}

/** Clave de un proveedor ({ key?, name }). */
export const platformKey = (p) => p?.key || keyOfName(p?.name);

/** ¿Está este proveedor entre las claves elegidas? */
export const isMine = (p, mine) => mine.length > 0 && mine.includes(platformKey(p));

export const LOGO_BASE = "https://image.tmdb.org/t/p/w45";
