// src/hooks/useMovieDetail.js
// CINE-10b: trae la ficha de una película bajo demanda, con caché en memoria para no
// repetir el request al volver a una película ya abierta.

import { useEffect, useState } from "react";
import { fetchMovie } from "../services/api";

const cache = new Map(); // id -> ficha

export default function useMovieDetail(id) {
  const [state, setState] = useState(() => ({
    data: id != null ? (cache.get(id) ?? null) : null,
    loading: id != null && !cache.has(id),
    error: null,
  }));

  useEffect(() => {
    if (id == null) return;
    if (cache.has(id)) {
      setState({ data: cache.get(id), loading: false, error: null });
      return;
    }

    let cancelled = false; // descarta la respuesta si el usuario ya cambió de película
    setState({ data: null, loading: true, error: null });

    fetchMovie(id)
      .then((movie) => {
        cache.set(id, movie);
        if (!cancelled) setState({ data: movie, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled)
          setState({ data: null, loading: false, error: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
