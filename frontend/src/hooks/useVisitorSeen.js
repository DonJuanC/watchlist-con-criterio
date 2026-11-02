// src/hooks/useVisitorSeen.js
// "Ya la vi": películas que el visitante marca como vistas. Dos listas:
//  - del catálogo (id del catálogo) → cc_visitor_seen
//  - de fuera del archivo (tmdb_id)  → cc_visitor_seen_ext
// Viven solo en su navegador (localStorage); se envían únicamente como `exclude`.

import { useSyncExternalStore } from "react";

const EMPTY = [];

function createSeenStore(storageKey) {
  const listeners = new Set();
  const load = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(raw) ? raw.filter((n) => Number.isInteger(n) && n > 0) : EMPTY;
    } catch {
      return EMPTY; // modo privado, storage bloqueado o JSON corrupto: se ignora
    }
  };
  let seen = load();
  const save = (next) => {
    seen = next;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // sin storage la marca dura lo que dure la pestaña
    }
    listeners.forEach((l) => l());
  };
  const subscribe = (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  return {
    mark: (id) => {
      if (!seen.includes(id)) save([...seen, id]);
    },
    clear: () => save(EMPTY),
    use: () => useSyncExternalStore(subscribe, () => seen, () => EMPTY),
  };
}

const catalogSeen = createSeenStore("cc_visitor_seen");
const externalSeen = createSeenStore("cc_visitor_seen_ext");

export const markSeen = catalogSeen.mark;
export const clearSeen = catalogSeen.clear;
export const markSeenExternal = externalSeen.mark;
export const clearSeenExternal = externalSeen.clear;

/** @returns {number[]} ids del catálogo marcados como vistos por este visitante */
export default function useVisitorSeen() {
  return catalogSeen.use();
}

/** @returns {number[]} tmdb_id de películas fuera del archivo marcadas como vistas */
export function useVisitorSeenExternal() {
  return externalSeen.use();
}
