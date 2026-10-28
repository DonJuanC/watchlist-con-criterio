// src/hooks/useCountry.js
// País para "Dónde verla": se deduce del idioma del navegador (es-CO → CO) y se puede
// cambiar a mano; la elección se recuerda en este navegador. Estado compartido (zustand)
// para que todas las fichas abiertas usen el mismo país.

import { create } from "zustand";

const STORAGE_KEY = "watchlist.country";
const FALLBACK_COUNTRY = "CO";

function detectCountry() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && /^[A-Z]{2}$/.test(saved)) return saved;
  } catch {
    // localStorage puede no estar disponible (modo privado, previews): se ignora.
  }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of langs) {
    const region = (lang || "").split("-")[1];
    if (region && /^[A-Za-z]{2}$/.test(region)) return region.toUpperCase();
  }
  return FALLBACK_COUNTRY;
}

const useCountry = create((set) => ({
  country: detectCountry(),
  setCountry: (country) => {
    try {
      localStorage.setItem(STORAGE_KEY, country);
    } catch {
      // sin almacenamiento: el país vale solo para esta visita
    }
    set({ country });
  },
}));

export default useCountry;
