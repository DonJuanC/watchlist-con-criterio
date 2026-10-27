// src/hooks/useTmdbSuggestions.js
// CINE-10: sugerencias de TMDB mientras se escribe, con debounce y caché en memoria.
// Mientras llega la respuesta nueva se mantienen las anteriores (evita que la lista parpadee).

import { useEffect, useState } from "react";
import { searchTmdb } from "../services/api";

const DEBOUNCE_MS = 350;
const MIN_CHARS = 3;
const cache = new Map(); // texto normalizado -> resultados

export default function useTmdbSuggestions(rawQuery, enabled) {
  const q = (rawQuery || "").trim().toLowerCase();
  const active = enabled && q.length >= MIN_CHARS;
  const [state, setState] = useState({ forQ: null, results: [], loading: false });

  useEffect(() => {
    if (!active) return;
    if (cache.has(q)) {
      setState({ forQ: q, results: cache.get(q), loading: false });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      searchTmdb(q)
        .then(({ results }) => {
          cache.set(q, results);
          if (!cancelled) setState({ forQ: q, results, loading: false });
        })
        .catch(() => {
          if (!cancelled) setState({ forQ: q, results: [], loading: false });
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, active]);

  if (!active) return { results: [], loading: false };
  if (state.forQ !== q) {
    return cache.has(q)
      ? { results: cache.get(q), loading: false }
      : { results: state.results, loading: true };
  }
  return state;
}
