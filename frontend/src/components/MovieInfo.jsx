// src/components/MovieInfo.jsx
// CINE-10b: contenido de la ficha de una película. Lo usan la EgoView y el drawer del mapa,
// para que haya una sola ficha en toda la app.

import { Loader2, Star } from "lucide-react";
import useMovieDetail from "../hooks/useMovieDetail";
import WatchProviders from "./WatchProviders";

const RECOMMEND_LABEL = {
  1: "🟢 La recomiendo sin dudarlo",
  0: "🟡 La recomiendo, con reservas",
  "-1": "🔴 No la recomendaría",
};

// Notas de la crítica (OMDb). Contexto junto a "Mi criterio": no entran al ranking.
function CriticScores({ rtScore, imdbRating, metascore, imdbId }) {
  const parts = [
    rtScore != null && { label: "🍅", value: `${rtScore}%`, title: "Rotten Tomatoes (Tomatometer)" },
    imdbRating != null && { label: "IMDb", value: Number(imdbRating).toFixed(1), title: "IMDb" },
    metascore != null && { label: "Metascore", value: metascore, title: "Metacritic" },
  ].filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <section className="rounded-lg border border-white/10 p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-300">
        La crítica
      </h4>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-200">
        {parts.map((p) => (
          <span key={p.title} title={p.title}>
            <span className="text-neutral-500">{p.label}</span> {p.value}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-neutral-500">
        Notas vía{" "}
        <a
          href="https://www.omdbapi.com"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:text-neutral-300 hover:underline"
        >
          OMDb
        </a>
        {imdbId && (
          <>
            {" · "}
            <a
              href={`https://www.imdb.com/title/${imdbId}/`}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:text-neutral-300 hover:underline"
            >
              Ver en IMDb
            </a>
          </>
        )}
      </p>
    </section>
  );
}

function MyCriteria({ rating, recommend, review }) {
  const hasCriteria = rating != null || recommend != null || review;
  if (!hasCriteria) return null;

  return (
    <section className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
        Mi criterio
      </h4>
      {rating != null && (
        <div
          className="mb-1 flex gap-0.5"
          aria-label={`${rating} de 5 estrellas`}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              size={14}
              className={
                i < rating
                  ? "fill-amber-400 text-amber-400"
                  : "text-neutral-600"
              }
            />
          ))}
        </div>
      )}
      {recommend != null && (
        <p className="text-sm text-neutral-200">{RECOMMEND_LABEL[recommend]}</p>
      )}
      {review && (
        <blockquote className="mt-2 border-l-2 border-cyan-400/40 pl-3 text-sm italic text-neutral-300">
          {review}
        </blockquote>
      )}
    </section>
  );
}

function TmdbAttribution() {
  return (
    <p className="border-t border-white/10 pt-3 text-[11px] leading-snug text-neutral-500">
      Datos e imágenes de{" "}
      <a
        href="https://www.themoviedb.org/"
        target="_blank"
        rel="noreferrer"
        className="underline hover:text-neutral-300"
      >
        TMDB
      </a>
      . This product uses the TMDB API but is not endorsed or certified by TMDB.
    </p>
  );
}

/**
 * @param {{ movieId: number }} props
 */
export default function MovieInfo({ movieId }) {
  const { data: movie, loading, error } = useMovieDetail(movieId);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-neutral-400">
        <Loader2 size={16} className="animate-spin" /> Cargando ficha…
      </div>
    );
  }
  if (error || !movie) {
    return (
      <p className="py-6 text-sm text-red-400">
        No pudimos cargar la ficha de esta película.
      </p>
    );
  }

  const subtitle =
    movie.original_title && movie.original_title !== movie.title
      ? movie.original_title
      : movie.title_es && movie.title_es !== movie.title
        ? movie.title_es
        : null;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-bold leading-tight text-white">
          {movie.title}
        </h3>
        {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
        <p className="mt-1 text-sm text-neutral-300">
          {[movie.release_year, movie.director && `Dir. ${movie.director}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {movie.cinematographer && (
          <p className="text-xs text-neutral-500">
            Fotografía: {movie.cinematographer}
          </p>
        )}
      </div>

      {Array.isArray(movie.genres) && movie.genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {movie.genres.map((g) => (
            <span
              key={g}
              className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-neutral-300"
            >
              {g}
            </span>
          ))}
        </div>
      )}

      {movie.overview && (
        <p className="text-sm leading-relaxed text-neutral-300">
          {movie.overview}
        </p>
      )}

      <CriticScores
        rtScore={movie.rt_score}
        imdbRating={movie.imdb_rating}
        metascore={movie.metascore}
        imdbId={movie.imdb_id}
      />

      <MyCriteria
        rating={movie.rating}
        recommend={movie.recommend}
        review={movie.review}
      />

      <WatchProviders tmdbId={movie.tmdb_id} />

      <TmdbAttribution />
    </div>
  );
}
