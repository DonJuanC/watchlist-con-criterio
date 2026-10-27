// src/components/ExternalView.jsx
// CINE-10: "Si te gustó X…" para una película que NO está en las vistas del catálogo.
// Pide POST /api/recommend; si resulta que sí está vista, salta directo a su EgoView.
// Tocar una recomendación abre su EgoView (ahí ya es una película del catálogo).

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchRecommend } from "../services/api";

const POSTER_BASE = "https://image.tmdb.org/t/p/w185";

const REASON_LABEL = {
  same_director: "Mismo director",
  semantic_similarity: "Se siente parecida",
};

function Poster({ movie, className }) {
  const initial = (movie.title || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-neutral-800 ring-1 ring-white/20 transition group-hover:ring-cyan-400 group-focus-visible:ring-2 group-focus-visible:ring-cyan-400 ${className}`}
    >
      <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-neutral-400">
        {initial}
      </span>
      {movie.poster_path && (
        <img
          src={`${POSTER_BASE}${movie.poster_path}`}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

/**
 * @param {{ movie: { tmdb_id: number, title: string, release_year?: number, poster_path?: string },
 *           onPick: (id: number) => void }} props
 */
export default function ExternalView({ movie, onPick }) {
  const [state, setState] = useState({ status: "loading", data: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null, error: "" });
    fetchRecommend(movie.tmdb_id)
      .then((data) => {
        if (cancelled) return;
        if (data.source === "catalog") {
          onPick(data.movieId); // ya la vi: mejor su vista con vecinas
          return;
        }
        setState({ status: "done", data, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: "error", data: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [movie.tmdb_id, onPick]);

  const recommendations = state.data?.recommendations ?? [];
  const isPending = state.data?.source === "pending";

  return (
    <section
      className="mx-auto flex w-full max-w-xl flex-col items-center px-4 pb-10 pt-4 text-center"
      aria-label={`Recomendaciones si te gustó ${movie.title}`}
    >
      <Poster movie={movie} className="h-24 w-24 ring-2 ring-cyan-400/70" />
      <h2 className="mt-3 text-lg font-semibold leading-tight text-white">
        Si te gustó {movie.title}
      </h2>
      <p className="text-xs text-neutral-400">
        {[movie.release_year, isPending && "En mi lista de pendientes"]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {state.status === "loading" && (
        <p className="mt-8 inline-flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 size={16} className="animate-spin" />
          Comparando con lo que he visto…
        </p>
      )}

      {state.status === "error" && (
        <p className="mt-8 max-w-sm text-sm text-red-400">
          No pude armar la recomendación ahora mismo. Intenta de nuevo en unos segundos.
          <span className="mt-1 block text-xs text-neutral-500">{state.error}</span>
        </p>
      )}

      {state.status === "done" && recommendations.length > 0 && (
        <>
          <p className="mb-4 mt-6 text-sm text-neutral-300">
            De lo que he visto, te recomiendo:
          </p>
          <div className="grid w-full grid-cols-3 gap-x-2 gap-y-5">
            {recommendations.map((r) => (
              <button
                key={r.node.id}
                type="button"
                onClick={() => onPick(r.node.id)}
                aria-label={`Abrir ${r.node.title}. ${REASON_LABEL[r.type] ?? "Conectada"}`}
                className="group flex flex-col items-center focus:outline-none"
              >
                <Poster movie={r.node} className="h-20 w-20 group-hover:scale-105" />
                <span className="mt-2 line-clamp-2 text-xs leading-tight text-neutral-100">
                  {r.node.title}
                </span>
                <span className="mt-0.5 text-[10px] leading-none text-neutral-500">
                  {REASON_LABEL[r.type] ?? "Conectada"}
                </span>
                {r.node.recommend === 1 && (
                  <span className="mt-1 text-[10px] leading-none text-emerald-400">
                    🟢 La recomiendo
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {state.status === "done" && recommendations.length === 0 && (
        <p className="mt-8 max-w-sm text-sm text-neutral-400">
          No encontré nada parecido entre lo que he visto.
        </p>
      )}
    </section>
  );
}
