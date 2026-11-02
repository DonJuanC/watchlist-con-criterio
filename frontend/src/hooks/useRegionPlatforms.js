// src/hooks/useRegionPlatforms.js
// Plataformas de suscripción de un país (la más popular primero), con caché por país
// compartida entre componentes para que la ficha y "¿Qué veo hoy?" no repitan la consulta.

import { useEffect, useState } from "react";
import { fetchRegionPlatforms } from "../services/api";

const cache = new Map(); // country -> platforms[]
const inflight = new Map(); // country -> Promise

function load(country) {
  if (!inflight.has(country)) {
    const p = fetchRegionPlatforms(country)
      .then((d) => {
        const list = d.platforms ?? [];
        if (list.length) cache.set(country, list);
        return list;
      })
      .finally(() => inflight.delete(country));
    inflight.set(country, p);
  }
  return inflight.get(country);
}

/** @returns {{ status: "loading"|"done"|"error", platforms: Array<{id,key,name,logo_path}> }} */
export default function useRegionPlatforms(country) {
  const [state, setState] = useState({ country: null, status: "loading", platforms: [] });

  useEffect(() => {
    if (!country || cache.has(country)) return;
    let cancelled = false;
    load(country)
      .then((platforms) => !cancelled && setState({ country, status: "done", platforms }))
      .catch(() => !cancelled && setState({ country, status: "error", platforms: [] }));
    return () => {
      cancelled = true;
    };
  }, [country]);

  if (cache.has(country)) return { status: "done", platforms: cache.get(country) };
  return state.country === country ? state : { status: "loading", platforms: [] };
}
