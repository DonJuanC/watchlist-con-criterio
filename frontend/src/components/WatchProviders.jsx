// src/components/WatchProviders.jsx
// "Dónde verla" dentro de la ficha: plataformas en el país elegido (datos de JustWatch vía
// TMDB, con su atribución). Caché en memoria por película + país. Las plataformas del
// visitante van primero; si aún no las eligió, se le ofrece hacerlo aquí mismo.

import { useEffect, useState } from "react";
import { Check, ChevronDown, Loader2, Tv } from "lucide-react";
import { fetchWatchProviders } from "../services/api";
import useCountry, { useMyPlatforms } from "../hooks/useCountry";
import { countryName } from "../lib/countries";
import { isMine, LOGO_BASE } from "../lib/platforms";
import CountrySelect from "./CountrySelect";
import PlatformPicker from "./PlatformPicker";

const cache = new Map(); // `${tmdbId}:${country}` -> respuesta

function ProviderRow({ label, providers, highlight = false }) {
  if (!providers?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span
        className={`w-20 shrink-0 text-xs ${highlight ? "font-medium text-emerald-300" : "text-neutral-400"}`}
      >
        {label}
      </span>
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
  const mine = useMyPlatforms();
  const [pickerOpen, setPickerOpen] = useState(false);
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

  if (!tmdbId) return null;
  const current = state.forKey === key ? state : { data: cache.get(key) ?? null, error: "" };
  const loading = !current.data && !current.error;
  const data = current.data;
  const empty = data && !data.stream.length && !data.rent.length && !data.buy.length;
  const inMine = data ? data.stream.filter((p) => isMine(p, mine)) : [];
  const otherStream = data ? data.stream.filter((p) => !isMine(p, mine)) : [];

  return (
    <section className="rounded-lg border border-white/10 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-300">
          <Tv size={14} /> Dónde verla
        </h4>
        <CountrySelect />
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
          <ProviderRow label="En las tuyas" providers={inMine} highlight />
          <ProviderRow label={inMine.length ? "También en" : "Incluida en"} providers={otherStream} />
          <ProviderRow label="Alquiler" providers={data.rent} />
          <ProviderRow label="Compra" providers={data.buy} />
        </div>
      )}

      {data && (
        <div className="mt-2.5 border-t border-white/[0.06] pt-2">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            className="inline-flex items-center gap-1 rounded text-[11px] text-neutral-400 hover:text-white focus-ring-cinematic"
          >
            {mine.length ? (
              <>
                <Check size={11} className="text-emerald-400" aria-hidden="true" />
                {mine.length === 1 ? "1 plataforma tuya" : `${mine.length} plataformas tuyas`} en{" "}
                {countryName(country)} · Editar
              </>
            ) : (
              "¿Cuáles tienes? Elige tus plataformas"
            )}
            <ChevronDown
              size={11}
              className={`transition-transform ${pickerOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {pickerOpen && (
            <div className="mt-2">
              <PlatformPicker top={6} />
            </div>
          )}
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
