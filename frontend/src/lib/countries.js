// src/lib/countries.js
// Países para "Dónde verla" y "¿Qué veo hoy?": una sola lista para todo el sitio, nombres en
// español y deducción del país por la zona horaria del navegador.

// Países ofrecidos en los selectores (el detectado se agrega si no está).
export const COUNTRIES = ["CO", "MX", "AR", "CL", "PE", "EC", "VE", "UY", "ES", "US", "CA", "GB", "BR"];

let regionNames = null;
export function countryName(code) {
  try {
    regionNames ??= new Intl.DisplayNames(["es"], { type: "region" });
    return regionNames.of(code) || code;
  } catch {
    return code;
  }
}

/** Opciones del selector: la lista fija, con el país actual al frente si no estaba. */
export function countryOptions(current) {
  return COUNTRIES.includes(current) ? COUNTRIES : [current, ...COUNTRIES];
}

// Zona horaria IANA → país. Cubre el público del sitio; el resto cae al idioma del navegador.
// La zona dice más que el idioma: alguien en Bogotá con el navegador en inglés sigue en CO.
const TZ_COUNTRY = {
  "America/Bogota": "CO",
  "America/Mexico_City": "MX", "America/Monterrey": "MX", "America/Merida": "MX",
  "America/Cancun": "MX", "America/Chihuahua": "MX", "America/Hermosillo": "MX",
  "America/Mazatlan": "MX", "America/Tijuana": "MX", "America/Matamoros": "MX",
  "America/Bahia_Banderas": "MX", "America/Ciudad_Juarez": "MX", "America/Ojinaga": "MX",
  "America/Santiago": "CL", "America/Punta_Arenas": "CL", "Pacific/Easter": "CL",
  "America/Lima": "PE",
  "America/Guayaquil": "EC", "Pacific/Galapagos": "EC",
  "America/Caracas": "VE",
  "America/Montevideo": "UY",
  "America/Asuncion": "PY",
  "America/La_Paz": "BO",
  "America/Panama": "PA",
  "America/Costa_Rica": "CR",
  "America/Guatemala": "GT",
  "America/El_Salvador": "SV",
  "America/Tegucigalpa": "HN",
  "America/Managua": "NI",
  "America/Santo_Domingo": "DO",
  "America/Puerto_Rico": "PR",
  "America/Havana": "CU",
  "Europe/Madrid": "ES", "Atlantic/Canary": "ES", "Africa/Ceuta": "ES",
  "Europe/London": "GB",
  "Europe/Lisbon": "PT",
  "America/Sao_Paulo": "BR", "America/Bahia": "BR", "America/Fortaleza": "BR",
  "America/Recife": "BR", "America/Belem": "BR", "America/Manaus": "BR",
  "America/Cuiaba": "BR", "America/Porto_Velho": "BR", "America/Rio_Branco": "BR",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA",
  "America/Winnipeg": "CA", "America/Halifax": "CA", "America/St_Johns": "CA",
  "America/Regina": "CA", "America/Montreal": "CA", "America/Moncton": "CA",
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Los_Angeles": "US", "America/Phoenix": "US", "America/Anchorage": "US",
  "America/Detroit": "US", "America/Boise": "US", "Pacific/Honolulu": "US",
};

export function countryFromTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
    if (tz.startsWith("America/Argentina/")) return "AR";
    if (tz.startsWith("America/Indiana/") || tz.startsWith("America/Kentucky/")) return "US";
  } catch {
    // Intl sin zona horaria: se sigue con el idioma.
  }
  return null;
}

export function countryFromLanguage() {
  const langs = typeof navigator === "undefined"
    ? []
    : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of langs) {
    const region = (lang || "").split("-")[1];
    if (region && /^[A-Za-z]{2}$/.test(region)) return region.toUpperCase();
  }
  return null;
}

export const isCountryCode = (c) => typeof c === "string" && /^[A-Z]{2}$/.test(c);
