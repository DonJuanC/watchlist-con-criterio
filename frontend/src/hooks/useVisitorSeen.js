// src/hooks/useVisitorSeen.js
// "Ya la vi": películas del catálogo que el visitante marca como vistas.
// Vive solo en su navegador (localStorage); no se envía a ningún lado más que como `exclude`.

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "cc_visitor_seen";
const EMPTY = [];
const listeners = new Set();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((n) => Number.isInteger(n) && n > 0) : EMPTY;
  } catch {
    return EMPTY; // modo privado, storage bloqueado o JSON corrupto: se ignora
  }
}

let seen = load();

function save(next) {
  seen = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // sin storage la marca dura lo que dure la pestaña
  }
  listeners.forEach((l) => l());
}

export function markSeen(id) {
  if (!seen.includes(id)) save([...seen, id]);
}

export function clearSeen() {
  save(EMPTY);
}

/** @returns {number[]} ids marcados como vistos por este visitante */
export default function useVisitorSeen() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => seen,
    () => EMPTY,
  );
}
