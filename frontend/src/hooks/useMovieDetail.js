// src/hooks/useMovieDetail.js
// CINE-10b: trae la ficha de una película bajo demanda, con caché en memoria para no
// repetir el request al volver a una película ya abierta.
// Con `external: true`, `id` es un tmdb_id y la ficha es la de fuera del catálogo.

import { useEffect, useState } from "react";
import { fetchMovie, fetchExternalMovie } from "../services/api";

const cache = new Map(); // "c:id" | "e:tmdbId" -> ficha

export default function useMovieDetail(id, { external = false } = {}) {
  const key = id != null ? `${external ? "e" : "c"}:${id}` : null;
  const [state, setState] = useState(() => ({
    data: key ? (cache.get(key) ?? null) : null,
    loading: key != null && !cache.has(key),
    error: null,
  }));

  useEffect(() => {
    if (key == null) return;
    if (cache.has(key)) {
      setState({ data: cache.get(key), loading: false, error: null });
      return;
    }

    let cancelled = false; // descarta la respuesta si el usuario ya cambió de película
    setState({ data: null, loading: true, error: null });

    (external ? fetchExternalMovie(id) : fetchMovie(id))
      .then((movie) => {
        cache.set(key, movie);
        if (!cancelled) setState({ data: movie, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled)
          setState({ data: null, loading: false, error: err.message });
      });

    return () => {
      cancelled = true;
    };
    // `id` y `external` están contenidos en `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
