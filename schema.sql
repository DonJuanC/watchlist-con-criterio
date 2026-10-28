-- Watchlist con Criterio — schema.sql
-- Estado actual de la base (CINE-01 + migraciones 001 a 004).
-- Para una base nueva: correr este archivo. Para una base existente: migrations/ en orden.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS movies (
    id SERIAL PRIMARY KEY,
    tmdb_id INT UNIQUE,
    title VARCHAR(255),              -- título que muestra la app (= display_title)
    title_en VARCHAR(255),
    title_es VARCHAR(255),
    original_title VARCHAR(255),
    original_language VARCHAR(10),
    display_title VARCHAR(255),      -- regla: inglés, salvo películas en español → original
    overview TEXT,
    release_year INT,
    poster_path VARCHAR(255),
    director VARCHAR(255),
    cinematographer VARCHAR(255),
    genres TEXT[],
    embedding vector(768),           -- gemini-embedding-001, truncado a 768 dims
    status VARCHAR(10) NOT NULL DEFAULT 'seen' CHECK (status IN ('seen', 'pending')),
    recommend SMALLINT CHECK (recommend IN (-1, 0, 1)),  -- 🔴 / 🟡 / 🟢
    rating SMALLINT CHECK (rating BETWEEN 1 AND 5),      -- ⭐ 1-5
    review TEXT,
    notion_page_id UUID UNIQUE,      -- fila de origen en Notion
    notion_edited_at TIMESTAMPTZ,
    imdb_id VARCHAR(12),                                         -- migración 004 (OMDb)
    rt_score SMALLINT CHECK (rt_score BETWEEN 0 AND 100),        -- 🍅 Tomatometer %
    imdb_rating NUMERIC(3, 1) CHECK (imdb_rating BETWEEN 0 AND 10),
    metascore SMALLINT CHECK (metascore BETWEEN 0 AND 100),
    ratings_fetched_at TIMESTAMPTZ,                              -- ya consultada en OMDb
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS movies_embedding_idx ON movies USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS movies_status_idx ON movies (status);

-- CINE-10 (migración 003): caché de embeddings de películas fuera del catálogo.
CREATE TABLE IF NOT EXISTS external_embeddings (
    tmdb_id INT PRIMARY KEY,
    title VARCHAR(255),
    release_year INT,
    poster_path VARCHAR(255),
    director VARCHAR(255),
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
