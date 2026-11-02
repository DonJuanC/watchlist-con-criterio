// src/hooks/useCountry.js
// "Cómo ves cine": el país del visitante y sus plataformas, compartidos por todo el sitio
// (ficha, "¿Qué veo hoy?"). Se configura una vez y se recuerda en este navegador.
//
// País, en este orden:
//   1. la elección guardada;
//   2. el país de la IP (función /api/geo de Vercel, si existe en el despliegue);
//   3. la zona horaria del navegador;
//   4. el idioma del navegador;
//   5. CO.
// Las plataformas se guardan por país (Movistar Plus+ en ES no sirve en CO).

import { create } from "zustand";
import { countryFromLanguage, countryFromTimeZone, isCountryCode } from "../lib/countries";
import { keyOfName } from "../lib/platforms";

const COUNTRY_KEY = "watchlist.country";
const PLATFORMS_KEY = "watchlist.platforms"; // { CO: ["netflix", "hbo max"], … }
const LEGACY_PROVIDERS_KEY = "watchlist_selected_providers"; // nombres, de "¿Qué veo hoy?" v1
const FALLBACK_COUNTRY = "CO";
const EMPTY = [];

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    // localStorage puede no estar disponible (modo privado, previews): se ignora.
    return null;
  }
}

function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // sin almacenamiento: vale solo para esta visita
  }
}

function savedCountry() {
  const saved = read(COUNTRY_KEY);
  return isCountryCode(saved) ? saved : null;
}

function initialCountry() {
  return savedCountry() ?? countryFromTimeZone() ?? countryFromLanguage() ?? FALLBACK_COUNTRY;
}

function loadPlatforms(country) {
  let map = {};
  try {
    const parsed = JSON.parse(read(PLATFORMS_KEY) || "{}");
    if (parsed && typeof parsed === "object") map = parsed;
  } catch {
    map = {};
  }
  // Migración: la v1 guardaba nombres sueltos, sin país. Se pasan al país actual una sola vez.
  try {
    const legacy = JSON.parse(read(LEGACY_PROVIDERS_KEY) || "null");
    if (Array.isArray(legacy) && legacy.length && !map[country]?.length) {
      map[country] = [...new Set(legacy.map(keyOfName).filter(Boolean))];
      write(PLATFORMS_KEY, JSON.stringify(map));
    }
    if (legacy) write(LEGACY_PROVIDERS_KEY, null);
  } catch {
    write(LEGACY_PROVIDERS_KEY, null);
  }
  return map;
}

const startCountry = initialCountry();

const useCountry = create((set, get) => ({
  country: startCountry,
  /** "saved" si el visitante lo eligió; "detected" si se dedujo. */
  countrySource: savedCountry() ? "saved" : "detected",
  platformsByCountry: loadPlatforms(startCountry),

  setCountry: (country) => {
    if (!isCountryCode(country)) return;
    write(COUNTRY_KEY, country);
    set({ country, countrySource: "saved" });
  },

  /** Reemplaza las plataformas del país actual. */
  setPlatforms: (keys) => {
    const { country, platformsByCountry } = get();
    const next = { ...platformsByCountry, [country]: [...new Set(keys)] };
    if (!next[country].length) delete next[country];
    write(PLATFORMS_KEY, JSON.stringify(next));
    set({ platformsByCountry: next });
  },

  togglePlatform: (key) => {
    const current = get().platformsByCountry[get().country] ?? EMPTY;
    get().setPlatforms(current.includes(key) ? current.filter((k) => k !== key) : [...current, key]);
  },
}));

/** Claves de las plataformas del visitante en el país actual (referencia estable). */
export const useMyPlatforms = () => useCountry((s) => s.platformsByCountry[s.country] ?? EMPTY);

// Afinar con el país de la IP cuando el visitante no ha elegido. En local (Vite) /api/geo no
// existe y responde el index.html: el JSON falla y queda lo deducido por zona horaria.
if (typeof window !== "undefined" && !savedCountry()) {
  fetch("/api/geo", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const geo = data?.country?.toUpperCase?.();
      const s = useCountry.getState();
      if (isCountryCode(geo) && s.countrySource === "detected" && geo !== s.country) {
        useCountry.setState({ country: geo, platformsByCountry: loadPlatforms(geo) });
      }
    })
    .catch(() => {});
}

export default useCountry;
