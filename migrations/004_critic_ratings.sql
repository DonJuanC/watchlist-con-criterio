-- Notas de la crítica (OMDb): Tomatometer de Rotten Tomatoes, IMDb y Metascore.
-- Las llena scripts/fetch-ratings.js (npm run ratings). Son contexto en la ficha:
-- NO entran al ranking, que sigue siendo solo mi criterio.
-- ratings_fetched_at marca que ya se consultó (aunque OMDb no tuviera notas).

ALTER TABLE movies
    ADD COLUMN IF NOT EXISTS imdb_id VARCHAR(12),
    ADD COLUMN IF NOT EXISTS rt_score SMALLINT CHECK (rt_score BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS imdb_rating NUMERIC(3, 1) CHECK (imdb_rating BETWEEN 0 AND 10),
    ADD COLUMN IF NOT EXISTS metascore SMALLINT CHECK (metascore BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS ratings_fetched_at TIMESTAMPTZ;
