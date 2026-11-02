-- Dónde ver cada película del catálogo, por país (JustWatch vía TMDB).
-- La llena scripts/fetch-availability.js (npm run availability) y se refresca sola al abrir
-- una ficha con datos de más de 7 días. Permite filtrar "¿Qué veo hoy?" por las plataformas
-- del visitante en SQL, sobre todo el catálogo y no solo sobre las películas ya cargadas.
-- stream_keys: claves normalizadas (src/services/platforms.js) de suscripción + gratis + anuncios.

CREATE TABLE IF NOT EXISTS watch_availability (
    tmdb_id     INTEGER  NOT NULL,
    country     CHAR(2)  NOT NULL,
    stream_keys TEXT[]   NOT NULL DEFAULT '{}',
    stream      JSONB    NOT NULL DEFAULT '[]',
    rent        JSONB    NOT NULL DEFAULT '[]',
    buy         JSONB    NOT NULL DEFAULT '[]',
    link        TEXT,
    PRIMARY KEY (tmdb_id, country)
);
-- El filtro busca por (tmdb_id, country), que ya cubre la llave primaria: no hace falta índice GIN.

-- Cuándo se consultó cada película (aunque no esté en ninguna plataforma de ningún país).
CREATE TABLE IF NOT EXISTS watch_fetched (
    tmdb_id    INTEGER     PRIMARY KEY,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
