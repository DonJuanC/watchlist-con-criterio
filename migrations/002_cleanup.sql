-- CINE-10c: limpieza.
-- 1) schema.sql se corrió dos veces y su CREATE INDEX sin nombre dejó dos índices HNSW
--    idénticos sobre movies.embedding: duplica el costo de cada escritura.
-- 2) movie_relations nunca se usó: las aristas se calculan al vuelo en graphController.
--    Verificado vacía (0 filas) antes de borrarla.

DROP INDEX IF EXISTS movies_embedding_idx1;
DROP TABLE IF EXISTS movie_relations;