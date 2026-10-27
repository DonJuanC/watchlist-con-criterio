-- CINE-10: caché de embeddings para películas fuera del catálogo.
-- POST /api/recommend genera el embedding de una película externa una sola vez
-- (Gemini free tier) y lo reutiliza en visitas siguientes.
-- Sin índice vectorial: se consulta por tmdb_id; la similitud se calcula contra movies.

CREATE TABLE IF NOT EXISTS external_embeddings (
    tmdb_id INT PRIMARY KEY,
    title VARCHAR(255),
    release_year INT,
    poster_path VARCHAR(255),
    director VARCHAR(255),
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);