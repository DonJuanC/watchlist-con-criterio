// src/hooks/useNeighbors.js
// Fase 2 · Bloque B: vecinas de una película calculadas en el backend (con criterio),
// con caché en memoria para no repetir el request al volver a una película.

import { useEffect, useState } from "react";
import { fetchNeighbors } from "../services/api";

const cache = new Map(); // id -> array de vecinas [{ node, type, weight, reasons }]

export default function useNeighbors(id) {
  const [state, setState] = useState(() => ({
    forId: id,
    data: id != null ? (cache.get(id) ?? null) : null,
    loading: id != null && !cache.has(id),
    error: null,
  }));

  useEffect(() => {
    if (id == null) {
      setState({ forId: id, data: null, loading: false, error: null });
      return;
    }
    if (cache.has(id)) {
      setState({ forId: id, data: cache.get(id), loading: false, error: null });
      return;
    }

    let cancelled = false; // descarta la respuesta si el usuario ya cambió de película
    setState({ forId: id, data: null, loading: true, error: null });

    fetchNeighbors(id)
      .then(({ neighbors }) => {
        cache.set(id, neighbors);
        if (!cancelled)
          setState({ forId: id, data: neighbors, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled)
          setState({ forId: id, data: null, loading: false, error: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Si el id cambió y el effect aún no corrió, no devolver datos de la película anterior.
  if (state.forId !== id) {
    const cached = id != null ? cache.get(id) : undefined;
    return { data: cached ?? null, loading: id != null && !cached, error: null };
  }
  return state;
}
