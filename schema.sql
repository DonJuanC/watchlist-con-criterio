-- Watchlist con Criterio — schema.sql
-- CINE-01: Setup Base de Datos Neon (PostgreSQL + pgvector)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS movies (
    id SERIAL PRIMARY KEY,
    tmdb_id INT UNIQUE,
    title VARCHAR(255),
    overview TEXT,
    release_year INT,
    poster_path VARCHAR(255),
    director VARCHAR(255),
    cinematographer VARCHAR(255),
    genres TEXT[],
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON movies USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS movie_relations (
    id SERIAL PRIMARY KEY,
    source_movie_id INT REFERENCES movies(id) ON DELETE CASCADE,
    target_movie_id INT REFERENCES movies(id) ON DELETE CASCADE,
    relation_type VARCHAR(50),
    weight FLOAT DEFAULT 1.0
);
