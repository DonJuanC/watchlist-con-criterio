// src/components/WatchProviders.jsx
// "Dónde verla" dentro de la ficha: plataformas en el país elegido (datos de JustWatch vía
// TMDB, con su atribución). Caché en memoria por película + país.

import { useEffect, useMemo, useState } from "react";
import { Loader2, Tv } from "lucide-react";
import { fetchWatchProviders } from "../services/api";
import useCountry from "../hooks/useCountry";

const LOGO_BASE = "https://image.tmdb.org/t/p/w45";
// Países ofrecidos en el selector (el detectado se agrega si no está).
const COUNTRIES = ["CO", "MX", "AR", "CL", "PE", "EC", "VE", "UY", "ES", "US", "CA", "GB", "BR"];
const cache = new Map(); // `${tmdbId}:${country}` -> respuesta

let regionNames = null;
function countryName(code) {
  try {
    regionNames ??= new Intl.DisplayNames(["es"], { type: "region" });
    return regionNames.of(code) || code;
  } catch {
    return code;
  }
}

function ProviderRow({ label, providers }) {
  if (!providers?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="w-20 shrink-0 text-xs text-neutral-400">{label}</span>
      {providers.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1.5 text-xs text-neutral-200">
          {p.logo_path && (
            <img
              src={`${LOGO_BASE}${p.logo_path}`}
              alt=""
              loading="lazy"
              className="h-5 w-5 rounded"
            />
          )}
          {p.name}
        </span>
      ))}
    </div>
  );
}

/** @param {{ tmdbId: number }} props */
export default function WatchProviders({ tmdbId }) {
  const country = useCountry((s) => s.country);
  const setCountry = useCountry((s) => s.setCountry);
  const key = `${tmdbId}:${country}`;
  const [state, setState] = useState({ forKey: null, data: null, error: "" });

  useEffect(() => {
    if (!tmdbId) return;
    if (cache.has(key)) {
      setState({ forKey: key, data: cache.get(key), error: "" });
      return;
    }
    let cancelled = false;
    fetchWatchProviders(tmdbId, country)
      .then((data) => {
        cache.set(key, data);
        if (!cancelled) setState({ forKey: key, data, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setState({ forKey: key, data: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [tmdbId, country, key]);

  const options = useMemo(
    () => (COUNTRIES.includes(country) ? COUNTRIES : [country, ...COUNTRIES]),
    [country],
  );

  if (!tmdbId) return null;
  const current = state.forKey === key ? state : { data: cache.get(key) ?? null, error: "" };
  const loading = !current.data && !current.error;
  const data = current.data;
  const empty = data && !data.stream.length && !data.rent.length && !data.buy.length;

  return (
    <section className="rounded-lg border border-white/10 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-300">
          <Tv size={14} /> Dónde verla
        </h4>
        <label className="inline-flex items-center gap-1 text-xs text-neutral-400">
          <span className="sr-only">País</span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-md border border-white/10 bg-neutral-900 px-1.5 py-0.5 text-xs text-neutral-200 outline-none focus-ring-cinematic"
          >
            {options.map((c) => (
              <option key={c} value={c}>
                {countryName(c)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && (
        <p className="inline-flex items-center gap-2 text-xs text-neutral-400">
          <Loader2 size={12} className="animate-spin" /> Buscando plataformas…
        </p>
      )}
      {current.error && (
        <p className="text-xs text-neutral-400">No pude consultar dónde verla ahora mismo.</p>
      )}
      {empty && (
        <p className="text-xs text-neutral-400">
          No aparece en plataformas en {countryName(country)}.
        </p>
      )}
      {data && !empty && (
        <div className="space-y-1.5">
          <ProviderRow label="Incluida en" providers={data.stream} />
          <ProviderRow label="Alquiler" providers={data.rent} />
          <ProviderRow label="Compra" providers={data.buy} />
        </div>
      )}

      {data && (
        <p className="mt-2 text-[10px] text-neutral-400">
          Datos de{" "}
          <a
            href="https://www.justwatch.com"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:text-neutral-300 hover:underline focus-ring-cinematic rounded"
            aria-label="Sitio web de JustWatch (se abre en nueva pestaña)"
          >
            JustWatch
          </a>
          {data.link && (
            <>
              {" · "}
              <a
                href={data.link}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:text-neutral-300 hover:underline focus-ring-cinematic rounded"
                aria-label="Ver opciones en TMDB (se abre en nueva pestaña)"
              >
                Ver opciones en TMDB
              </a>
            </>
          )}
        </p>
      )}
    </section>
  );
}
