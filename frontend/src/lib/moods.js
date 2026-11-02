// src/lib/moods.js
// Ánimos y fuentes compartidos por "Sorpréndeme" y "¿Qué veo hoy?".
// Las claves de MOODS deben existir en src/services/moods.js del backend.

export const MOODS = [
  { key: "pensar", label: "Para pensar" },
  { key: "reir", label: "Para reír" },
  { key: "adrenalina", label: "Adrenalina" },
  { key: "llorar", label: "Para llorar" },
  { key: "miedo", label: "Miedo" },
  { key: "culto", label: "Rara y de culto" },
];
export const MOOD_LABEL = Object.fromEntries(MOODS.map((m) => [m.key, m.label]));
export const isMood = (k) => Object.hasOwn(MOOD_LABEL, k);

// De dónde salen las películas. `slug` es lo que va en la URL (#/que-veo-hoy?fuente=…).
export const SOURCES = [
  { key: "archive", slug: "archivo", label: "Recomendadas" },
  { key: "radar", slug: "radar", label: "En la mira" },
  { key: "beyond", slug: "mas-alla", label: "Más allá" },
];
export const sourceFromSlug = (slug) => SOURCES.find((s) => s.slug === slug)?.key ?? null;
export const slugOf = (key) => SOURCES.find((s) => s.key === key)?.slug ?? "archivo";

/** Query de "¿Qué veo hoy?" para un ánimo y una fuente ("animo=reir&fuente=archivo"). */
export function nextUpQuery({ mood, source } = {}) {
  const qs = new URLSearchParams();
  if (isMood(mood)) qs.set("animo", mood);
  if (source && source !== "archive") qs.set("fuente", slugOf(source));
  return qs.toString();
}
