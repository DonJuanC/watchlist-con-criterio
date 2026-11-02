// src/services/platforms.js
// Normaliza las plataformas de TMDB/JustWatch para que "HBO Max Amazon Channel",
// "Netflix Standard with Ads" o "Paramount Plus Premium" cuenten como el servicio base.
// La clave (`key`) es lo que el frontend guarda como "mis plataformas" y usa para cruzar.
// Hay una copia de normalizeName en frontend/src/lib/platforms.js: si cambias una, cambia la otra.

// Sufijos de canal, tier o anuncios que no cambian el servicio.
const SUFFIXES = / (Amazon Channel|Apple TV Channel|Roku Premium Channel|Standard with Ads|Basic with Ads|with Ads)$/i;
// Tiers que sí son el mismo servicio. Solo Paramount: "YouTube Premium" no es "YouTube".
const TIERS = /^(Paramount Plus) (Premium|Essential)$/i;

// Tiendas de alquiler/compra y agregadores: no son suscripciones que alguien "tenga".
const STORES =
  /(^| )Store$|^JustWatch TV|^Amazon Video$|^Google Play|^YouTube$|^Fandango|^Microsoft Store|^Vudu|^Rakuten TV$|^Plex$|^Spectrum On Demand$/i;

/** "HBO Max Amazon Channel" → "HBO Max". */
function normalizeName(name = "") {
  let n = String(name).trim();
  // Puede haber sufijos encadenados ("Paramount Plus Premium Amazon Channel").
  for (let i = 0; i < 3 && SUFFIXES.test(n); i++) n = n.replace(SUFFIXES, "").trim();
  return n.replace(TIERS, "$1");
}

/** Clave estable: "Paramount Plus" y "Paramount+" (TMDB tiene ambas) son la misma. */
function keyOf(name) {
  return normalizeName(name)
    .toLowerCase()
    .replace(/\s+plus\b/g, "+")
    .replace(/\++/g, "+")
    .trim();
}

function isStore(name = "") {
  return STORES.test(String(name).trim());
}

/**
 * Lista de TMDB → [{ id, key, name, logo_path }] sin duplicados por clave, en el orden dado.
 * Si el servicio directo y su canal están ambos, gana el que llega primero (mejor prioridad).
 */
function dedupeByKey(list = []) {
  const seen = new Set();
  const out = [];
  for (const p of list) {
    const key = keyOf(p.provider_name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ id: p.provider_id, key, name: normalizeName(p.provider_name), logo_path: p.logo_path });
  }
  return out;
}

/**
 * Plataformas de un país para el selector: sin tiendas, sin duplicados y sin variantes
 * cuyo nombre empieza con un servicio ya listado ("Filmin Plus" cuando ya está "Filmin").
 */
function regionPlatforms(list = [], country) {
  const sorted = [...list]
    .filter((p) => !isStore(p.provider_name))
    .sort(
      (a, b) =>
        (a.display_priorities?.[country] ?? a.display_priority ?? 999) -
        (b.display_priorities?.[country] ?? b.display_priority ?? 999),
    );
  const base = dedupeByKey(sorted);
  return base.filter(
    (p) =>
      !base.some(
        (q) => q !== p && p.key.startsWith(q.key) && [" ", "+"].includes(p.key[q.key.length]),
      ),
  );
}

module.exports = { normalizeName, keyOf, isStore, dedupeByKey, regionPlatforms };
