// src/hooks/useNeighbors.js
// Fase 2 · Bloque B: vecinas de una película calculadas en el backend (con criterio),
// con caché en memoria por (película + exclusiones) para no repetir requests.
// Mientras carga una nueva página de la MISMA película se conservan las vecinas
// anteriores (sin las excluidas) para que la órbita no parpadee.

import { useEffect, useState } from "react";
import { fetchNeighbors } from "../services/api";

const cache = new Map(); // "id|ids,excluidos" -> { neighbors, hasMore }
const NO_EXCLUDE = [];

const keyOf = (id, exclude) => `${id}|${[...exclude].sort((a, b) => a - b).join(",")}`;

export default function useNeighbors(id, exclude = NO_EXCLUDE) {
  const key = id != null ? keyOf(id, exclude) : null;
  const [state, setState] = useState({ key: null, forId: null, data: null, hasMore: false, error: null });

  useEffect(() => {
    if (key == null) return;
    if (cache.has(key)) {
      const hit = cache.get(key);
      setState({ key, forId: id, data: hit.neighbors, hasMore: hit.hasMore, error: null });
      return;
    }

    let cancelled = false; // descarta la respuesta si el usuario ya cambió de película/página
    fetchNeighbors(id, 6, exclude)
      .then(({ neighbors, hasMore = false }) => {
        cache.set(key, { neighbors, hasMore });
        if (!cancelled) setState({ key, forId: id, data: neighbors, hasMore, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ key, forId: id, data: null, hasMore: false, error: err.message });
      });

    return () => {
      cancelled = true;
    };
    // `exclude` ya está contenido en `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (id == null) return { data: null, hasMore: false, loading: false, error: null };

  const hit = cache.get(key);
  if (hit) return { data: hit.neighbors, hasMore: hit.hasMore, loading: false, error: null };
  if (state.key === key) return { data: state.data, hasMore: state.hasMore, loading: false, error: state.error };

  // Cargando: misma película → vecinas previas sin las excluidas; otra película → nada.
  const stale =
    state.forId === id && state.data
      ? state.data.filter((n) => !exclude.includes(n.node.id))
      : null;
  return { data: stale, hasMore: false, loading: true, error: null };
}
