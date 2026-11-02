// src/components/CountrySelect.jsx
// Selector de país único para todo el sitio (ficha y "¿Qué veo hoy?"). Lee y escribe el
// estado compartido de useCountry, así que cambiarlo en un lugar lo cambia en todos.

import { Globe } from "lucide-react";
import useCountry from "../hooks/useCountry";
import { countryName, countryOptions } from "../lib/countries";

/** @param {{ className?: string }} props */
export default function CountrySelect({ className = "" }) {
  const country = useCountry((s) => s.country);
  const setCountry = useCountry((s) => s.setCountry);

  return (
    <label className={`inline-flex items-center gap-1 text-xs text-neutral-400 ${className}`}>
      <Globe size={12} className="shrink-0" aria-hidden="true" />
      <span className="sr-only">País para ver disponibilidad</span>
      <select
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        className="cursor-pointer rounded-md border border-white/10 bg-neutral-900 px-1.5 py-0.5 text-xs text-neutral-200 outline-none focus-ring-cinematic"
      >
        {countryOptions(country).map((c) => (
          <option key={c} value={c}>
            {countryName(c)}
          </option>
        ))}
      </select>
    </label>
  );
}
